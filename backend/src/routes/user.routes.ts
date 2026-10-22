import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';
import { getPagination, paginate } from '../utils/pagination';
import { hashPassword } from '../services/auth.service';
import { createAuditLog } from '../utils/auditLog';

const router = Router();
router.use(authenticate, authorize(Role.ADMIN));

const createUserSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(Role),
  password: z.string().min(8).optional(),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  isActive: z.boolean().optional(),
});

// GET / — list all users, paginated, filterable by role
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = getPagination(req.query as any);
    const role = req.query.role as Role | undefined;
    const search = req.query.search as string | undefined;

    const where: any = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { student: { OR: [{ firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }] } },
        { faculty: { OR: [{ firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }] } },
      ];
    }

    const [total, data] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true,
          student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true, photoUrl: true } },
          faculty: { select: { id: true, firstName: true, lastName: true, employeeId: true, designation: true, photoUrl: true } },
        },
      }),
    ]);

    res.json({ success: true, ...paginate(total, data, page, limit) });
  } catch (err) {
    next(err);
  }
});

// GET /:id — single user
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true,
        student: { include: { guardians: true, enrollments: { include: { section: { include: { class: true } }, academicYear: true } } } },
        faculty: { include: { classSubjects: { include: { class: true, subject: true } } } },
      },
    });
    if (!user) throw new AppError('User not found', 404);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// POST / — create user
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createUserSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (existing) throw new AppError('Email already in use', 409);

    const tempPassword = body.password || Math.random().toString(36).slice(-10) + 'A1';
    const passwordHash = await hashPassword(tempPassword);

    const user = await prisma.user.create({
      data: { email: body.email.toLowerCase(), passwordHash, role: body.role },
      select: { id: true, email: true, role: true, isActive: true, createdAt: true },
    });

    await createAuditLog({ userId: req.user!.id, action: 'CREATE_USER', resource: 'User', resourceId: user.id });

    res.status(201).json({ success: true, data: user, tempPassword });
  } catch (err) {
    next(err);
  }
});

// PATCH /:id — update user
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = updateUserSchema.parse(req.body);
    if (body.email) {
      const existing = await prisma.user.findFirst({ where: { email: body.email.toLowerCase(), NOT: { id: req.params.id } } });
      if (existing) throw new AppError('Email already in use', 409);
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { ...(body.email ? { email: body.email.toLowerCase() } : {}), ...(body.isActive !== undefined ? { isActive: body.isActive } : {}) },
      select: { id: true, email: true, role: true, isActive: true },
    });
    await createAuditLog({ userId: req.user!.id, action: 'UPDATE_USER', resource: 'User', resourceId: user.id, details: body });
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// DELETE /:id — deactivate
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.params.id === req.user!.id) throw new AppError('Cannot deactivate your own account', 400);
    await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
    await createAuditLog({ userId: req.user!.id, action: 'DEACTIVATE_USER', resource: 'User', resourceId: req.params.id });
    res.json({ success: true, message: 'User deactivated' });
  } catch (err) {
    next(err);
  }
});

export default router;
