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
  code: z.string().min(1),
  description: z.string().optional(),
});

const classSubjectSchema = z.object({
  classId: z.string(),
  subjectId: z.string(),
  facultyId: z.string().optional(),
});

// GET / — all authenticated
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subjects = await prisma.subject.findMany({
      orderBy: { name: 'asc' },
      include: { classSubjects: { include: { class: true, faculty: true } } },
    });
    res.json({ success: true, data: subjects });
  } catch (err) {
    next(err);
  }
});

// GET /:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subject = await prisma.subject.findUnique({
      where: { id: req.params.id },
      include: { classSubjects: { include: { class: true, faculty: true } } },
    });
    if (!subject) throw new AppError('Subject not found', 404);
    res.json({ success: true, data: subject });
  } catch (err) {
    next(err);
  }
});

// POST / — Admin only
router.post('/', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createSchema.parse(req.body);
    const subject = await prisma.subject.create({ data: body as any });
    await createAuditLog({ userId: req.user!.id, action: 'CREATE_SUBJECT', resource: 'Subject', resourceId: subject.id });
    res.status(201).json({ success: true, data: subject });
  } catch (err) {
    next(err);
  }
});

// PATCH /:id — Admin only
router.patch('/:id', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createSchema.partial().parse(req.body);
    const subject = await prisma.subject.update({ where: { id: req.params.id }, data: body });
    res.json({ success: true, data: subject });
  } catch (err) {
    next(err);
  }
});

// POST /class-subjects — Admin: assign subject to class with optional faculty
router.post('/class-subjects', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = classSubjectSchema.parse(req.body);
    const cs = await prisma.classSubject.upsert({
      where: { classId_subjectId: { classId: body.classId, subjectId: body.subjectId } },
      create: body as any,
      update: { facultyId: body.facultyId },
      include: { class: true, subject: true, faculty: true },
    });
    res.status(201).json({ success: true, data: cs });
  } catch (err) {
    next(err);
  }
});

// DELETE /class-subjects/:id — Admin only
router.delete('/class-subjects/:id', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.classSubject.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Assignment removed' });
  } catch (err) {
    next(err);
  }
});

export default router;
