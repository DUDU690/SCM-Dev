import { Router, Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { getPagination, paginate } from '../utils/pagination';

const router = Router();
router.use(authenticate, authorize(Role.ADMIN));

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = getPagination(req.query as any);
    const { userId, resource, action } = req.query as Record<string, string>;
    const where: any = {};
    if (userId) where.userId = userId;
    if (resource) where.resource = resource;
    if (action) where.action = { contains: action, mode: 'insensitive' };

    const [total, data] = await prisma.$transaction([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true, role: true } } },
      }),
    ]);
    res.json({ success: true, ...paginate(total, data, page, limit) });
  } catch (err) { next(err); }
});

export default router;
