/** Manual backup: `npm run db:backup` */
import 'dotenv/config';
import { runBackup } from '../services/backup.js';
import { prisma } from '../lib/prisma.js';

runBackup()
  .then((file) => console.log(`Backup saved: ${file}`))
  .catch((e) => {
    console.error(e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
