import { Router, Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();
router.use(authenticate, authorize(Role.ADMIN));

// GET /students — student list report
router.get('/students', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.student.findMany({
      include: { enrollments: { where: { isActive: true }, include: { section: { include: { class: true } }, academicYear: true } }, guardians: true },
      orderBy: { firstName: 'asc' },
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// GET /attendance — attendance summary
router.get('/attendance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { academicYearId, sectionId } = req.query as Record<string, string>;
    const where: any = {};
    if (sectionId) where.sectionId = sectionId;
    const attendances = await prisma.attendance.findMany({ where, include: { records: true, section: { include: { class: true } } }, orderBy: { date: 'desc' }, take: 100 });
    res.json({ success: true, data: attendances });
  } catch (err) { next(err); }
});

// GET /fees — fee collection report
router.get('/fees', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await prisma.feeInvoice.aggregate({ _sum: { totalAmount: true, paidAmount: true, discount: true }, _count: true });
    const byStatus = await prisma.feeInvoice.groupBy({ by: ['status'], _count: true, _sum: { totalAmount: true, paidAmount: true } });
    res.json({ success: true, data: { summary: stats, byStatus } });
  } catch (err) { next(err); }
});

// GET /admissions — admission report
router.get('/admissions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const byStatus = await prisma.admission.groupBy({ by: ['status'], _count: true });
    const recent = await prisma.admission.findMany({ orderBy: { createdAt: 'desc' }, take: 20, include: { class: true, academicYear: true } });
    res.json({ success: true, data: { byStatus, recent } });
  } catch (err) { next(err); }
});

// GET /hostel — hostel occupancy
router.get('/hostel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.hostel.findMany({
      include: {
        blocks: {
          include: {
            rooms: {
              include: {
                _count: { select: { allocations: true } },
                allocations: { where: { isActive: true }, include: { student: { select: { firstName: true, lastName: true } } } },
              },
            },
          },
        },
      },
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

export default router;
