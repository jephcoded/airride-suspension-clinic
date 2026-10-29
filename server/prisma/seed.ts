/**
 * Production setup: creates the first admin account. No demo data.
 *   ADMIN_EMAIL=you@business.ng ADMIN_PASSWORD='a long password' npm run db:seed
 * Safe to re-run: does nothing once an admin exists.
 */
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';

async function main() {
  const existing = await prisma.user.count({ where: { role: 'ADMIN', active: true } });
  if (existing > 0) {
    console.log('An admin account already exists. Nothing to do.');
    return;
  }
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? '';
  const name = process.env.ADMIN_NAME?.trim() || 'Workshop Manager';
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Set ADMIN_EMAIL to the admin’s email address.');
  if (password.length < 10) throw new Error('Set ADMIN_PASSWORD to at least 10 characters.');

  await prisma.user.create({ data: { name, email, role: 'ADMIN', passwordHash: await bcrypt.hash(password, 12) } });
  console.log(`Admin account created for ${email}. Sign in at /staff and add your team under Staff Accounts.`);
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
