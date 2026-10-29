import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/http.js';
import { audit } from '../lib/audit.js';
import { AUTH_COOKIE, requireRole, sessionCookieOptions, signSession } from '../middleware/auth.js';

export const authRouter = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, skipSuccessfulRequests: true });

const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  // Compare even when the user doesn't exist so response time doesn't reveal valid emails.
  const valid = await bcrypt.compare(password, user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva');
  if (!user || !valid || !user.active) throw new HttpError(401, 'Incorrect email or password');

  res.cookie(AUTH_COOKIE, signSession(user.id, user.passwordHash), sessionCookieOptions);
  await audit(user.id, 'LOGIN', 'User', user.id);
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE, { ...sessionCookieOptions, maxAge: undefined });
  res.json({ ok: true });
});

authRouter.get('/me', requireRole(), (req, res) => {
  res.json(req.user);
});

const changePasswordSchema = z.object({ currentPassword: z.string(), newPassword: z.string().min(8, 'Use at least 8 characters') });

authRouter.post('/change-password', requireRole(), async (req, res) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw new HttpError(400, 'Current password is incorrect');
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  res.cookie(AUTH_COOKIE, signSession(user.id, passwordHash), sessionCookieOptions);
  await audit(user.id, 'CHANGE_PASSWORD', 'User', user.id);
  res.json({ ok: true });
});
