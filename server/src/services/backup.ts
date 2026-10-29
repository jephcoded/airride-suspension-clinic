import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { prisma } from '../lib/prisma.js';

/**
 * Database backups (spec §22).
 * - Writes a compressed `pg_dump` to BACKUP_DIR (default ./backups) and keeps the newest BACKUP_KEEP (default 14).
 * - Also copies it to the S3/R2 bucket (backups/…) when S3_BUCKET is set, so a lost server never loses data.
 * - `pg_dump` must be installed (the production Docker image includes it). For local Docker setups,
 *   set PG_DUMP_DOCKER=<container name> to run it inside the database container instead.
 */
const BACKUP_DIR = path.resolve(process.env.BACKUP_DIR || 'backups');
const KEEP = Number(process.env.BACKUP_KEEP || 14);

function dumpProcess() {
  const url = process.env.DATABASE_URL ?? '';
  const container = process.env.PG_DUMP_DOCKER;
  if (container) {
    // Inside the container the database listens on its default port.
    const u = new URL(url);
    return spawn('docker', ['exec', container, 'pg_dump', '--no-owner', '--no-privileges', '-U', decodeURIComponent(u.username), u.pathname.slice(1)]);
  }
  return spawn('pg_dump', ['--no-owner', '--no-privileges', url.split('?')[0]]);
}

export async function runBackup(): Promise<string> {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
  const file = path.join(BACKUP_DIR, `airride-${stamp}.sql.gz`);

  const child = dumpProcess();
  let stderr = '';
  child.stderr.on('data', (d) => (stderr += d));
  const exited = new Promise<number>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
  await pipeline(child.stdout, createGzip({ level: 9 }), fs.createWriteStream(file));
  const code = await exited;
  if (code !== 0) {
    fs.rmSync(file, { force: true });
    throw new Error(`pg_dump failed (exit ${code}): ${stderr.trim().slice(0, 500)}`);
  }

  if (process.env.S3_BUCKET) {
    const s3 = new S3Client({
      region: process.env.S3_REGION || 'auto',
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: !!process.env.S3_ENDPOINT,
      credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '', secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '' },
    });
    await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: `backups/${path.basename(file)}`, Body: fs.readFileSync(file), ContentType: 'application/gzip' }));
  }

  // Keep only the newest backups locally.
  const old = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => /^airride-.*\.sql\.gz$/.test(f))
    .sort()
    .reverse()
    .slice(KEEP);
  for (const f of old) fs.rmSync(path.join(BACKUP_DIR, f), { force: true });
  return file;
}

/**
 * Runs a backup once a day at BACKUP_HOUR (default 2am, server time) when BACKUP_DAILY=true.
 * A database lock makes sure only one server runs it, even with several instances.
 */
export function scheduleDailyBackups() {
  if (process.env.BACKUP_DAILY !== 'true') return;
  const hour = Number(process.env.BACKUP_HOUR ?? 2);
  let lastDay = '';
  const tick = async () => {
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    if (now.getHours() !== hour || day === lastDay) return;
    lastDay = day;
    const [{ locked }] = await prisma.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_lock(424242) AS locked`;
    if (!locked) return;
    try {
      const file = await runBackup();
      console.log(`[backup] saved ${file}`);
    } catch (e) {
      console.error('[backup] FAILED', e);
    } finally {
      await prisma.$queryRaw`SELECT pg_advisory_unlock(424242)`;
    }
  };
  setInterval(() => void tick(), 10 * 60 * 1000).unref();
  console.log(`[backup] daily backups enabled at ${hour}:00`);
}
