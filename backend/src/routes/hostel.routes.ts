import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Role, RoomType, Gender } from '@prisma/client';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';

const router = Router();
router.use(authenticate);

const hostelSchema = z.object({ name: z.string().min(1), description: z.string().optional(), gender: z.nativeEnum(Gender).optional() });
const blockSchema = z.object({ hostelId: z.string(), name: z.string().min(1) });
const roomSchema = z.object({ blockId: z.string(), roomNumber: z.string().min(1), roomType: z.nativeEnum(RoomType).optional(), capacity: z.number().int().positive(), floor: z.number().int().optional() });
const allocateSchema = z.object({ studentId: z.string(), roomId: z.string(), bedNumber: z.number().int().positive() });

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.hostel.findMany({ include: { blocks: { include: { rooms: { include: { allocations: { where: { isActive: true }, include: { student: { select: { firstName: true, lastName: true, admissionNumber: true } } } } } } } } } });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = hostelSchema.parse(req.body);
    const h = await prisma.hostel.create({ data: body as any });
    res.status(201).json({ success: true, data: h });
  } catch (err) { next(err); }
});

router.post('/blocks', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = blockSchema.parse(req.body);
    const b = await prisma.hostelBlock.create({ data: body as any });
    res.status(201).json({ success: true, data: b });
  } catch (err) { next(err); }
});

router.post('/rooms', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = roomSchema.parse(req.body);
    const r = await prisma.hostelRoom.create({ data: body as any });
    res.status(201).json({ success: true, data: r });
  } catch (err) { next(err); }
});

router.post('/allocate', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = allocateSchema.parse(req.body);
    // Check capacity
    const room = await prisma.hostelRoom.findUnique({ where: { id: body.roomId } });
    if (!room) throw new AppError('Room not found', 404);
    const activeCount = await prisma.hostelAllocation.count({ where: { roomId: body.roomId, isActive: true } });
    if (activeCount >= room.capacity) throw new AppError('Room is at full capacity', 400);
    // Vacate any existing allocation
    await prisma.hostelAllocation.updateMany({ where: { studentId: body.studentId, isActive: true }, data: { isActive: false, vacatedAt: new Date() } });
    const alloc = await prisma.hostelAllocation.create({ data: body as any });
    res.status(201).json({ success: true, data: alloc });
  } catch (err) { next(err); }
});

router.post('/vacate/:studentId', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.hostelAllocation.updateMany({ where: { studentId: req.params.studentId, isActive: true }, data: { isActive: false, vacatedAt: new Date() } });
    res.json({ success: true, message: 'Student vacated' });
  } catch (err) { next(err); }
});

export default router;
