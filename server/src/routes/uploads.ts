import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { STAFF_ROLES } from '../middleware/auth.js';
import { ALLOWED_TYPES, MAX_UPLOAD_BYTES, uploadMode } from '../services/storage.js';

/**
 * Vercel Blob client uploads: issues short-lived tokens so the browser can upload a photo or
 * video straight to the private store. Customers may upload while booking; "staff" uploads need a login.
 */
export const uploadsRouter = Router();

const tokenLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });

uploadsRouter.post('/', tokenLimiter, async (req, res) => {
  if (uploadMode !== 'direct-to-storage') return res.status(404).json({ error: 'Not found' });
  try {
    const json = await handleUpload({
      body: req.body as HandleUploadBody,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!pathname.startsWith('uploads/') || pathname.includes('..')) throw new Error('Invalid file name');
        if (clientPayload === 'staff' && !(req.user && STAFF_ROLES.includes(req.user.role))) throw new Error('Please sign in');
        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
          validUntil: Date.now() + 15 * 60 * 1000,
        };
      },
      // Files are recorded when the booking / job card is saved, so nothing to do here.
      onUploadCompleted: async () => {},
    });
    res.json(json);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});
