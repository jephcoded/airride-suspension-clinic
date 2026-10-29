import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

const isProd = process.env.NODE_ENV === 'production';
if (isProd && (process.env.JWT_SECRET ?? '').length < 32) {
  throw new Error('JWT_SECRET must be at least 32 random characters in production.');
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT ?? 4000),
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  serverUrl: process.env.SERVER_URL ?? 'http://localhost:4000',
  jwtSecret: required('JWT_SECRET'),
  workshop: {
    name: process.env.WORKSHOP_NAME ?? 'Airride Suspension Clinic',
    address: process.env.WORKSHOP_ADDRESS ?? '',
    phone: process.env.WORKSHOP_PHONE ?? '',
  },
  defaultWarrantyMonths: Number(process.env.DEFAULT_WARRANTY_MONTHS ?? 6),
  paystackSecret: process.env.PAYSTACK_SECRET_KEY ?? '',
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.MAIL_FROM ?? 'Airride Suspension Clinic <no-reply@airride.ng>',
  },
  // Off: customers approve quotes online and pay at the workshop (staff record payments).
  onlinePayments: process.env.ONLINE_PAYMENTS === 'true',
  termii: {
    apiKey: process.env.TERMII_API_KEY ?? '',
    senderId: process.env.TERMII_SENDER_ID ?? 'Airride',
    // Each Termii account has its own base URL (shown next to the API key in the dashboard).
    baseUrl: (process.env.TERMII_BASE_URL || 'https://api.ng.termii.com').replace(/\/+$/, ''),
  },
  // Optional: send SMS from the workshop's Android phone (sms-gate.app) instead of Termii.
  phoneGateway: {
    url: process.env.PHONE_SMS_URL || 'https://api.sms-gate.app/3rdparty/v1/message',
    user: process.env.PHONE_SMS_USER ?? '',
    pass: process.env.PHONE_SMS_PASS ?? '',
  },
  push: {
    publicKey: process.env.VAPID_PUBLIC_KEY ?? '',
    privateKey: process.env.VAPID_PRIVATE_KEY ?? '',
    subject: process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
  },
  whatsapp: {
    token: process.env.WHATSAPP_TOKEN ?? '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
    templateName: process.env.WHATSAPP_TEMPLATE_NAME ?? 'repair_update',
    templateLang: process.env.WHATSAPP_TEMPLATE_LANG ?? 'en',
  },
};

// Mock payments let the full flow be demoed before Paystack keys exist. Never in production.
// Test-payment mode: on locally, and on a live site only when ALLOW_TEST_PAYMENTS=true (for testing before Paystack keys exist).
export const paymentsMocked = !config.paystackSecret && (!config.isProd || process.env.ALLOW_TEST_PAYMENTS === 'true');
