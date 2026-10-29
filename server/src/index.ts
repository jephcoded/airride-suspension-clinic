import { createApp } from './app.js';
import { config, paymentsMocked } from './config.js';
import { prisma } from './lib/prisma.js';
import { storageKind } from './services/storage.js';
import { scheduleDailyBackups } from './services/backup.js';

const server = createApp().listen(config.port, () => {
  console.log(`Airride API running on ${config.serverUrl} (files: ${storageKind})`);
  if (paymentsMocked) console.log('Payments: MOCK mode (set PAYSTACK_SECRET_KEY to use Paystack)');
});
// Slightly above typical load-balancer idle timeouts, so keep-alive connections are reused safely.
scheduleDailyBackups();
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

// Finish in-flight requests on deploy/restart instead of dropping customers mid-booking.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down gracefully…`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 15_000).unref();
  });
}
