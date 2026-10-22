import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Role, PublicationStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/errorHandler';
import { getPagination, paginate } from '../utils/pagination';
import { uploadGallery } from '../middlewares/upload.middleware';
import path from 'path';
import fs from 'fs';

const router = Router();
router.use(authenticate);

const albumSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
  status: z.nativeEnum(PublicationStatus).optional(),
});

const photoSchema = z.object({
  albumId: z.string(),
  url: z.string().url(),
  caption: z.string().optional(),
});

router.get('/albums', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skip, take, page, limit } = getPagination(req.query as any);
    const where: any = {};
    if (req.user!.role === Role.STUDENT) { where.isPublic = true; where.status = PublicationStatus.PUBLISHED; }
    const [total, data] = await prisma.$transaction([
      prisma.galleryAlbum.count({ where }),
      prisma.galleryAlbum.findMany({
        where, skip, take, orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { photos: true } },
          photos: { orderBy: { createdAt: 'asc' }, take: 1, select: { url: true } },
        },
      }),
    ]);
    res.json({ success: true, ...paginate(total, data, page, limit) });
  } catch (err) { next(err); }
});

router.get('/albums/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const album = await prisma.galleryAlbum.findUnique({ where: { id: req.params.id }, include: { photos: true } });
    if (!album) throw new AppError('Album not found', 404);
    if (req.user!.role === Role.STUDENT && (!album.isPublic || album.status !== 'PUBLISHED')) throw new AppError('Access denied', 403);
    res.json({ success: true, data: album });
  } catch (err) { next(err); }
});

router.post('/albums', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = albumSchema.parse(req.body);
    const album = await prisma.galleryAlbum.create({ data: body as any });
    res.status(201).json({ success: true, data: album });
  } catch (err) { next(err); }
});

router.patch('/albums/:id', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = albumSchema.partial().parse(req.body);
    const album = await prisma.galleryAlbum.update({ where: { id: req.params.id }, data: body });
    res.json({ success: true, data: album });
  } catch (err) { next(err); }
});

router.delete('/albums/:id', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.galleryAlbum.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Album deleted' });
  } catch (err) { next(err); }
});

router.post('/photos', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = photoSchema.parse(req.body);
    const photo = await prisma.galleryPhoto.create({ data: { ...body, uploadedBy: req.user!.id } as any });
    res.status(201).json({ success: true, data: photo });
  } catch (err) { next(err); }
});

// POST /photos/upload — Admin: upload an image file into an album
router.post('/photos/upload', authorize(Role.ADMIN), (req: Request, res: Response, next: NextFunction) => {
  uploadGallery.single('photo')(req, res, async (err) => {
    if (err) return next(err);
    try {
      if (!req.file) throw new AppError('No file uploaded', 400);
      const albumId = req.body.albumId as string;
      const caption = req.body.caption as string | undefined;
      if (!albumId) throw new AppError('albumId is required', 400);

      const album = await prisma.galleryAlbum.findUnique({ where: { id: albumId } });
      if (!album) throw new AppError('Album not found', 404);

      const url = `/uploads/gallery/${req.file.filename}`;
      const photo = await prisma.galleryPhoto.create({
        data: { albumId, url, caption: caption || undefined, uploadedBy: req.user!.id },
      });
      res.status(201).json({ success: true, data: photo });
    } catch (e) { next(e); }
  });
});

// PATCH /photos/:id — Admin: update caption
router.patch('/photos/:id', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const caption = req.body.caption as string | undefined;
    const photo = await prisma.galleryPhoto.update({ where: { id: req.params.id }, data: { caption } });
    res.json({ success: true, data: photo });
  } catch (err) { next(err); }
});

router.delete('/photos/:id', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const photo = await prisma.galleryPhoto.findUnique({ where: { id: req.params.id } });
    if (!photo) throw new AppError('Photo not found', 404);
    // Delete file from disk
    const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
    if (photo.url.startsWith('/uploads/')) {
      const filePath = path.join(UPLOAD_DIR, photo.url.replace('/uploads/', ''));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await prisma.galleryPhoto.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Photo deleted' });
  } catch (err) { next(err); }
});

export default router;
