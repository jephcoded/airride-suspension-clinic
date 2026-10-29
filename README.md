# Airride Suspension Clinic — Website & Repair Management System

Customer website + online booking + repair tracking + technician/advisor/admin dashboards for
air suspension, hydraulic suspension and shock absorber repair.

| Part | Tech |
|---|---|
| `client/` | React 19, TypeScript, Vite, Tailwind CSS v4, React Router, TanStack Query |
| `server/` | Node.js, Express 5, TypeScript, Prisma, PostgreSQL |
| Payments | Paystack (mock mode in development when no key is set) |
| Notifications | Email (SMTP), SMS (Termii), WhatsApp (Meta Cloud API) — logged/skipped when not configured |

## Run it locally

Requirements: Node.js 20+, Docker Desktop.

```bash
docker compose up -d                 # PostgreSQL on localhost:5433
cd server
npm install
cp .env.example .env                 # then set JWT_SECRET
npx prisma migrate dev               # create tables
npm run db:seed:demo                 # sample staff + repairs (local only)
npm run dev                          # API on http://localhost:4000

cd ../client
npm install
npm run dev                          # website on http://localhost:5173
```

### Demo data (local development only)

`npm run db:seed:demo` (in `server/`) fills the local database with sample repairs and staff accounts.
It generates a random staff password and prints it in the terminal (or set `DEMO_PASSWORD` yourself).
For a live site, create the first admin with `ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run db:seed` instead.

## Main features

- **Book a Repair**: 5-step mobile-first form (customer, vehicle, suspension and symptoms, photos/videos, collection option).
  Generates a Repair ID like `ARC-2026-00125` and notifies the customer and the workshop.
- **Track My Repair**: Repair ID + phone/email (or the secret link sent by WhatsApp/SMS/email). Shows a progress bar, timeline,
  technician report, before/during/after photos, the quotation (Approve & Pay / Ask a question / Decline), payments and receipts,
  warranty and warranty claims.
- **Staff portal**: dashboard with stats and workshop queues; job search by name, phone, Repair ID, vehicle, registration, VIN
  or component; digital Job Card with status updates, diagnosis, evidence uploads, a quotation builder, manual payments, warranty,
  messages sent and customer history.
- **Admin**: staff accounts and roles, enquiries, warranty claims, audit log.

### Roles

| Role | Can do |
|---|---|
| Technician | Jobs assigned to them (or unassigned), status updates, diagnosis, evidence. Cannot send quotes, cancel or close jobs. |
| Service Advisor | Everything on all jobs, plus quotes, payments, warranty, enquiries |
| Admin | Everything, plus staff accounts and the audit log |

## Going live checklist

1. **Branding**: put the logo at `client/public/logo.png` (and a white version at `logo-light.png`). The brand colours are the
   `--color-brand-*` / `--color-navy-*` tokens in `client/src/index.css`.
2. **Photos**: put workshop photos in `client/public/images/`: `hero.jpg`, `air-suspension.jpg`, `hydraulic-suspension.jpg`,
   `shock-absorbers.jpg`, `workshop-1..3.jpg`, `cta.jpg`, `vehicles.jpg`, `about-1.jpg`, `about-2.jpg`. Until they are added,
   branded placeholders are shown.
3. **Business details**: phone, WhatsApp, email, address and hours in `client/src/lib/constants.ts` (`BUSINESS`) and in the
   `WORKSHOP_*` values in `server/.env`.
4. **Paystack**: set `PAYSTACK_SECRET_KEY`, then set the webhook URL in the Paystack dashboard to
   `https://<your-domain>/api/payments/paystack/webhook`.
5. **Email**: set the `SMTP_*` values (e.g. Zoho, Google Workspace, Mailgun).
6. **SMS**: set `TERMII_API_KEY` and register the sender ID with Termii.
7. **WhatsApp**: create a WhatsApp Business app on Meta and set `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`. Get a template named
   `repair_update` approved with 4 body variables: `{{1}}` name, `{{2}}` Repair ID, `{{3}}` update, `{{4}}` tracking link.
8. **Security**: generate a strong `JWT_SECRET`, set `NODE_ENV=production`, serve over HTTPS, change or disable the demo staff
   accounts, and turn on automatic database backups with your host.
9. **Uploads**: files are stored in `server/uploads/` and are only served to signed-in staff or to the customer holding the
   tracking link. Back this folder up, or move it to object storage (S3 / Cloudflare R2) when you scale.

## Useful commands

```bash
cd server && npm run db:studio       # browse the database
cd server && npx prisma migrate reset   # wipe and re-seed (development only!)
cd client && npm run build           # production build in client/dist
```
