import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Role, Gender, AdmissionStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';
import { getPagination, paginate } from '../utils/pagination';
import { createAuditLog } from '../utils/auditLog';

const router = Router();

const applySchema = z.object({
  academicYearId: z.string(),
  classId: z.string(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  gender: z.nativeEnum(Gender).optional(),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
  guardianName: z.string().min(1),
  guardianPhone: z.string().min(1),
  guardianEmail: z.string().email().optional(),
  guardianRelation: z.string().min(1),
});

const reviewSchema = z.object({
  status: z.nativeEnum(AdmissionStatus),
  reviewNotes: z.string().optional(),
});

function generateRef(): string {
  return `APP${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

// POST / — public: submit application
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = applySchema.parse(req.body);
    const admission = await prisma.admission.create({
      data: {
        ...body,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
        referenceNumber: generateRef(),
      } as any,
    });
    res.status(201).json({ success: true, data: { referenceNumber: admission.referenceNumber, id: admission.id } });
  } catch (err) { next(err); }
});

// GET / — Admin: list all admissions
router.get('/', authenticate, authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = getPagination(req.query as any);
    const status = req.query.status as AdmissionStatus | undefined;
    const where: any = {};
    if (status) where.status = status;
    const [total, data] = await prisma.$transaction([
      prisma.admission.count({ where }),
      prisma.admission.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: { class: true, academicYear: true, documents: true } }),
    ]);
    res.json({ success: true, ...paginate(total, data, page, limit) });
  } catch (err) { next(err); }
});

// GET /:ref — track by reference
router.get('/track/:ref', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admission = await prisma.admission.findUnique({
      where: { referenceNumber: req.params.ref },
      select: { referenceNumber: true, firstName: true, lastName: true, status: true, createdAt: true, reviewNotes: true },
    });
    if (!admission) throw new AppError('Application not found', 404);
    res.json({ success: true, data: admission });
  } catch (err) { next(err); }
});

// GET /:id — Admin: full detail
router.get('/:id', authenticate, authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admission = await prisma.admission.findUnique({
      where: { id: req.params.id },
      include: { class: true, academicYear: true, documents: true },
    });
    if (!admission) throw new AppError('Application not found', 404);
    res.json({ success: true, data: admission });
  } catch (err) { next(err); }
});

// PATCH /:id/review — Admin: approve/reject/waitlist
router.patch('/:id/review', authenticate, authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = reviewSchema.parse(req.body);
    const admission = await prisma.admission.update({
      where: { id: req.params.id },
      data: { status: body.status, reviewNotes: body.reviewNotes, reviewedBy: req.user!.id, reviewedAt: new Date() },
    });
    await createAuditLog({ userId: req.user!.id, action: 'REVIEW_ADMISSION', resource: 'Admission', resourceId: admission.id, details: { status: body.status } });
    res.json({ success: true, data: admission });
  } catch (err) { next(err); }
});

export default router;
