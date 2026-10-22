import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Role, AttendanceStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';
import { createAuditLog } from '../utils/auditLog';

const router = Router();
router.use(authenticate);

const attendanceSchema = z.object({
  sectionId: z.string(),
  date: z.string(),
  records: z.array(z.object({
    studentId: z.string(),
    status: z.nativeEnum(AttendanceStatus),
    remarks: z.string().optional(),
  })).min(1),
});

const updateRecordsSchema = z.object({
  records: z.array(z.object({
    studentId: z.string(),
    status: z.nativeEnum(AttendanceStatus),
    remarks: z.string().optional(),
  })).min(1),
});

async function getFacultyProfile(userId: string) {
  const faculty = await prisma.faculty.findUnique({ where: { userId } });
  if (!faculty) throw new AppError('Faculty profile not found', 404);
  return faculty;
}

async function assertFacultyOwnsSection(facultyId: string, sectionId: string) {
  const slot = await prisma.timetableSlot.findFirst({ where: { facultyId, sectionId } });
  if (!slot) throw new AppError('You are not assigned to this section', 403);
}

// Safely parse a YYYY-MM-DD string as UTC midnight (avoids local-timezone shift)
function parseUTCDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// POST / — Faculty/Admin: take attendance
router.post('/', authorize(Role.ADMIN, Role.FACULTY), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = attendanceSchema.parse(req.body);
    const date = parseUTCDate(body.date);

    let takenById: string;
    if (req.user!.role === Role.FACULTY) {
      const faculty = await getFacultyProfile(req.user!.id);
      await assertFacultyOwnsSection(faculty.id, body.sectionId);
      takenById = faculty.id;
    } else {
      // Admin: find or use a placeholder faculty ID
      const faculty = await prisma.faculty.findFirst();
      if (!faculty) throw new AppError('No faculty found to record attendance', 400);
      takenById = faculty.id;
    }

    // Upsert attendance record
    const attendance = await prisma.attendance.upsert({
      where: { sectionId_date: { sectionId: body.sectionId, date } },
      create: { sectionId: body.sectionId, date, takenById },
      update: { takenById },
    });

    // Upsert student records
    await prisma.$transaction(
      body.records.map(r =>
        prisma.studentAttendance.upsert({
          where: { attendanceId_studentId: { attendanceId: attendance.id, studentId: r.studentId } },
          create: { attendanceId: attendance.id, studentId: r.studentId, status: r.status, remarks: r.remarks },
          update: { status: r.status, remarks: r.remarks },
        })
      )
    );

    await createAuditLog({ userId: req.user!.id, action: 'TAKE_ATTENDANCE', resource: 'Attendance', resourceId: attendance.id });
    res.status(201).json({ success: true, data: { attendanceId: attendance.id } });
  } catch (err) {
    next(err);
  }
});

// PUT /:id — Faculty/Admin: update attendance records
router.put('/:id', authorize(Role.ADMIN, Role.FACULTY), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attendance = await prisma.attendance.findUnique({ where: { id: req.params.id } });
    if (!attendance) throw new AppError('Attendance record not found', 404);

    if (req.user!.role === Role.FACULTY) {
      const faculty = await getFacultyProfile(req.user!.id);
      await assertFacultyOwnsSection(faculty.id, attendance.sectionId);
    }

    const body = updateRecordsSchema.parse(req.body);
    await prisma.$transaction(
      body.records.map(r =>
        prisma.studentAttendance.upsert({
          where: { attendanceId_studentId: { attendanceId: attendance.id, studentId: r.studentId } },
          create: { attendanceId: attendance.id, studentId: r.studentId, status: r.status, remarks: r.remarks },
          update: { status: r.status, remarks: r.remarks },
        })
      )
    );

    await createAuditLog({ userId: req.user!.id, action: 'UPDATE_ATTENDANCE', resource: 'Attendance', resourceId: attendance.id });
    res.json({ success: true, message: 'Attendance updated' });
  } catch (err) {
    next(err);
  }
});

// GET /section/:sectionId — Faculty/Admin
router.get('/section/:sectionId', authorize(Role.ADMIN, Role.FACULTY), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role === Role.FACULTY) {
      const faculty = await getFacultyProfile(req.user!.id);
      await assertFacultyOwnsSection(faculty.id, req.params.sectionId);
    }

    const { from, to } = req.query as { from?: string; to?: string };
    const where: any = { sectionId: req.params.sectionId };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = parseUTCDate(from);
      if (to) {
        // include the full day up to 23:59:59.999 UTC
        const toDate = parseUTCDate(to);
        toDate.setUTCHours(23, 59, 59, 999);
        where.date.lte = toDate;
      }
    }

    const records = await prisma.attendance.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { records: { include: { student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } } } } },
    });
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});

// GET /student/me — Student: own attendance records
router.get('/student/me', authorize(Role.STUDENT), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
    if (!student) throw new AppError('Student not found', 404);
    const records = await prisma.studentAttendance.findMany({
      where: { studentId: student.id },
      orderBy: { attendance: { date: 'desc' } },
      include: { attendance: { include: { section: { include: { class: true } } } } },
      take: 100,
    });
    const formatted = records.map(r => ({
      date: r.attendance.date,
      status: r.status,
      remarks: r.remarks,
      section: `${r.attendance.section.class.name} / ${r.attendance.section.name}`,
    }));
    res.json({ success: true, data: formatted });
  } catch (err) { next(err); }
});

// GET /student/me/summary — Student: own attendance summary
router.get('/student/me/summary', authorize(Role.STUDENT), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
    if (!student) throw new AppError('Student not found', 404);
    const [total, present, late, absent, excused] = await Promise.all([
      prisma.studentAttendance.count({ where: { studentId: student.id } }),
      prisma.studentAttendance.count({ where: { studentId: student.id, status: 'PRESENT' } }),
      prisma.studentAttendance.count({ where: { studentId: student.id, status: 'LATE' } }),
      prisma.studentAttendance.count({ where: { studentId: student.id, status: 'ABSENT' } }),
      prisma.studentAttendance.count({ where: { studentId: student.id, status: 'EXCUSED' } }),
    ]);
    const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
    res.json({ success: true, data: { total, present, late, absent, excused, percentage } });
  } catch (err) { next(err); }
});

// GET /student/:studentId — history
router.get('/student/:studentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role === Role.STUDENT) {
      const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
      if (!student || student.id !== req.params.studentId) throw new AppError('Access denied', 403);
    }

    const records = await prisma.studentAttendance.findMany({
      where: { studentId: req.params.studentId },
      orderBy: { attendance: { date: 'desc' } },
      include: { attendance: { include: { section: { include: { class: true } } } } },
      take: 100,
    });
    res.json({ success: true, data: records });
  } catch (err) {
    next(err);
  }
});

// GET /student/:studentId/summary — percentage summary
router.get('/student/:studentId/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role === Role.STUDENT) {
      const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
      if (!student || student.id !== req.params.studentId) throw new AppError('Access denied', 403);
    }

    const [total, present, late] = await Promise.all([
      prisma.studentAttendance.count({ where: { studentId: req.params.studentId } }),
      prisma.studentAttendance.count({ where: { studentId: req.params.studentId, status: 'PRESENT' } }),
      prisma.studentAttendance.count({ where: { studentId: req.params.studentId, status: 'LATE' } }),
    ]);

    const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
    res.json({ success: true, data: { total, present, late, absent: total - present - late, percentage } });
  } catch (err) {
    next(err);
  }
});

export default router;
