# Airride Suspension Clinic — Website & Repair Management System

Customer website, online booking, live repair tracking and a staff portal for air suspension, hydraulic suspension,
shock absorber and automatic transmission repair.

Live site: https://airridesuspensionclinic.com.ng

| Part | Tech |
|---|---|
| `client/` | React 19, TypeScript, Vite, Tailwind CSS v4, React Router, TanStack Query (installable as an app / PWA) |
| `server/` | Node.js, Express 5, TypeScript, Prisma, PostgreSQL |
| Hosting | Vercel (website + API), Neon (PostgreSQL), Vercel Blob (photos and videos) |
| Payments | Paid at the workshop (cash or bank transfer). Staff record each payment and the customer gets a receipt on their tracking page. |
| Notifications | Email (SMTP), phone alerts (Web Push), one-tap WhatsApp and SMS messages from the workshop's own phone. Optional automatic SMS via Termii or an Android phone gateway. |

## Run it locally

Requirements: Node.js 22, Docker Desktop.

```bash
docker compose up -d                 # PostgreSQL on localhost:5433
cd server
npm install
cp .env.example .env                 # then set JWT_SECRET (and SMTP_* if you want emails)
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

- **Book a Repair**: 5-step mobile-first form (customer with WhatsApp number, vehicle, suspension or automatic transmission
  problem and symptoms, photos/videos straight from the phone camera, collection option). Generates a Repair ID like
  `ARC-2026-00125` and notifies the customer and the workshop.
- **Live repair tracking**: Repair ID + phone/email, or the secret link sent to the customer. Progress ring and 8-step tracker,
  live activity feed with workshop photos, pop-up updates while the page is open and phone alerts when it is closed, the
  quotation (approve / ask a question / decline), payments and receipts, warranty and warranty claims.
- **My Repairs**: customers sign in with a one-time code sent to their email or phone to see all their repairs.
- **Staff portal**: dashboard and workshop queues; job search by name, phone, Repair ID, vehicle, registration, VIN or
  component; digital Job Card with status updates, diagnosis, photo/video evidence, quotation builder, payment recording,
  warranty and customer history. After each update, staff can send it to the customer on WhatsApp or by SMS in one tap.
- **Admin**: staff accounts and roles, business settings (contact details, warranty by repair type, deposit %, alert emails),
  Website Photos (change the slideshow and page photos without code), enquiries, warranty claims and a readable audit log.
- **Search engines**: per-page titles and descriptions, business details for Google (structured data), sitemap and robots.txt.

### Roles

| Role | Can do |
|---|---|
| Technician | Jobs assigned to them (or unassigned), status updates, diagnosis, evidence. Cannot send quotes, cancel or close jobs. |
| Service Advisor | Everything on all jobs, plus quotes, payments, warranty, enquiries |
| Admin | Everything, plus staff accounts, settings, website photos and the audit log |

## Configuration (server environment variables)

See `server/.env.example` for the full list. The main ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | PostgreSQL connection (pooled for the app, direct for migrations) |
| `JWT_SECRET` | Long random string for staff and customer sessions |
| `CLIENT_URL`, `SERVER_URL`, `SITE_URL` | The public web address (used in links, emails and the sitemap) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Outgoing email (e.g. a Gmail app password) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Phone alerts (generate with `npx web-push generate-vapid-keys`) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage for photos/videos (local disk is used when not set) |
| `TERMII_API_KEY`, `TERMII_SENDER_ID`, `TERMII_BASE_URL` | Optional automatic SMS through Termii |
| `PHONE_SMS_USER`, `PHONE_SMS_PASS` | Optional automatic SMS through an Android phone (sms-gate.app); used instead of Termii when set |

Never commit real values: `.env` files are ignored by git.

## Deploying

The repo deploys to Vercel as one project: `npm run vercel-build` builds the API and the website, `api/index.js` serves the
API and `client/dist` is the website. Apply database changes with `npx prisma migrate deploy` (using the direct database URL)
before deploying code that needs them.

## Useful commands

```bash
cd server && npm run db:studio       # browse the database
cd server && npm run db:backup       # back up the database
cd client && npm run build           # production build in client/dist
```
