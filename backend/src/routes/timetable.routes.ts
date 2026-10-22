import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Role, DayOfWeek } from '@prisma/client';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';

const router = Router();
router.use(authenticate);

const createTimetableSchema = z.object({
  classId: z.string(),
  academicYearId: z.string(),
  name: z.string().min(1),
});

const slotSchema = z.object({
  sectionId: z.string(),
  subjectId: z.string(),
  facultyId: z.string(),
  dayOfWeek: z.nativeEnum(DayOfWeek),
  startTime: z.string(),
  endTime: z.string(),
  room: z.string().optional(),
});

// GET / — list timetables
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const classId = req.query.classId as string | undefined;
    const academicYearId = req.query.academicYearId as string | undefined;
    const where: any = {};
    if (classId) where.classId = classId;
    if (academicYearId) where.academicYearId = academicYearId;

    const timetables = await prisma.timetable.findMany({
      where,
      include: { class: true, academicYear: true, slots: { include: { subject: true, faculty: true, section: true } } },
    });
    res.json({ success: true, data: timetables });
  } catch (err) { next(err); }
});

// GET /my — Faculty: my active timetable slots
router.get('/my', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== Role.FACULTY) throw new AppError('Faculty only', 403);
    const faculty = await prisma.faculty.findUnique({ where: { userId: req.user!.id } });
    if (!faculty) throw new AppError('Faculty not found', 404);
    const slots = await prisma.timetableSlot.findMany({
      where: { facultyId: faculty.id, timetable: { isActive: true } },
      include: { subject: true, section: { include: { class: true } } },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    res.json({ success: true, data: slots });
  } catch (err) { next(err); }
});

// GET /my-student — Student: timetable slots for their enrolled sections
router.get('/my-student', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== Role.STUDENT) throw new AppError('Student only', 403);
    const student = await prisma.student.findUnique({
      where: { userId: req.user!.id },
      include: { enrollments: { where: { isActive: true }, select: { sectionId: true } } },
    });
    if (!student) throw new AppError('Student not found', 404);
    const sectionIds = student.enrollments.map((e: { sectionId: string }) => e.sectionId);
    const slots = await prisma.timetableSlot.findMany({
      where: { sectionId: { in: sectionIds }, timetable: { isActive: true } },
      include: { subject: true, faculty: { select: { firstName: true, lastName: true } } },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    res.json({ success: true, data: slots });
  } catch (err) { next(err); }
});

// GET /:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tt = await prisma.timetable.findUnique({
      where: { id: req.params.id },
      include: { class: true, academicYear: true, slots: { include: { subject: true, faculty: { select: { firstName: true, lastName: true } }, section: true }, orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] } },
    });
    if (!tt) throw new AppError('Timetable not found', 404);
    res.json({ success: true, data: tt });
  } catch (err) { next(err); }
});

// POST / — Admin only
router.post('/', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createTimetableSchema.parse(req.body);
    const tt = await prisma.timetable.create({ data: body as any, include: { class: true, academicYear: true } });
    res.status(201).json({ success: true, data: tt });
  } catch (err) { next(err); }
});

// POST /:id/slots — Admin: add slot (with conflict detection)
router.post('/:id/slots', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = slotSchema.parse(req.body);
    // Check faculty conflict
    const conflict = await prisma.timetableSlot.findFirst({
      where: {
        timetable: { isActive: true },
        facultyId: body.facultyId,
        dayOfWeek: body.dayOfWeek,
        OR: [
          { startTime: { gte: body.startTime, lt: body.endTime } },
          { endTime: { gt: body.startTime, lte: body.endTime } },
        ],
      },
    });
    if (conflict) throw new AppError('Faculty has a scheduling conflict at this time', 409);

    const slot = await prisma.timetableSlot.create({ data: { timetableId: req.params.id, ...body } as any, include: { subject: true, faculty: true } });
    res.status(201).json({ success: true, data: slot });
  } catch (err) { next(err); }
});

// POST /:id/activate — Admin: set as active timetable for the class
router.post('/:id/activate', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tt = await prisma.timetable.findUnique({ where: { id: req.params.id } });
    if (!tt) throw new AppError('Timetable not found', 404);
    await prisma.timetable.updateMany({ where: { classId: tt.classId }, data: { isActive: false } });
    await prisma.timetable.update({ where: { id: req.params.id }, data: { isActive: true } });
    res.json({ success: true, message: 'Timetable activated' });
  } catch (err) { next(err); }
});

// DELETE /:id/slots/:slotId — Admin
router.delete('/:id/slots/:slotId', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.timetableSlot.delete({ where: { id: req.params.slotId } });
    res.json({ success: true, message: 'Slot removed' });
  } catch (err) { next(err); }
});

export default router;
