import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AppError } from './errorHandler';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function createStorage(subDir: string) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(UPLOAD_DIR, subDir);
      ensureDir(dir);
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      const base = path.basename(file.originalname, ext).replace(/\s+/g, '-').toLowerCase();
      cb(null, `${base}-${Date.now()}${ext}`);
    },
  });
}

const MAX_SIZE = (parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10)) * 1024 * 1024;

const IMAGE_TYPES = /jpeg|jpg|png|gif|webp/;
const DOC_TYPES = /pdf|doc|docx|xls|xlsx|ppt|pptx|txt/;

function imageFilter(_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (IMAGE_TYPES.test(path.extname(file.originalname).toLowerCase())) {
    cb(null, true);
  } else {
    cb(new AppError('Only image files are allowed', 400));
  }
}

function docFilter(_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  if (IMAGE_TYPES.test(ext) || DOC_TYPES.test(ext)) {
    cb(null, true);
  } else {
    cb(new AppError('File type not allowed', 400));
  }
}

export const uploadImage = multer({ storage: createStorage('images'), limits: { fileSize: MAX_SIZE }, fileFilter: imageFilter });
export const uploadDocument = multer({ storage: createStorage('documents'), limits: { fileSize: MAX_SIZE }, fileFilter: docFilter });
export const uploadGallery = multer({ storage: createStorage('gallery'), limits: { fileSize: MAX_SIZE }, fileFilter: imageFilter });
export const uploadAvatar = multer({ storage: createStorage('avatars'), limits: { fileSize: 2 * 1024 * 1024 }, fileFilter: imageFilter });
