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
  description: z.string().optional(),
  venue: z.string().optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  status: z.nativeEnum(PublicationStatus).optional(),
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = getPagination(req.query as any);
    const where: any = {};
    if (req.user!.role === Role.STUDENT) where.status = PublicationStatus.PUBLISHED;
    const [total, data] = await prisma.$transaction([
      prisma.event.count({ where }),
      prisma.event.findMany({ where, skip, take, orderBy: { startDate: 'asc' } }),
    ]);
    res.json({ success: true, ...paginate(total, data, page, limit) });
  } catch (err) { next(err); }
});

router.post('/', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = schema.parse(req.body);
    const ev = await prisma.event.create({ data: { ...body, startDate: new Date(body.startDate), endDate: body.endDate ? new Date(body.endDate) : undefined } as any });
    res.status(201).json({ success: true, data: ev });
  } catch (err) { next(err); }
});

router.patch('/:id', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = schema.partial().parse(req.body);
    const ev = await prisma.event.update({ where: { id: req.params.id }, data: { ...body, startDate: body.startDate ? new Date(body.startDate) : undefined, endDate: body.endDate ? new Date(body.endDate) : undefined } });
    res.json({ success: true, data: ev });
  } catch (err) { next(err); }
});

router.delete('/:id', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.event.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
});

export default router;
