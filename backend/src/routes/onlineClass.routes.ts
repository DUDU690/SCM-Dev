import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';

const router = Router();
router.use(authenticate);

const schema = z.object({
  title: z.string().min(1),
  subjectId: z.string(),
  meetingLink: z.string().url(),
  scheduledAt: z.string(),
  duration: z.number().int().positive(),
  description: z.string().optional(),
  isPublished: z.boolean().optional(),
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where: any = {};
    if (req.user!.role === Role.STUDENT) where.isPublished = true;
    if (req.user!.role === Role.FACULTY) {
      const f = await prisma.faculty.findUnique({ where: { userId: req.user!.id } });
      if (f) where.facultyId = f.id;
    }
    const data = await prisma.onlineClass.findMany({ where, orderBy: { scheduledAt: 'desc' }, include: { subject: true, faculty: { select: { firstName: true, lastName: true } } } });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/', authorize(Role.ADMIN, Role.FACULTY), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = schema.parse(req.body);
    let facultyId: string;
    if (req.user!.role === Role.FACULTY) {
      const f = await prisma.faculty.findUnique({ where: { userId: req.user!.id } });
      if (!f) throw new AppError('Faculty not found', 404);
      facultyId = f.id;
    } else {
      const f = await prisma.faculty.findFirst();
      if (!f) throw new AppError('No faculty', 400);
      facultyId = f.id;
    }
    const oc = await prisma.onlineClass.create({ data: { ...body, facultyId, scheduledAt: new Date(body.scheduledAt) } as any });
    res.status(201).json({ success: true, data: oc });
  } catch (err) { next(err); }
});

router.patch('/:id', authorize(Role.ADMIN, Role.FACULTY), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = schema.partial().parse(req.body);
    const oc = await prisma.onlineClass.update({ where: { id: req.params.id }, data: { ...body, scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined } });
    res.json({ success: true, data: oc });
  } catch (err) { next(err); }
});

router.delete('/:id', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.onlineClass.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
});

export default router;
