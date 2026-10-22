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

const createStudentSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  gender: z.nativeEnum(Gender).optional(),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
  bloodGroup: z.string().optional(),
  nationality: z.string().optional(),
  guardian: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    relationship: z.string().min(1),
    phone: z.string().min(1),
    email: z.string().email().optional(),
    occupation: z.string().optional(),
    address: z.string().optional(),
  }),
  sectionId: z.string().optional(),
  academicYearId: z.string().optional(),
  rollNumber: z.string().optional(),
});

const updateStudentSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  gender: z.nativeEnum(Gender).optional(),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
  bloodGroup: z.string().optional(),
  nationality: z.string().optional(),
});

const enrollSchema = z.object({
  sectionId: z.string(),
  academicYearId: z.string(),
  rollNumber: z.string().optional(),
});

function generateAdmissionNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `ADM${year}${rand}`;
}

// GET / — list students (role-aware)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = getPagination(req.query as any);
    const search = req.query.search as string | undefined;
    const sectionId = req.query.sectionId as string | undefined;
    const academicYearId = req.query.academicYearId as string | undefined;

    let where: any = {};

    if (req.user!.role === Role.FACULTY) {
      const faculty = await prisma.faculty.findUnique({ where: { userId: req.user!.id } });
      if (!faculty) throw new AppError('Faculty profile not found', 404);
      // Get sections where this faculty teaches
      const slots = await prisma.timetableSlot.findMany({ where: { facultyId: faculty.id }, select: { sectionId: true }, distinct: ['sectionId'] });
      const sectionIds = slots.map(s => s.sectionId);
      where.enrollments = { some: { sectionId: { in: sectionIds }, isActive: true } };
    } else if (req.user!.role === Role.STUDENT) {
      const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
      if (!student) throw new AppError('Student profile not found', 404);
      where.id = student.id;
    }

    if (sectionId) where.enrollments = { ...where.enrollments, some: { ...(where.enrollments?.some || {}), sectionId } };
    if (academicYearId) where.enrollments = { ...where.enrollments, some: { ...(where.enrollments?.some || {}), academicYearId } };
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { admissionNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Two-step active-user filter (MongoDB doesn't support relation where filters)
    const activeUserIds = await prisma.user.findMany({
      where: { isActive: true, role: Role.STUDENT },
      select: { id: true },
    }).then(us => us.map(u => u.id));
    where.userId = { in: activeUserIds };

    const [total, data] = await prisma.$transaction([
      prisma.student.count({ where }),
      prisma.student.findMany({
        where, skip, take,
        orderBy: { firstName: 'asc' },
        include: {
          user: { select: { email: true, isActive: true } },
          guardians: true,
          enrollments: {
            where: { isActive: true },
            include: { section: { include: { class: true } }, academicYear: true },
          },
        },
      }),
    ]);

    res.json({ success: true, ...paginate(total, data, page, limit) });
  } catch (err) {
    next(err);
  }
});

// POST /me/photo — Student: upload own profile picture
router.post('/me/photo', authorize(Role.STUDENT), (req: Request, res: Response, next: NextFunction) => {
  uploadAvatar.single('photo')(req, res, async (err) => {
    if (err) return next(err);
    try {
      if (!req.file) throw new AppError('No file uploaded', 400);
      const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
      if (!student) throw new AppError('Student not found', 404);

      // Delete old avatar file from disk if it exists
      const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
      if (student.photoUrl?.startsWith('/uploads/')) {
        const old = path.join(UPLOAD_DIR, student.photoUrl.replace('/uploads/', ''));
        if (fs.existsSync(old)) fs.unlinkSync(old);
      }

      const photoUrl = `/uploads/avatars/${req.file.filename}`;
      await prisma.student.update({ where: { id: student.id }, data: { photoUrl } });
      res.json({ success: true, data: { photoUrl } });
    } catch (e) { next(e); }
  });
});

