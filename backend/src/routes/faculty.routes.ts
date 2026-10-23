import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Role, Gender } from '@prisma/client';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';
import { getPagination, paginate } from '../utils/pagination';
import { hashPassword } from '../services/auth.service';
import { createAuditLog } from '../utils/auditLog';
import { uploadAvatar } from '../middlewares/upload.middleware';
import path from 'path';
import fs from 'fs';

const router = Router();
router.use(authenticate);

const createFacultySchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  gender: z.nativeEnum(Gender).optional(),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
  qualification: z.string().optional(),
  joiningDate: z.string().optional(),
  designation: z.string().optional(),
});

const updateFacultySchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  gender: z.nativeEnum(Gender).optional(),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
  qualification: z.string().optional(),
  designation: z.string().optional(),
});

function generateEmployeeId(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `EMP${year}${rand}`;
}

// GET / — list faculty (Admin only)
router.get('/', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = getPagination(req.query as any);
    const search = req.query.search as string | undefined;

    const where: any = {};
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } },
        { designation: { contains: search, mode: 'insensitive' } },
      ];
    }

    const activeUserIds = await prisma.user.findMany({
      where: { isActive: true, role: Role.FACULTY },
      select: { id: true },
    }).then(us => us.map(u => u.id));
    where.userId = { in: activeUserIds };

    const [total, data] = await prisma.$transaction([
      prisma.faculty.count({ where }),
      prisma.faculty.findMany({
        where, skip, take,
        orderBy: { firstName: 'asc' },
        include: {
          user: { select: { email: true, isActive: true } },
          classSubjects: { include: { class: true, subject: true } },
        },
      }),
    ]);

    res.json({ success: true, ...paginate(total, data, page, limit) });
  } catch (err) {
    next(err);
  }
});

// GET /my-sections — Faculty: sections where they have timetable slots
router.get('/my-sections', authorize(Role.FACULTY), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const faculty = await prisma.faculty.findUnique({ where: { userId: req.user!.id } });
    if (!faculty) throw new AppError('Faculty not found', 404);
    const slots = await prisma.timetableSlot.findMany({ where: { facultyId: faculty.id }, select: { sectionId: true }, distinct: ['sectionId'] });
    const sectionIds = slots.map(s => s.sectionId);
    const sections = await prisma.section.findMany({ where: { id: { in: sectionIds } }, include: { class: true }, orderBy: { name: 'asc' } });
    res.json({ success: true, data: sections });
  } catch (err) { next(err); }
});

// GET /:id — single faculty
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const faculty = await prisma.faculty.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { email: true, isActive: true, lastLoginAt: true } },
        classSubjects: { include: { class: true, subject: true } },
        leaveRequests: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!faculty) throw new AppError('Faculty not found', 404);

    if (req.user!.role === Role.FACULTY) {
      const own = await prisma.faculty.findUnique({ where: { userId: req.user!.id } });
      if (!own || own.id !== faculty.id) throw new AppError('Access denied', 403);
    }

    res.json({ success: true, data: faculty });
  } catch (err) {
    next(err);
  }
});

// POST / — Admin: create faculty + user
router.post('/', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createFacultySchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (existing) throw new AppError('Email already in use', 409);

    const tempPassword = Math.random().toString(36).slice(-8) + 'B2';
    const passwordHash = await hashPassword(tempPassword);
    const employeeId = generateEmployeeId();

    const result = await prisma.$transaction(async tx => {
      const user = await tx.user.create({ data: { email: body.email.toLowerCase(), passwordHash, role: Role.FACULTY } });
      const faculty = await tx.faculty.create({
        data: {
          userId: user.id,
          employeeId,
          firstName: body.firstName,
          lastName: body.lastName,
          phone: body.phone,
          gender: body.gender,
          dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
          address: body.address,
          qualification: body.qualification,
          joiningDate: body.joiningDate ? new Date(body.joiningDate) : undefined,
          designation: body.designation,
        },
      });
      return { user: { id: user.id, email: user.email }, faculty };
    });

    await createAuditLog({ userId: req.user!.id, action: 'CREATE_FACULTY', resource: 'Faculty', resourceId: result.faculty.id });
    res.status(201).json({ success: true, data: result, tempPassword });
  } catch (err) {
    next(err);
  }
});

// PATCH /:id — Admin: any; Faculty: own only
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const faculty = await prisma.faculty.findUnique({ where: { id: req.params.id } });
    if (!faculty) throw new AppError('Faculty not found', 404);

    if (req.user!.role === Role.FACULTY) {
      const own = await prisma.faculty.findUnique({ where: { userId: req.user!.id } });
      if (!own || own.id !== faculty.id) throw new AppError('Access denied', 403);
    } else if (req.user!.role !== Role.ADMIN) {
      throw new AppError('Access denied', 403);
    }

    const body = updateFacultySchema.parse(req.body);
    const updated = await prisma.faculty.update({
      where: { id: req.params.id },
      data: { ...body, dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined },
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// POST /me/photo — Faculty: upload own profile picture
router.post('/me/photo', authorize(Role.FACULTY), (req: Request, res: Response, next: NextFunction) => {
  uploadAvatar.single('photo')(req, res, async (err) => {
    try {
      if (err) throw new AppError(err.message, 400);
      if (!req.file) throw new AppError('No file uploaded', 400);
      const faculty = await prisma.faculty.findUnique({ where: { userId: req.user!.id } });
      if (!faculty) throw new AppError('Faculty not found', 404);
      const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
      if (faculty.photoUrl?.startsWith('/uploads/')) {
        const old = path.join(UPLOAD_DIR, faculty.photoUrl.replace('/uploads/', ''));
        if (fs.existsSync(old)) fs.unlinkSync(old);
      }
      const photoUrl = `/uploads/avatars/${req.file.filename}`;
      await prisma.faculty.update({ where: { id: faculty.id }, data: { photoUrl } });
      res.json({ success: true, data: { photoUrl } });
    } catch (e) { next(e); }
  });
});

// DELETE /:id — Admin: soft-delete faculty (deactivates login account)
router.delete('/:id', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const faculty = await prisma.faculty.findUnique({ where: { id: req.params.id } });
    if (!faculty) throw new AppError('Faculty not found', 404);
    await prisma.user.update({ where: { id: faculty.userId }, data: { isActive: false } });
    await createAuditLog({ userId: req.user!.id, action: 'DELETE_FACULTY', resource: 'Faculty', resourceId: faculty.id });
    res.json({ success: true, message: 'Faculty deactivated' });
  } catch (err) { next(err); }
});

export default router;
