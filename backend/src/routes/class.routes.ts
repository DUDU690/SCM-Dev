import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';
import { createAuditLog } from '../utils/auditLog';

const router = Router();
router.use(authenticate);

const createClassSchema = z.object({
  name: z.string().min(1),
  academicYearId: z.string(),
});

const sectionSchema = z.object({
  name: z.string().min(1),
  capacity: z.coerce.number().int().positive().optional(),
});

// GET / — all authenticated, with sections
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const academicYearId = req.query.academicYearId as string | undefined;
    const where: any = {};
    if (academicYearId) where.academicYearId = academicYearId;

    const classes = await prisma.class.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        sections: true,
        academicYear: true,
        _count: { select: { sections: true } },
      },
    });
    res.json({ success: true, data: classes });
  } catch (err) {
    next(err);
  }
});

// GET /:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cls = await prisma.class.findUnique({
      where: { id: req.params.id },
      include: {
        sections: { include: { _count: { select: { studentEnrollments: true } } } },
        academicYear: true,
        subjects: { include: { subject: true, faculty: true } },
      },
    });
    if (!cls) throw new AppError('Class not found', 404);
    res.json({ success: true, data: cls });
  } catch (err) {
    next(err);
  }
});

// POST / — Admin only
router.post('/', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createClassSchema.parse(req.body);
    const cls = await prisma.class.create({
      data: body as any,
      include: { academicYear: true },
    });
    await createAuditLog({ userId: req.user!.id, action: 'CREATE_CLASS', resource: 'Class', resourceId: cls.id });
    res.status(201).json({ success: true, data: cls });
  } catch (err) {
    next(err);
  }
});

// PATCH /:id — Admin only
router.patch('/:id', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createClassSchema.partial().parse(req.body);
    const cls = await prisma.class.update({ where: { id: req.params.id }, data: body });
    res.json({ success: true, data: cls });
  } catch (err) {
    next(err);
  }
});

// POST /:id/sections — Admin: add section
router.post('/:id/sections', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = sectionSchema.parse(req.body);
    const section = await prisma.section.create({
      data: { classId: req.params.id, ...body } as any,
    });
    res.status(201).json({ success: true, data: section });
  } catch (err) {
    next(err);
  }
});

// PATCH /:id/sections/:sectionId — Admin: update section
router.patch('/:id/sections/:sectionId', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = sectionSchema.partial().parse(req.body);
    const section = await prisma.section.update({ where: { id: req.params.sectionId }, data: body });
    res.json({ success: true, data: section });
  } catch (err) {
    next(err);
  }
});

export default router;
