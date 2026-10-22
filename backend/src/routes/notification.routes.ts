import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { getPagination, paginate } from '../utils/pagination';

const router = Router();
router.use(authenticate);

const sendSchema = z.object({
  userIds: z.array(z.string()).min(1),
  title: z.string().min(1),
  message: z.string().min(1),
  type: z.string().min(1),
  link: z.string().optional(),
});

// GET / — current user's notifications
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = getPagination(req.query as any);
    const [total, data] = await prisma.$transaction([
      prisma.notification.count({ where: { userId: req.user!.id } }),
      prisma.notification.findMany({ where: { userId: req.user!.id }, skip, take, orderBy: { createdAt: 'desc' } }),
    ]);
    res.json({ success: true, ...paginate(total, data, page, limit) });
  } catch (err) { next(err); }
});

// PATCH /:id/read — mark as read
router.patch('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.user!.id }, data: { isRead: true } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// PATCH /read-all — mark all as read
router.patch('/read-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.updateMany({ where: { userId: req.user!.id, isRead: false }, data: { isRead: true } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /send — Admin: send notifications
router.post('/send', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = sendSchema.parse(req.body);
    await prisma.notification.createMany({
      data: body.userIds.map(userId => ({
        userId,
        senderId: req.user!.id,
        title: body.title,
        message: body.message,
        type: body.type,
        link: body.link,
      })),
    });
    res.json({ success: true, message: `Sent to ${body.userIds.length} users` });
  } catch (err) { next(err); }
});

export default router;
