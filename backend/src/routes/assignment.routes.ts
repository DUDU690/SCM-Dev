import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';

const router = Router();
router.use(authenticate);

const schema = z.object({
  title: z.string().min(1),
  subjectId: z.string(),
  facultyId: z.string().optional(),
  description: z.string().min(1),
  dueDate: z.string(),
  maxMarks: z.number().int().positive().optional(),
  isPublished: z.boolean().optional(),
});

const submissionSchema = z.object({
  assignmentId: z.string(),
  notes: z.string().optional(),
});

// GET /student — Student: published assignments with own submission status
router.get('/student', authorize(Role.STUDENT), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
    if (!student) throw new AppError('Student not found', 404);
    const assignments = await prisma.assignment.findMany({
      where: { isPublished: true },
      orderBy: { dueDate: 'asc' },
      include: {
        subject: { select: { name: true } },
        faculty: { select: { firstName: true, lastName: true } },
        submissions: { where: { studentId: student.id } },
      },
    });
    const data = assignments.map(a => ({ ...a, submission: a.submissions[0] ?? null, submissions: undefined }));
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where: any = {};
    if (req.user!.role === Role.STUDENT) where.isPublished = true;
    if (req.user!.role === Role.FACULTY) {
      const f = await prisma.faculty.findUnique({ where: { userId: req.user!.id } });
      if (f) where.facultyId = f.id;
    }
    const data = await prisma.assignment.findMany({
      where, orderBy: { dueDate: 'asc' },
      include: { subject: true, faculty: { select: { id: true, firstName: true, lastName: true } }, submissions: { select: { id: true } } },
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/', authorize(Role.ADMIN, Role.FACULTY), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = schema.parse(req.body);
    let facultyId: string;
    if (req.user!.role === Role.FACULTY) {
      const f = await prisma.faculty.findUnique({ where: { userId: req.user!.id } });
      if (!f) throw new AppError('Faculty not found', 404);
      facultyId = f.id;
    } else if (body.facultyId) {
      facultyId = body.facultyId;
    } else {
      const f = await prisma.faculty.findFirst();
      if (!f) throw new AppError('No faculty found — please add faculty first', 400);
      facultyId = f.id;
    }
    const { facultyId: _fid, ...rest } = body;
    const a = await prisma.assignment.create({ data: { ...rest, facultyId, dueDate: new Date(body.dueDate) } as any });
    res.status(201).json({ success: true, data: a });
  } catch (err) { next(err); }
});

router.patch('/:id', authorize(Role.ADMIN, Role.FACULTY), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = schema.partial().parse(req.body);
    const { facultyId, ...rest } = body;
    const a = await prisma.assignment.update({
      where: { id: req.params.id },
      data: { ...rest, ...(facultyId ? { facultyId } : {}), dueDate: body.dueDate ? new Date(body.dueDate) : undefined },
    });
    res.json({ success: true, data: a });
  } catch (err) { next(err); }
});

router.delete('/:id', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.assignmentSubmission.deleteMany({ where: { assignmentId: req.params.id } });
    await prisma.assignment.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Assignment deleted' });
  } catch (err) { next(err); }
});

// GET /:id/submissions — Faculty/Admin
router.get('/:id/submissions', authorize(Role.ADMIN, Role.FACULTY), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subs = await prisma.assignmentSubmission.findMany({
      where: { assignmentId: req.params.id },
      include: { student: { select: { firstName: true, lastName: true, admissionNumber: true } } },
    });
    res.json({ success: true, data: subs });
  } catch (err) { next(err); }
});

// POST /submit — Student
router.post('/submit', authorize(Role.STUDENT), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = submissionSchema.parse(req.body);
    const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
    if (!student) throw new AppError('Student not found', 404);
    const sub = await prisma.assignmentSubmission.upsert({
      where: { assignmentId_studentId: { assignmentId: body.assignmentId, studentId: student.id } },
      create: { assignmentId: body.assignmentId, studentId: student.id, notes: body.notes },
      update: { notes: body.notes, submittedAt: new Date() },
    });
    res.status(201).json({ success: true, data: sub });
  } catch (err) { next(err); }
});

export default router;
