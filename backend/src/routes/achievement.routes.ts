import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Role, PublicationStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { getPagination, paginate } from '../utils/pagination';

const router = Router();
router.use(authenticate);

const schema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  studentName: z.string().min(1),
  date: z.string(),
  photoUrl: z.string().optional(),
  status: z.nativeEnum(PublicationStatus).optional(),
  consentGiven: z.boolean().optional(),
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = getPagination(req.query as any);
    const where: any = {};
    if (req.user!.role === Role.STUDENT) { where.status = PublicationStatus.PUBLISHED; where.consentGiven = true; }
    const [total, data] = await prisma.$transaction([
      prisma.achievement.count({ where }),
      prisma.achievement.findMany({ where, skip, take, orderBy: { date: 'desc' } }),
    ]);
    res.json({ success: true, ...paginate(total, data, page, limit) });
  } catch (err) { next(err); }
});

router.post('/', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = schema.parse(req.body);
    const a = await prisma.achievement.create({ data: { ...body, date: new Date(body.date) } as any });
    res.status(201).json({ success: true, data: a });
  } catch (err) { next(err); }
});

router.patch('/:id', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = schema.partial().parse(req.body);
    const a = await prisma.achievement.update({ where: { id: req.params.id }, data: { ...body, date: body.date ? new Date(body.date) : undefined } });
    res.json({ success: true, data: a });
  } catch (err) { next(err); }
});

router.delete('/:id', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.achievement.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
});

export default router;
