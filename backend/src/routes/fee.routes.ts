import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';
import { getPagination, paginate } from '../utils/pagination';
import { createAuditLog } from '../utils/auditLog';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

const router = Router();
router.use(authenticate);

const feeStructureSchema = z.object({
  academicYearId: z.string(),
  classId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  amount: z.number().positive(),
  dueDate: z.string().optional(),
  isMandatory: z.boolean().optional(),
});

const invoiceSchema = z.object({
  studentId: z.string(),
  feeStructureIds: z.array(z.string()).min(1),
  discount: z.number().min(0).optional(),
  dueDate: z.string().optional(),
});

const paymentSchema = z.object({
  invoiceId: z.string(),
  amount: z.number().positive(),
  paymentMethod: z.string().min(1),
  transactionRef: z.string().optional(),
  notes: z.string().optional(),
});

function generateReceiptNumber(): string {
  return `RCP${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function generateInvoiceNumber(): string {
  return `INV${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

// ── Fee Structures ────────────────────────────────────────────────────────────
router.get('/structures', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { academicYearId, classId } = req.query as Record<string, string>;
    const where: any = {};
    if (academicYearId) where.academicYearId = academicYearId;
    if (classId) where.classId = classId;
    const data = await prisma.feeStructure.findMany({ where, include: { class: true, academicYear: true } });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/structures', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = feeStructureSchema.parse(req.body);
    const fs = await prisma.feeStructure.create({
      data: { ...body, dueDate: body.dueDate ? new Date(body.dueDate) : undefined } as any,
    });
    res.status(201).json({ success: true, data: fs });
  } catch (err) { next(err); }
});

router.patch('/structures/:id', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = feeStructureSchema.partial().parse(req.body);
    const fs = await prisma.feeStructure.update({ where: { id: req.params.id }, data: { ...body, dueDate: body.dueDate ? new Date(body.dueDate) : undefined } });
    res.json({ success: true, data: fs });
  } catch (err) { next(err); }
});

// GET /my-invoices — Student: own fee invoices with items and payments
router.get('/my-invoices', authorize(Role.STUDENT), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
    if (!student) throw new AppError('Student not found', 404);
    const invoices = await prisma.feeInvoice.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { feeStructure: true } },
        payments: { orderBy: { paymentDate: 'desc' } },
      },
    });
    res.json({ success: true, data: invoices });
  } catch (err) { next(err); }
});

// ── Invoices ──────────────────────────────────────────────────────────────────
router.get('/invoices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = getPagination(req.query as any);
    let studentId = req.query.studentId as string | undefined;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    if (req.user!.role === Role.STUDENT) {
      const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
      if (!student) throw new AppError('Student not found', 404);
      studentId = student.id;
    }

    const where: any = {};
    if (studentId) where.studentId = studentId;
    if (status) where.status = status;
    if (search) {
      where.student = {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { admissionNumber: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [total, data] = await prisma.$transaction([
      prisma.feeInvoice.count({ where }),
      prisma.feeInvoice.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        include: { student: { select: { firstName: true, lastName: true, admissionNumber: true } }, items: { include: { feeStructure: true } }, payments: true },
      }),
    ]);
    res.json({ success: true, ...paginate(total, data, page, limit) });
  } catch (err) { next(err); }
});

router.get('/invoices/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoice = await prisma.feeInvoice.findUnique({
      where: { id: req.params.id },
      include: { student: { select: { firstName: true, lastName: true, admissionNumber: true } }, items: { include: { feeStructure: true } }, payments: true },
    });
    if (!invoice) throw new AppError('Invoice not found', 404);
    if (req.user!.role === Role.STUDENT) {
      const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
      if (!student || student.id !== invoice.studentId) throw new AppError('Access denied', 403);
    }
    res.json({ success: true, data: invoice });
  } catch (err) { next(err); }
});

router.post('/invoices', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = invoiceSchema.parse(req.body);
    const structures = await prisma.feeStructure.findMany({ where: { id: { in: body.feeStructureIds } } });
    const totalAmount = structures.reduce((sum, s) => sum + Number(s.amount), 0);

    const invoice = await prisma.$transaction(async tx => {
      const inv = await tx.feeInvoice.create({
        data: {
          invoiceNumber: generateInvoiceNumber(),
          studentId: body.studentId,
          totalAmount,
          discount: body.discount || 0,
          dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
          items: {
            create: structures.map(s => ({ feeStructureId: s.id, description: s.name, amount: s.amount })),
          },
        },
        include: { items: true, student: { select: { firstName: true, lastName: true } } },
      });
      return inv;
    });

    await createAuditLog({ userId: req.user!.id, action: 'CREATE_INVOICE', resource: 'FeeInvoice', resourceId: invoice.id });
    res.status(201).json({ success: true, data: invoice });
  } catch (err) { next(err); }
});

