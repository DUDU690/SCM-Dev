import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();
router.use(authenticate);

const schema = z.object({
  name: z.string().min(1).optional(),
  logo: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().optional(),
  tagline: z.string().optional(),
  principalName: z.string().optional(),
  establishedYear: z.number().int().optional(),
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.schoolSettings.findFirst();
    res.json({ success: true, data: settings });
  } catch (err) { next(err); }
});

router.put('/', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = schema.parse(req.body);
    const existing = await prisma.schoolSettings.findFirst();
    const settings = existing
      ? await prisma.schoolSettings.update({ where: { id: existing.id }, data: body })
      : await prisma.schoolSettings.create({ data: { name: body.name || 'School', ...body } as any });
    res.json({ success: true, data: settings });
  } catch (err) { next(err); }
});

export default router;
