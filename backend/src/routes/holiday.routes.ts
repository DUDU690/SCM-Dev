import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';

const router = Router();
router.use(authenticate);

const schema = z.object({
  academicYearId: z.string(),
  name: z.string().min(1),
  date: z.string(),
  description: z.string().optional(),
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const academicYearId = req.query.academicYearId as string | undefined;
    const holidays = await prisma.holiday.findMany({
      where: academicYearId ? { academicYearId } : {},
      orderBy: { date: 'asc' },
      include: { academicYear: true },
    });
    res.json({ success: true, data: holidays });
  } catch (err) { next(err); }
});

router.post('/', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = schema.parse(req.body);
    const holiday = await prisma.holiday.create({ data: { ...body, date: new Date(body.date) } as any });
    res.status(201).json({ success: true, data: holiday });
  } catch (err) { next(err); }
});

router.patch('/:id', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = schema.partial().parse(req.body);
    const holiday = await prisma.holiday.update({ where: { id: req.params.id }, data: { ...body, date: body.date ? new Date(body.date) : undefined } });
    res.json({ success: true, data: holiday });
  } catch (err) { next(err); }
});

router.delete('/:id', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.holiday.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Holiday deleted' });
  } catch (err) { next(err); }
});

export default router;
