import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';
import { getPagination, paginate } from '../utils/pagination';
import { createAuditLog } from '../utils/auditLog';

const router = Router();
router.use(authenticate);

const createSchema = z.object({
  academicYearId: z.string(),
  termId: z.string().optional(),
  classId: z.string(),
  name: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
});

const examSubjectSchema = z.object({
  subjectId: z.string(),
  maxMarks: z.number().int().positive(),
  passingMarks: z.number().int().positive(),
  examDate: z.string().optional(),
  duration: z.number().int().positive().optional(),
});

// GET / — All: list (students only see published)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = getPagination(req.query as any);
    const academicYearId = req.query.academicYearId as string | undefined;
    const classId = req.query.classId as string | undefined;

    const where: any = {};
    if (academicYearId) where.academicYearId = academicYearId;
    if (classId) where.classId = classId;
    if (req.user!.role === Role.STUDENT) where.isPublished = true;

    const [total, data] = await prisma.$transaction([
      prisma.examination.count({ where }),
      prisma.examination.findMany({
        where, skip, take,
        orderBy: { startDate: 'desc' },
        include: { class: true, academicYear: true, subjects: { include: { subject: true } } },
      }),
    ]);

    res.json({ success: true, ...paginate(total, data, page, limit) });
  } catch (err) {
    next(err);
  }
});

// GET /:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exam = await prisma.examination.findUnique({
      where: { id: req.params.id },
      include: { class: true, academicYear: true, term: true, subjects: { include: { subject: true } } },
    });
    if (!exam) throw new AppError('Examination not found', 404);
    if (req.user!.role === Role.STUDENT && !exam.isPublished) throw new AppError('Results not published yet', 403);
    res.json({ success: true, data: exam });
  } catch (err) {
    next(err);
  }
});

// POST / — Admin only
router.post('/', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createSchema.parse(req.body);
    const exam = await prisma.examination.create({
      data: { ...body, startDate: new Date(body.startDate), endDate: new Date(body.endDate) } as any,
      include: { class: true, academicYear: true },
    });
    await createAuditLog({ userId: req.user!.id, action: 'CREATE_EXAMINATION', resource: 'Examination', resourceId: exam.id });
    res.status(201).json({ success: true, data: exam });
  } catch (err) {
    next(err);
  }
});

// PATCH /:id — Admin only, can't edit if published
router.patch('/:id', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.examination.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError('Examination not found', 404);
    if (existing.isPublished) throw new AppError('Cannot edit a published examination', 400);

    const body = createSchema.partial().parse(req.body);
    const exam = await prisma.examination.update({
      where: { id: req.params.id },
      data: {
        ...body,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
      },
    });
    res.json({ success: true, data: exam });
  } catch (err) {
    next(err);
  }
});

// POST /:id/subjects — Admin: add examination subject
router.post('/:id/subjects', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = examSubjectSchema.parse(req.body);
    const es = await prisma.examinationSubject.create({
      data: {
        examinationId: req.params.id,
        ...body,
        examDate: body.examDate ? new Date(body.examDate) : undefined,
      } as any,
      include: { subject: true },
    });
    res.status(201).json({ success: true, data: es });
  } catch (err) {
    next(err);
  }
});

// POST /:id/publish — Admin: publish results
router.post('/:id/publish', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exam = await prisma.examination.update({
      where: { id: req.params.id },
      data: { isPublished: true, publishedAt: new Date() },
    });
    await createAuditLog({ userId: req.user!.id, action: 'PUBLISH_EXAMINATION', resource: 'Examination', resourceId: exam.id });
    res.json({ success: true, data: exam });
  } catch (err) {
    next(err);
  }
});

// GET /:id/report-cards — Admin/Faculty
router.get('/:id/report-cards', authorize(Role.ADMIN, Role.FACULTY), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exam = await prisma.examination.findUnique({
      where: { id: req.params.id },
      include: { subjects: { include: { subject: true } } },
    });
    if (!exam) throw new AppError('Examination not found', 404);

    const marks = await prisma.mark.findMany({
      where: { examinationId: req.params.id },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
        subject: true,
      },
    });

    // Group by student
    const studentMap = new Map<string, { student: any; subjects: any[] }>();
    for (const m of marks) {
      const key = m.studentId;
      if (!studentMap.has(key)) studentMap.set(key, { student: m.student, subjects: [] });
      studentMap.get(key)!.subjects.push({ subject: m.subject, marksObtained: m.marksObtained, grade: m.grade, remarks: m.remarks });
    }

    const reportCards = Array.from(studentMap.values());
    res.json({ success: true, data: reportCards });
  } catch (err) {
    next(err);
  }
});

export default router;
