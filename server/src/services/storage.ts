import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import type { Request, Response } from 'express';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { del as blobDel, get as blobGet, head as blobHead } from '@vercel/blob';
import { UPLOAD_DIR } from '../middleware/upload.js';
import { badRequest } from '../lib/http.js';

/**
 * Where customer/technician photos live. Exactly one of:
 * - Vercel Blob (private store) when BLOB_READ_WRITE_TOKEN is set (Vercel deployments).
 *   Browsers upload straight to the store (Vercel functions accept at most 4.5 MB per request);
 *   the server only checks and records each upload, and streams files back to authorised viewers.
 * - S3-compatible bucket (Cloudflare R2, AWS S3, DigitalOcean Spaces…) when S3_BUCKET is set.
 * - Local `uploads/` folder otherwise (single server / development).
 */
const blobMode = !!process.env.BLOB_READ_WRITE_TOKEN;
const bucket = process.env.S3_BUCKET || '';
const s3 =
  !blobMode && bucket
    ? new S3Client({
        region: process.env.S3_REGION || 'auto',
        endpoint: process.env.S3_ENDPOINT || undefined,
        forcePathStyle: !!process.env.S3_ENDPOINT,
        credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '', secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '' },
      })
    : null;

export const storageKind = blobMode ? 'vercel-blob' : s3 ? 's3' : 'local';
/** Tells the website whether to upload files directly to storage (Vercel) or through the server. */
export const uploadMode: 'direct-to-storage' | 'via-server' = blobMode ? 'direct-to-storage' : 'via-server';

export const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/3gpp',
  'application/pdf',
];
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Moves freshly uploaded temp files into permanent storage. Call after validation, before saving DB rows. */
export async function persistUploads(files: Express.Multer.File[]) {
  if (!s3) return;
  await Promise.all(
    files.map(async (f) => {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: `uploads/${f.filename}`,
          Body: createReadStream(f.path),
          ContentType: f.mimetype,
          ContentLength: f.size,
        }),
      );
      await fs.unlink(f.path).catch(() => {});
    }),
  );
}

/** Removes temp files from a request that failed validation. */
export async function discardUploads(files: Express.Multer.File[]) {
  await Promise.allSettled(files.map((f) => fs.unlink(f.path)));
  // If they were already copied to the bucket before the request failed, remove those too.
  if (s3) await Promise.allSettled(files.map((f) => deleteStored(f.filename)));
}

export type DirectUpload = { pathname: string; originalName?: string };

/**
 * Vercel Blob: checks files the browser uploaded directly to the private store and returns
 * what to save on the Media rows. Rejects anything outside uploads/, of the wrong type or too big.
 */
export async function verifyDirectUploads(list: unknown): Promise<{ fileName: string; originalName: string; mimeType: string; size: number }[]> {
  if (!blobMode || !Array.isArray(list) || list.length === 0) return [];
  if (list.length > 10) throw badRequest('Too many files (max 10)');
  const out = [];
  for (const item of list as DirectUpload[]) {
    const pathname = String(item?.pathname ?? '');
    if (!/^uploads\/[\w.\-/]+$/.test(pathname) || pathname.includes('..')) throw badRequest('Invalid upload');
    let meta;
    try {
      meta = await blobHead(pathname);
    } catch {
      throw badRequest('An uploaded file could not be found. Please try uploading it again.');
    }
    if (!ALLOWED_TYPES.includes(meta.contentType) || meta.size > MAX_UPLOAD_BYTES) {
      await blobDel(pathname).catch(() => {});
      throw badRequest('File type not allowed or file too large');
    }
    out.push({ fileName: pathname, originalName: String(item.originalName ?? path.basename(pathname)).slice(0, 200), mimeType: meta.contentType, size: meta.size });
  }
  return out;
}

export async function deleteStored(fileName: string) {
  if (blobMode) await blobDel(fileName).catch(() => {});
  else if (s3) await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: `uploads/${path.basename(fileName)}` })).catch(() => {});
  else await fs.unlink(path.join(UPLOAD_DIR, path.basename(fileName))).catch(() => {});
}

/**
 * Sends a stored file to an already-authorised viewer. Customer files are never publicly reachable;
 * `publicCache` is only for website photos the admin uploaded, which never change once stored.
 */
export async function sendStored(req: Request, res: Response, fileName: string, mimeType: string, opts: { publicCache?: boolean } = {}) {
  const cache = opts.publicCache ? 'public, max-age=31536000, s-maxage=31536000, immutable' : null;
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (blobMode) {
    const result = await blobGet(fileName, { access: 'private', ifNoneMatch: req.header('if-none-match') ?? undefined });
    if (!result) return res.sendStatus(404);
    res.setHeader('Cache-Control', cache ?? 'private, no-cache');
    res.setHeader('ETag', result.blob.etag);
    if (result.statusCode === 304) return res.status(304).end();
    res.type(mimeType);
    Readable.fromWeb(result.stream as import('node:stream/web').ReadableStream).pipe(res);
    return;
  }
  const name = path.basename(fileName);
  if (s3) {
    const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: `uploads/${name}`, ResponseContentType: mimeType }), { expiresIn: 600 });
    res.setHeader('Cache-Control', opts.publicCache ? 'public, max-age=300' : 'private, max-age=300');
    return res.redirect(302, url);
  }
  res.setHeader('Cache-Control', cache ?? 'private, max-age=86400');
  res.type(mimeType);
  res.sendFile(path.join(UPLOAD_DIR, name));
}