// POST /student-payment — Student pays their own invoice
router.post('/student-payment', authorize(Role.STUDENT), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      invoiceId: z.string(),
      amount: z.number().positive(),
      paymentMethod: z.string().min(1),
      transactionRef: z.string().min(1),
      notes: z.string().optional(),
    }).parse(req.body);

    const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
    if (!student) throw new AppError('Student not found', 404);

    const invoice = await prisma.feeInvoice.findUnique({ where: { id: body.invoiceId } });
    if (!invoice) throw new AppError('Invoice not found', 404);
    if (invoice.studentId !== student.id) throw new AppError('Access denied', 403);
    if (invoice.status === 'PAID' || invoice.status === 'WAIVED') throw new AppError('Invoice is already settled', 400);

    const outstanding = Number(invoice.totalAmount) - Number(invoice.discount ?? 0) - Number(invoice.paidAmount);
    if (body.amount > outstanding + 0.01) throw new AppError(`Amount exceeds outstanding balance of ${outstanding.toFixed(2)}`, 400);

    if (body.transactionRef) {
      const existing = await prisma.feePayment.findUnique({ where: { transactionRef: body.transactionRef } });
      if (existing) throw new AppError('Transaction reference already used', 409);
    }

    const payment = await prisma.$transaction(async tx => {
      const p = await tx.feePayment.create({
        data: {
          invoiceId: body.invoiceId,
          amount: body.amount,
          paymentMethod: body.paymentMethod,
          transactionRef: body.transactionRef,
          receiptNumber: generateReceiptNumber(),
          notes: body.notes,
          recordedBy: req.user!.id,
        },
      });
      const newPaid = Number(invoice.paidAmount) + body.amount;
      const netDue = Number(invoice.totalAmount) - Number(invoice.discount ?? 0);
      const status = newPaid >= netDue - 0.01 ? 'PAID' : 'PARTIAL';
      await tx.feeInvoice.update({ where: { id: body.invoiceId }, data: { paidAmount: newPaid, status } });
      return p;
    });

    await createAuditLog({ userId: req.user!.id, action: 'STUDENT_PAYMENT', resource: 'FeePayment', resourceId: payment.id, details: { amount: body.amount, invoiceId: body.invoiceId } });
    res.status(201).json({ success: true, data: payment });
  } catch (err) { next(err); }
});

function isRazorpayConfigured(): boolean {
  const id = process.env.RAZORPAY_KEY_ID || '';
  const secret = process.env.RAZORPAY_KEY_SECRET || '';
  return id.startsWith('rzp_') && !id.includes('XXXX') && secret.length > 10 && !secret.includes('XXXX');
}

// POST /create-payment-order — Student: create Razorpay order (or signal manual fallback)
router.post('/create-payment-order', authorize(Role.STUDENT), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { invoiceId, amount } = z.object({ invoiceId: z.string(), amount: z.number().positive() }).parse(req.body);

    const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
    if (!student) throw new AppError('Student not found', 404);

    const invoice = await prisma.feeInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new AppError('Invoice not found', 404);
    if (invoice.studentId !== student.id) throw new AppError('Access denied', 403);
    if (invoice.status === 'PAID' || invoice.status === 'WAIVED') throw new AppError('Invoice already settled', 400);

    const outstanding = Number(invoice.totalAmount) - Number(invoice.discount ?? 0) - Number(invoice.paidAmount);
    if (amount > outstanding + 0.01) throw new AppError(`Amount exceeds outstanding balance of ${outstanding.toFixed(2)}`, 400);

    if (!isRazorpayConfigured()) {
      return res.json({ success: true, data: { razorpayEnabled: false } });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // paise
      currency: 'INR',
      receipt: `rcpt_${invoiceId.slice(-8)}_${Date.now()}`,
      notes: { invoiceId, studentId: student.id },
    });

    res.json({ success: true, data: { razorpayEnabled: true, orderId: order.id, amount: order.amount, currency: order.currency, key: process.env.RAZORPAY_KEY_ID } });
  } catch (err) { next(err); }
});

