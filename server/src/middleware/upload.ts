import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { HttpError } from '../lib/http.js';

// Vercel's file system is read-only except /tmp (only used briefly there; files go to Blob storage).
export const UPLOAD_DIR = process.env.VERCEL ? '/tmp/uploads' : path.resolve('uploads');

const ALLOWED: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'video/3gpp': '.3gp',
  'application/pdf': '.pdf',
};

export const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50MB — short phone videos
export const MAX_FILES = 10;

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  // Never trust the client's file name; extension comes from the validated MIME type.
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${ALLOWED[file.mimetype]}`),
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED[file.mimetype]) cb(null, true);
    else cb(new HttpError(400, `File type not allowed: ${file.originalname}. Upload photos (JPG/PNG/WEBP/HEIC), videos (MP4/MOV/WEBM) or PDF.`));
  },
});
