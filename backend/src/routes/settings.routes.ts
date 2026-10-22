import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();
router.use(authenticate);

const schoolSchema = z.object({
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

const paymentSchema = z.object({
  razorpayKeyId: z.string().optional(),
  razorpayKeySecret: z.string().optional(),
  razorpayMode: z.enum(['test', 'live']).optional(),
  upiId: z.string().optional(),
  upiName: z.string().optional(),
});

async function upsertSettings(data: Record<string, unknown>) {
  const existing = await prisma.schoolSettings.findFirst();
  return existing
    ? prisma.schoolSettings.update({ where: { id: existing.id }, data: data as any })
    : prisma.schoolSettings.create({ data: { name: (data.name as string) || 'School', id: 'singleton', ...data } as any });
}

// GET / — school info (all authenticated)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.schoolSettings.findFirst({
      select: {
        id: true, name: true, logo: true, address: true, phone: true,
        email: true, website: true, tagline: true, principalName: true,
        establishedYear: true, updatedAt: true,
      },
    });
    res.json({ success: true, data: settings });
  } catch (err) { next(err); }
});

// PUT / or PATCH / — update school info (admin)
router.put('/', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = schoolSchema.parse(req.body);
    const settings = await upsertSettings(body);
    res.json({ success: true, data: settings });
  } catch (err) { next(err); }
});

router.patch('/', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = schoolSchema.parse(req.body);
    const settings = await upsertSettings(body);
    res.json({ success: true, data: settings });
  } catch (err) { next(err); }
});

// GET /payment — return payment config (key ID + mode + UPI, never secret); admin-only for keys, all auth for UPI
router.get('/payment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.schoolSettings.findFirst({
      select: { razorpayKeyId: true, razorpayMode: true, upiId: true, upiName: true },
    });
    const keyId = settings?.razorpayKeyId || process.env.RAZORPAY_KEY_ID || '';
    const mode = settings?.razorpayMode || 'test';
    const configured = keyId.startsWith('rzp_') && !keyId.includes('XXXX');
    const isAdmin = req.user?.role === Role.ADMIN;
    res.json({
      success: true,
      data: {
        ...(isAdmin ? { razorpayKeyId: keyId, razorpayMode: mode, configured } : {}),
        upiId: settings?.upiId || '',
        upiName: settings?.upiName || '',
        razorpayEnabled: configured,
      },
    });
  } catch (err) { next(err); }
});

// PATCH /payment — save Razorpay keys (admin only)
router.patch('/payment', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = paymentSchema.parse(req.body);
    await upsertSettings(body);
    res.json({ success: true, message: 'Payment settings saved' });
  } catch (err) { next(err); }
});

export default router;