// POST /verify-payment — Student: verify Razorpay signature and record payment
router.post('/verify-payment', authorize(Role.STUDENT), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      razorpay_order_id: z.string(),
      razorpay_payment_id: z.string(),
      razorpay_signature: z.string(),
      invoiceId: z.string(),
      amount: z.number().positive(),
    }).parse(req.body);

    const secret = process.env.RAZORPAY_KEY_SECRET || '';
    const expected = crypto.createHmac('sha256', secret)
      .update(`${body.razorpay_order_id}|${body.razorpay_payment_id}`)
      .digest('hex');
    if (expected !== body.razorpay_signature) throw new AppError('Payment verification failed', 400);

    const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
    if (!student) throw new AppError('Student not found', 404);

    const invoice = await prisma.feeInvoice.findUnique({ where: { id: body.invoiceId } });
    if (!invoice) throw new AppError('Invoice not found', 404);
    if (invoice.studentId !== student.id) throw new AppError('Access denied', 403);

    const existing = await prisma.feePayment.findUnique({ where: { transactionRef: body.razorpay_payment_id } });
    if (existing) throw new AppError('Payment already recorded', 409);

    const payment = await prisma.$transaction(async tx => {
      const p = await tx.feePayment.create({
        data: {
          invoiceId: body.invoiceId,
          amount: body.amount,
          paymentMethod: 'Razorpay',
          transactionRef: body.razorpay_payment_id,
          receiptNumber: generateReceiptNumber(),
          notes: `Order: ${body.razorpay_order_id}`,
          recordedBy: req.user!.id,
        },
      });
      const newPaid = Number(invoice.paidAmount) + body.amount;
      const netDue = Number(invoice.totalAmount) - Number(invoice.discount ?? 0);
      const status = newPaid >= netDue - 0.01 ? 'PAID' : 'PARTIAL';
      await tx.feeInvoice.update({ where: { id: body.invoiceId }, data: { paidAmount: newPaid, status } });
      return p;
    });

    await createAuditLog({ userId: req.user!.id, action: 'RAZORPAY_PAYMENT', resource: 'FeePayment', resourceId: payment.id, details: { amount: body.amount, invoiceId: body.invoiceId, razorpayPaymentId: body.razorpay_payment_id } });
    res.status(201).json({ success: true, data: payment });
  } catch (err) { next(err); }
});

// ── Payments ──────────────────────────────────────────────────────────────────
router.post('/payments', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = paymentSchema.parse(req.body);

    // Idempotency: check transactionRef uniqueness
    if (body.transactionRef) {
      const existing = await prisma.feePayment.findUnique({ where: { transactionRef: body.transactionRef } });
      if (existing) throw new AppError('Duplicate transaction reference', 409);
    }

    const invoice = await prisma.feeInvoice.findUnique({ where: { id: body.invoiceId } });
    if (!invoice) throw new AppError('Invoice not found', 404);

    const payment = await prisma.$transaction(async tx => {
      const p = await tx.feePayment.create({
        data: {
          invoiceId: body.invoiceId,
          amount: body.amount,
          paymentMethod: body.paymentMethod,
          transactionRef: body.transactionRef,
          receiptNumber: generateReceiptNumber(),
          notes: body.notes,
          recordedBy: req.user!.id,
        },
      });

      const newPaid = Number(invoice.paidAmount) + body.amount;
      const netDue = Number(invoice.totalAmount) - Number(invoice.discount);
      const status = newPaid >= netDue ? 'PAID' : newPaid > 0 ? 'PARTIAL' : 'PENDING';
      await tx.feeInvoice.update({ where: { id: body.invoiceId }, data: { paidAmount: newPaid, status } });
      return p;
    });

    await createAuditLog({ userId: req.user!.id, action: 'RECORD_PAYMENT', resource: 'FeePayment', resourceId: payment.id, details: { amount: body.amount, invoiceId: body.invoiceId } });
    res.status(201).json({ success: true, data: payment });
  } catch (err) { next(err); }
});

router.get('/payments', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = getPagination(req.query as any);
    const [total, data] = await prisma.$transaction([
      prisma.feePayment.count(),
      prisma.feePayment.findMany({ skip, take, orderBy: { paymentDate: 'desc' }, include: { invoice: { include: { student: { select: { firstName: true, lastName: true, admissionNumber: true } } } } } }),
    ]);
    res.json({ success: true, ...paginate(total, data, page, limit) });
  } catch (err) { next(err); }
});

export default router;