// GET /:id — single student
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      include: {
        guardians: true,
        enrollments: { include: { section: { include: { class: true } }, academicYear: true } },
        user: { select: { email: true, isActive: true } },
        feeInvoices: { orderBy: { createdAt: 'desc' as const }, take: 10 },
      },
    });
    if (!student) throw new AppError('Student not found', 404);

    if (req.user!.role === Role.STUDENT) {
      const own = await prisma.student.findUnique({ where: { userId: req.user!.id } });
      if (!own || own.id !== student.id) throw new AppError('Access denied', 403);
    } else if (req.user!.role === Role.FACULTY) {
      const faculty = await prisma.faculty.findUnique({ where: { userId: req.user!.id } });
      if (!faculty) throw new AppError('Faculty profile not found', 404);
      const slots = await prisma.timetableSlot.findMany({ where: { facultyId: faculty.id }, select: { sectionId: true }, distinct: ['sectionId'] });
      const sectionIds = new Set(slots.map(s => s.sectionId));
      const enrolled = student.enrollments.some(e => sectionIds.has(e.sectionId));
      if (!enrolled) throw new AppError('Access denied', 403);
    }

    res.json({ success: true, data: student });
  } catch (err) {
    next(err);
  }
});

// POST / — Admin: create student + user
router.post('/', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createStudentSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (existing) throw new AppError('Email already in use', 409);

    const tempPassword = Math.random().toString(36).slice(-8) + 'A1';
    const passwordHash = await hashPassword(tempPassword);
    const admissionNumber = generateAdmissionNumber();

    const result = await prisma.$transaction(async tx => {
      const user = await tx.user.create({ data: { email: body.email.toLowerCase(), passwordHash, role: Role.STUDENT } });
      const student = await tx.student.create({
        data: {
          userId: user.id,
          admissionNumber,
          firstName: body.firstName,
          lastName: body.lastName,
          phone: body.phone,
          gender: body.gender,
          dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
          address: body.address,
          bloodGroup: body.bloodGroup,
          nationality: body.nationality,
          guardians: { create: body.guardian as any },
        },
        include: { guardians: true },
      });

      if (body.sectionId && body.academicYearId) {
        await tx.studentEnrollment.create({
          data: { studentId: student.id, sectionId: body.sectionId, academicYearId: body.academicYearId, rollNumber: body.rollNumber },
        });
      }

      return { user: { id: user.id, email: user.email }, student };
    });

    await createAuditLog({ userId: req.user!.id, action: 'CREATE_STUDENT', resource: 'Student', resourceId: result.student.id });
    res.status(201).json({ success: true, data: result, tempPassword });
  } catch (err) {
    next(err);
  }
});

// PATCH /:id — Admin: update student
router.patch('/:id', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = updateStudentSchema.parse(req.body);
    const student = await prisma.student.update({
      where: { id: req.params.id },
      data: { ...body, dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined },
    });
    await createAuditLog({ userId: req.user!.id, action: 'UPDATE_STUDENT', resource: 'Student', resourceId: student.id });
    res.json({ success: true, data: student });
  } catch (err) {
    next(err);
  }
});

// DELETE /:id — Admin: soft-delete student (deactivates login account)
router.delete('/:id', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const student = await prisma.student.findUnique({ where: { id: req.params.id } });
    if (!student) throw new AppError('Student not found', 404);
    await prisma.user.update({ where: { id: student.userId }, data: { isActive: false } });
    await createAuditLog({ userId: req.user!.id, action: 'DELETE_STUDENT', resource: 'Student', resourceId: student.id });
    res.json({ success: true, message: 'Student deactivated' });
  } catch (err) { next(err); }
});

// POST /:id/enroll — Admin: enroll student
router.post('/:id/enroll', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = enrollSchema.parse(req.body);
    // Deactivate previous enrollment for same academic year
    await prisma.studentEnrollment.updateMany({
      where: { studentId: req.params.id, academicYearId: body.academicYearId },
      data: { isActive: false },
    });
    const enrollment = await prisma.studentEnrollment.create({
      data: { studentId: req.params.id, sectionId: body.sectionId, academicYearId: body.academicYearId, rollNumber: body.rollNumber },
      include: { section: { include: { class: true } }, academicYear: true },
    });
    res.status(201).json({ success: true, data: enrollment });
  } catch (err) {
    next(err);
  }
});

export default router;
