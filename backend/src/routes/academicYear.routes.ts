import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';
import { createAuditLog } from '../utils/auditLog';

const router = Router();
router.use(authenticate);

const createSchema = z.object({
  name: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  isCurrent: z.boolean().optional(),
});

const updateSchema = createSchema.partial();

// GET / — all authenticated
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const years = await prisma.academicYear.findMany({
      orderBy: { startDate: 'desc' },
      include: { terms: true, _count: { select: { classes: true } } },
    });
    res.json({ success: true, data: years });
  } catch (err) {
    next(err);
  }
});

// GET /:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const year = await prisma.academicYear.findUnique({
      where: { id: req.params.id },
      include: { terms: true, classes: { include: { sections: true } } },
    });
    if (!year) throw new AppError('Academic year not found', 404);
    res.json({ success: true, data: year });
  } catch (err) {
    next(err);
  }
});

// POST / — Admin only
router.post('/', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createSchema.parse(req.body);
    const year = await prisma.academicYear.create({
      data: { ...body, startDate: new Date(body.startDate), endDate: new Date(body.endDate) } as any,
    });
    await createAuditLog({ userId: req.user!.id, action: 'CREATE_ACADEMIC_YEAR', resource: 'AcademicYear', resourceId: year.id });
    res.status(201).json({ success: true, data: year });
  } catch (err) {
    next(err);
  }
});

// PATCH /:id — Admin only
router.patch('/:id', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = updateSchema.parse(req.body);
    const year = await prisma.academicYear.update({
      where: { id: req.params.id },
      data: {
        ...body,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
      },
    });
    res.json({ success: true, data: year });
  } catch (err) {
    next(err);
  }
});

// POST /:id/set-current — Admin: set as current year
router.post('/:id/set-current', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.$transaction([
      prisma.academicYear.updateMany({ data: { isCurrent: false } }),
      prisma.academicYear.update({ where: { id: req.params.id }, data: { isCurrent: true } }),
    ]);
    await createAuditLog({ userId: req.user!.id, action: 'SET_CURRENT_ACADEMIC_YEAR', resource: 'AcademicYear', resourceId: req.params.id });
    res.json({ success: true, message: 'Academic year set as current' });
  } catch (err) {
    next(err);
  }
});

export default router;
