import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';
import { createAuditLog } from '../utils/auditLog';

const router = Router();
router.use(authenticate);

const bulkMarkSchema = z.object({
  examinationId: z.string(),
  subjectId: z.string(),
  marks: z.array(z.object({
    studentId: z.string(),
    marksObtained: z.number().min(0),
    remarks: z.string().optional(),
  })).min(1),
});

const updateMarkSchema = z.object({
  marksObtained: z.number().min(0).optional(),
  remarks: z.string().optional(),
});

function computeGrade(percent: number): string {
  if (percent >= 90) return 'A*';
  if (percent >= 80) return 'A';
  if (percent >= 70) return 'B';
  if (percent >= 60) return 'C';
  if (percent >= 50) return 'D';
  if (percent >= 40) return 'E';
  return 'F';
}

// GET /my-results — Student: results grouped by examination
router.get('/my-results', authorize(Role.STUDENT), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
    if (!student) throw new AppError('Student not found', 404);

    const marks = await prisma.mark.findMany({
      where: { studentId: student.id, examination: { isPublished: true } },
      include: { examination: { select: { id: true, name: true } }, subject: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const examSubjects = await prisma.examinationSubject.findMany({
      where: { OR: marks.map(m => ({ examinationId: m.examinationId, subjectId: m.subjectId })) },
    });

    const maxMarksMap = new Map<string, number>();
    for (const es of examSubjects) maxMarksMap.set(`${es.examinationId}_${es.subjectId}`, es.maxMarks);

    const byExam = new Map<string, { examinationId: string; examinationName: string; marks: unknown[] }>();
    for (const mark of marks) {
      if (!byExam.has(mark.examinationId)) {
        byExam.set(mark.examinationId, { examinationId: mark.examinationId, examinationName: mark.examination.name, marks: [] });
      }
      byExam.get(mark.examinationId)!.marks.push({
        subjectName: mark.subject.name,
        marksObtained: mark.marksObtained,
        maxMarks: maxMarksMap.get(`${mark.examinationId}_${mark.subjectId}`) ?? 100,
        grade: mark.grade,
      });
    }

    res.json({ success: true, data: Array.from(byExam.values()) });
  } catch (err) { next(err); }
});

// GET / — filter by examinationId; role-aware
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { examinationId, subjectId, studentId } = req.query as Record<string, string>;
    const where: any = {};
    if (examinationId) where.examinationId = examinationId;
    if (subjectId) where.subjectId = subjectId;

    if (req.user!.role === Role.STUDENT) {
      const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
      if (!student) throw new AppError('Student profile not found', 404);
      where.studentId = student.id;
      // Only show marks for published exams
      where.examination = { isPublished: true };
    } else if (req.user!.role === Role.FACULTY) {
      const faculty = await prisma.faculty.findUnique({ where: { userId: req.user!.id } });
      if (!faculty) throw new AppError('Faculty profile not found', 404);
      where.facultyId = faculty.id;
      if (studentId) where.studentId = studentId;
    } else {
      if (studentId) where.studentId = studentId;
    }

    const marks = await prisma.mark.findMany({
      where,
      include: { student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } }, subject: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: marks });
  } catch (err) {
    next(err);
  }
});

// POST /bulk — Faculty/Admin: bulk enter marks
router.post('/bulk', authorize(Role.ADMIN, Role.FACULTY), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = bulkMarkSchema.parse(req.body);

    const exam = await prisma.examination.findUnique({ where: { id: body.examinationId } });
    if (!exam) throw new AppError('Examination not found', 404);
    if (exam.isPublished) throw new AppError('Cannot enter marks for a published examination', 400);

    let facultyId: string;
    if (req.user!.role === Role.FACULTY) {
      const faculty = await prisma.faculty.findUnique({ where: { userId: req.user!.id } });
      if (!faculty) throw new AppError('Faculty profile not found', 404);
      // Verify faculty is assigned to this subject+class
      const cs = await prisma.classSubject.findFirst({ where: { facultyId: faculty.id, subjectId: body.subjectId } });
      if (!cs) throw new AppError('You are not assigned to this subject', 403);
      facultyId = faculty.id;
    } else {
      const faculty = await prisma.faculty.findFirst();
      if (!faculty) throw new AppError('No faculty found', 400);
      facultyId = faculty.id;
    }

    // Get exam subject to know maxMarks
    const examSubject = await prisma.examinationSubject.findFirst({
      where: { examinationId: body.examinationId, subjectId: body.subjectId },
    });
    if (!examSubject) throw new AppError('Subject not part of this examination', 400);

    const upserts = body.marks.map(m => {
      const percent = (m.marksObtained / examSubject.maxMarks) * 100;
      const grade = computeGrade(percent);
      return prisma.mark.upsert({
        where: { examinationId_studentId_subjectId: { examinationId: body.examinationId, studentId: m.studentId, subjectId: body.subjectId } },
        create: { examinationId: body.examinationId, studentId: m.studentId, subjectId: body.subjectId, facultyId, marksObtained: m.marksObtained, grade, remarks: m.remarks },
        update: { marksObtained: m.marksObtained, grade, remarks: m.remarks },
      });
    });

    const results = await prisma.$transaction(upserts);
    await createAuditLog({ userId: req.user!.id, action: 'ENTER_MARKS', resource: 'Mark', details: { examinationId: body.examinationId, subjectId: body.subjectId, count: results.length } });
    res.status(201).json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
});

// PATCH /:id — Faculty/Admin: update single mark (only if not published)
router.patch('/:id', authorize(Role.ADMIN, Role.FACULTY), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mark = await prisma.mark.findUnique({ where: { id: req.params.id }, include: { examination: true } });
    if (!mark) throw new AppError('Mark not found', 404);
    if (mark.examination.isPublished) throw new AppError('Cannot edit marks for a published examination', 400);

    if (req.user!.role === Role.FACULTY) {
      const faculty = await prisma.faculty.findUnique({ where: { userId: req.user!.id } });
      if (!faculty || faculty.id !== mark.facultyId) throw new AppError('Access denied', 403);
    }

    const body = updateMarkSchema.parse(req.body);
    const examSubject = await prisma.examinationSubject.findFirst({ where: { examinationId: mark.examinationId, subjectId: mark.subjectId } });
    let grade = mark.grade;
    if (body.marksObtained !== undefined && examSubject) {
      grade = computeGrade((body.marksObtained / examSubject.maxMarks) * 100);
    }

    const updated = await prisma.mark.update({ where: { id: req.params.id }, data: { ...body, grade } });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
