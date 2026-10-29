import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/http.js';

export const AUTH_COOKIE = 'airride_session';

export type AuthUser = { id: string; name: string; email: string; role: Role };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/** A short fingerprint of the password hash: changing or resetting a password signs out every other device. */
export const passwordVersion = (passwordHash: string) => passwordHash.slice(-12);

export function signSession(userId: string, passwordHash: string): string {
  return jwt.sign({ sub: userId, pv: passwordVersion(passwordHash) }, config.jwtSecret, { expiresIn: '7d' });
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: config.isProd,
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

/** Loads the user from the session cookie (if any). Never rejects. */
export async function loadUser(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) return next();
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { sub: string; pv?: string };
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, role: true, active: true, passwordHash: true },
    });
    if (user?.active && payload.pv === passwordVersion(user.passwordHash)) req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
  } catch {
    // invalid/expired token: treat as logged out
  }
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, 'Please sign in'));
    if (roles.length && !roles.includes(req.user.role)) return next(new HttpError(403, 'You do not have permission to do that'));
    next();
  };
}

export const STAFF_ROLES: Role[] = ['TECHNICIAN', 'ADVISOR', 'ADMIN'];
