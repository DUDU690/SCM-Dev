import { Router, Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import prisma from '../lib/prisma';
import { authenticate } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';

const router = Router();
router.use(authenticate);

// GET /admin
router.get('/admin', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== Role.ADMIN) throw new AppError('Access denied', 403);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalStudents, totalFaculty, totalClasses, totalSubjects,
      pendingAdmissions, recentAuditLogs, currentYear, recentAdmissions,
    ] = await Promise.all([
      prisma.student.count(),
      prisma.faculty.count(),
      prisma.class.count(),
      prisma.subject.count(),
      prisma.admission.count({ where: { status: 'PENDING' } }),
      prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 8, include: { user: { select: { email: true, role: true } } } }),
      prisma.academicYear.findFirst({ where: { isCurrent: true } }),
      prisma.admission.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, firstName: true, lastName: true, status: true, createdAt: true } }),
    ]);

    // Fee stats
    const feeStats = await prisma.feeInvoice.aggregate({
      _sum: { totalAmount: true, paidAmount: true },
    });

    // Today's attendance — find parent Attendance records for today, then query student records
    const todayParents = await prisma.attendance.findMany({
      where: { date: today },
      select: { id: true },
    });
    const todayParentIds = todayParents.map(a => a.id);
    const todayAttendance = todayParentIds.length > 0
      ? await prisma.studentAttendance.findMany({ where: { attendanceId: { in: todayParentIds } } })
      : [];
    const totalToday = todayAttendance.length;
    const presentToday = todayAttendance.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length;
    const attendancePct = totalToday > 0 ? Math.round((presentToday / totalToday) * 100) : null;

    // Grade distribution from marks
    const gradeGroups = await prisma.mark.groupBy({ by: ['grade'], _count: true, where: { grade: { not: null } } });
    const examPerformance = gradeGroups.map(g => ({ grade: g.grade || 'N/A', count: g._count }));

    // Fee collection over last 6 months (simplified)
    const totalPaid = Number(feeStats._sum.paidAmount || 0);
    const totalAmt = Number(feeStats._sum.totalAmount || 0);
    const feeCollection = [{ month: 'Total', collected: totalPaid, outstanding: totalAmt - totalPaid }];

    res.json({
      success: true,
      data: {
        counts: {
          students: totalStudents,
          faculty: totalFaculty,
          classes: totalClasses,
          subjects: totalSubjects,
          pendingAdmissions,
          activeAcademicYear: currentYear?.name ?? null,
        },
        feeStats: {
          totalAmount: totalAmt,
          paidAmount: totalPaid,
          outstanding: totalAmt - totalPaid,
        },
        attendance: totalToday > 0 ? [{ date: today.toISOString().slice(0, 10), present: presentToday, absent: totalToday - presentToday, percentage: attendancePct ?? 0 }] : [],
        feeCollection,
        recentAdmissions,
        recentAuditLogs,
        examPerformance,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /faculty
router.get('/faculty', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== Role.FACULTY) throw new AppError('Access denied', 403);

    const faculty = await prisma.faculty.findUnique({ where: { userId: req.user!.id } });
    if (!faculty) throw new AppError('Faculty profile not found', 404);

    const today = new Date();
    const dayName = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][today.getDay()];

    const [classSubjects, todaySlots, pendingMarkCount] = await Promise.all([
      prisma.classSubject.findMany({
        where: { facultyId: faculty.id },
        include: { class: true, subject: true },
      }),
      prisma.timetableSlot.findMany({
        where: { facultyId: faculty.id, dayOfWeek: dayName as any, timetable: { isActive: true } },
        include: { subject: true, section: { include: { class: true } } },
        orderBy: { startTime: 'asc' },
      }),
      // Examinations that are not published but have subjects assigned to this faculty
      prisma.examination.count({
        where: {
          isPublished: false,
          subjects: { some: { subject: { classSubjects: { some: { facultyId: faculty.id } } } } },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        faculty: { id: faculty.id, firstName: faculty.firstName, lastName: faculty.lastName, employeeId: faculty.employeeId, designation: faculty.designation },
        assignedSubjects: classSubjects.length,
        classSubjects,
        todaySchedule: todaySlots,
        pendingMarkExaminations: pendingMarkCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /student
router.get('/student', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== Role.STUDENT) throw new AppError('Access denied', 403);

    const student = await prisma.student.findUnique({ where: { userId: req.user!.id } });
    if (!student) throw new AppError('Student profile not found', 404);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayName = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][new Date().getDay()];

    const currentEnrollment = await prisma.studentEnrollment.findFirst({
      where: { studentId: student.id, isActive: true },
      include: { section: { include: { class: true } }, academicYear: true },
    });

    const [attendanceSummary, upcomingExams, feeInvoices, unreadNotifications] = await Promise.all([
      prisma.studentAttendance.groupBy({
        by: ['status'],
        where: { studentId: student.id },
        _count: { id: true },
      }),
      prisma.examination.findMany({
        where: { isPublished: false, classId: currentEnrollment?.section?.classId, startDate: { gte: today } },
        orderBy: { startDate: 'asc' },
        take: 3,
        include: { subjects: { include: { subject: true } } },
      }),
      prisma.feeInvoice.findMany({
        where: { studentId: student.id },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
      prisma.notification.count({ where: { userId: req.user!.id, isRead: false } }),
    ]);

    const totalAttendance = attendanceSummary.reduce((acc, g) => acc + (g._count.id ?? 0), 0);
    const presentCount = attendanceSummary.find(g => g.status === 'PRESENT')?._count.id ?? 0;
    const lateCount = attendanceSummary.find(g => g.status === 'LATE')?._count.id ?? 0;
    const attendancePercentage = totalAttendance > 0 ? Math.round(((presentCount + lateCount) / totalAttendance) * 100) : 0;

    let todaySchedule: any[] = [];
    if (currentEnrollment) {
      const timetable = await prisma.timetable.findFirst({
        where: { classId: currentEnrollment.section.classId, isActive: true },
      });
      if (timetable) {
        todaySchedule = await prisma.timetableSlot.findMany({
          where: { timetableId: timetable.id, sectionId: currentEnrollment.sectionId, dayOfWeek: dayName as any },
          include: { subject: true, faculty: { select: { firstName: true, lastName: true } } },
          orderBy: { startTime: 'asc' },
        });
      }
    }

    res.json({
      success: true,
      data: {
        student: { id: student.id, firstName: student.firstName, lastName: student.lastName, admissionNumber: student.admissionNumber },
        enrollment: currentEnrollment,
        attendance: { total: totalAttendance, present: presentCount, late: lateCount, absent: totalAttendance - presentCount - lateCount, percentage: attendancePercentage },
        upcomingExams,
        feeInvoices,
        unreadNotifications,
        todaySchedule,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
