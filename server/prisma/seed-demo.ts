import crypto from 'node:crypto';
/**
 * LOCAL DEVELOPMENT ONLY: demo staff accounts + sample repairs.
 * Run with `npm run db:seed:demo`. Refuses to run when NODE_ENV=production. Safe to re-run: staff are upserted, demo jobs are only created once.
 */
import bcrypt from 'bcryptjs';
import type { RepairStage } from '@prisma/client';
import { prisma } from '../src/lib/prisma.js';
import { generateRepairId, randomToken } from '../src/lib/ids.js';
import { STAGES, STAGE_ORDER } from '../src/lib/stages.js';
import { DEFAULT_WARRANTY_TERMS } from '../src/services/jobs.js';

// Never stored in the code: set DEMO_PASSWORD, or a random one is generated and printed below.
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || `Demo-${crypto.randomBytes(6).toString('base64url')}`;

const days = (n: number) => new Date(Date.now() + n * 86400000);

async function upsertStaff(name: string, email: string, role: 'ADMIN' | 'ADVISOR' | 'TECHNICIAN') {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  return prisma.user.upsert({ where: { email }, update: {}, create: { name, email, role, passwordHash } });
}

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo data is for local development only.');
  const admin = await upsertStaff('Workshop Manager', 'admin@airride.ng', 'ADMIN');
  const advisor = await upsertStaff('Service Advisor', 'advisor@airride.ng', 'ADVISOR');
  const tech1 = await upsertStaff('Technician 01', 'tech1@airride.ng', 'TECHNICIAN');
  const tech2 = await upsertStaff('Technician 02', 'tech2@airride.ng', 'TECHNICIAN');

  if ((await prisma.repairJob.count()) > 0) {
    console.log('Demo jobs already exist — staff accounts ensured.');
    return;
  }

  type Demo = {
    customer: { fullName: string; phone: string; email?: string; location: string };
    vehicle: { make: string; model: string; year: number; registration: string; type: 'CAR' | 'SUV' | 'TRUCK' | 'BUS' };
    suspensionType: 'AIR' | 'HYDRAULIC' | 'ELECTRONIC';
    component: 'AIR_STRUT' | 'HYDRAULIC_STRUT' | 'SHOCK_ABSORBER' | 'COMPRESSOR' | 'AIR_SPRING';
    position: string;
    symptoms: string[];
    description: string;
    stage: RepairStage;
    techId?: string;
    diagnosis?: string;
    quote?: { items: [string, 'PART' | 'LABOUR' | 'TESTING', number][]; approved: boolean; paid?: number };
  };

  const demos: Demo[] = [
    {
      customer: { fullName: 'John Okafor', phone: '2348031234567', email: 'john@example.com', location: 'Lekki, Lagos' },
      vehicle: { make: 'Land Rover', model: 'Range Rover Sport', year: 2019, registration: 'LND482KJ', type: 'SUV' },
      suspensionType: 'AIR',
      component: 'AIR_STRUT',
      position: 'Front Left',
      symptoms: ['Vehicle sinking', 'Air leak', 'Warning light'],
      description: 'Front left corner drops overnight. Suspension fault light on dashboard.',
      stage: 'AWAITING_APPROVAL',
      techId: tech2.id,
      diagnosis: 'Upper seal and piston seal damaged; air bag membrane cracked.',
      quote: {
        items: [
          ['Seal kit', 'PART', 45000],
          ['Air bag membrane', 'PART', 60000],
          ['Hydraulic oil', 'PART', 15000],
          ['Labour — strip, rebuild & refit', 'LABOUR', 75000],
          ['Pressure & leak testing', 'TESTING', 20000],
        ],
        approved: false,
      },
    },
    {
      customer: { fullName: 'Amaka Bello', phone: '2348029876543', email: 'amaka@example.com', location: 'Wuse 2, Abuja' },
      vehicle: { make: 'Mercedes-Benz', model: 'S-Class', year: 2017, registration: 'ABJ221XY', type: 'CAR' },
      suspensionType: 'HYDRAULIC',
      component: 'HYDRAULIC_STRUT',
      position: 'Rear Right',
      symptoms: ['Oil leak', 'Knocking sound'],
      description: 'Oil leaking from rear right strut, knocking on bumps.',
      stage: 'REPAIR_IN_PROGRESS',
      techId: tech1.id,
      diagnosis: 'Worn rod seal and scored piston rod.',
      quote: {
        items: [
          ['Rod seal kit', 'PART', 38000],
          ['Piston rod re-chrome', 'PART', 55000],
          ['Labour', 'LABOUR', 70000],
          ['Bench testing', 'TESTING', 15000],
        ],
        approved: true,
        paid: 89000,
      },
    },
    {
      customer: { fullName: 'Tunde Adeyemi', phone: '2348055551212', location: 'Ikeja, Lagos' },
      vehicle: { make: 'Lexus', model: 'LX 570', year: 2016, registration: 'KJA903AB', type: 'SUV' },
      suspensionType: 'HYDRAULIC',
      component: 'SHOCK_ABSORBER',
      position: 'Front Right',
      symptoms: ['Suspension too soft', 'Uneven ride height'],
      description: 'Car bounces a lot and sits lower on the front right.',
      stage: 'COMPLETED',
      techId: tech1.id,
      diagnosis: 'Internal valve worn, accumulator lost charge.',
      quote: {
        items: [
          ['Valve rebuild kit', 'PART', 42000],
          ['Accumulator recharge', 'PART', 25000],
          ['Labour', 'LABOUR', 60000],
          ['Testing & calibration', 'TESTING', 18000],
        ],
        approved: true,
        paid: 145000,
      },
    },
    {
      customer: { fullName: 'Grace Eze', phone: '2348077770000', email: 'grace@example.com', location: 'Port Harcourt' },
      vehicle: { make: 'Audi', model: 'A8', year: 2018, registration: 'RSH118PH', type: 'CAR' },
      suspensionType: 'AIR',
      component: 'COMPRESSOR',
      position: '',
      symptoms: ['Compressor running continuously', 'Vehicle not raising'],
      description: 'Compressor keeps running and the car will not lift.',
      stage: 'REQUEST_SUBMITTED',
    },
  ];

  for (const d of demos) {
    const customer = await prisma.customer.create({ data: { ...d.customer, preferredContact: 'WHATSAPP', whatsapp: d.customer.phone } });
    const vehicle = await prisma.vehicle.create({ data: { ...d.vehicle, customerId: customer.id } });
    const repairId = await generateRepairId();
    const reachedIdx = STAGE_ORDER.indexOf(d.stage);
    const start = days(-(reachedIdx + 2));

    // Build a believable timeline up to the current stage.
    const path = STAGE_ORDER.slice(0, reachedIdx + 1).filter((s) => s !== 'QUOTE_SENT' && s !== 'CANCELLED' && s !== 'DISPATCHED' && s !== 'DELIVERED');
    const job = await prisma.repairJob.create({
      data: {
        repairId,
        trackToken: randomToken(),
        customerId: customer.id,
        vehicleId: vehicle.id,
        suspensionType: d.suspensionType,
        component: d.component,
        position: d.position || null,
        symptoms: d.symptoms,
        description: d.description,
        deliveryOption: 'DROP_OFF',
        stage: d.stage,
        technicianId: d.techId,
        faultFound: d.diagnosis,
        diagnosis: d.diagnosis,
        repairProcedure: reachedIdx >= STAGE_ORDER.indexOf('REPAIR_IN_PROGRESS') ? 'Disassembled, cleaned, replaced seals, reassembled.' : null,
        testResults: d.stage === 'COMPLETED' ? 'Pressure held 24h at spec. No leaks. Damping within tolerance.' : null,
        qcResult: d.stage === 'COMPLETED' ? 'PASS' : null,
        estimatedCompletion: days(3),
        receivedAt: reachedIdx >= STAGE_ORDER.indexOf('RECEIVED') ? start : null,
        completedAt: d.stage === 'COMPLETED' ? days(-1) : null,
        createdAt: start,
        history: {
          create: path.map((s, i) => ({
            stage: s,
            title: STAGES[s].label,
            note: s === 'DIAGNOSIS' && d.diagnosis ? d.diagnosis : STAGES[s].customerMessage,
            createdAt: new Date(start.getTime() + i * 6 * 3600000),
            createdById: i === 0 ? undefined : (d.techId ?? advisor.id),
          })),
        },
      },
    });

    if (d.quote) {
      const items = d.quote.items.map(([description, kind, naira]) => ({ description, kind, quantity: 1, unitPrice: naira * 100, amount: naira * 100 }));
      const total = items.reduce((s, i) => s + i.amount, 0);
      const quote = await prisma.quotation.create({
        data: {
          jobId: job.id,
          number: `Q-${repairId}-1`,
          status: d.quote.approved ? 'APPROVED' : 'SENT',
          subtotal: total,
          total,
          depositPercent: 50,
          validUntil: days(7),
          estimatedCompletion: days(3),
          sentAt: days(-1),
          respondedAt: d.quote.approved ? days(-1) : null,
          respondedBy: d.quote.approved ? d.customer.fullName : null,
          items: { create: items },
        },
      });
      if (d.quote.paid) {
        const amount = d.quote.paid * 100;
        await prisma.payment.create({
          data: {
            jobId: job.id,
            quotationId: quote.id,
            reference: `SEED-${repairId}`,
            provider: 'MOCK',
            channel: 'card',
            amount,
            status: 'SUCCESS',
            paidAt: days(-1),
            receiptNumber: `RCT-SEED-${repairId.slice(-5)}`,
          },
        });
        await prisma.repairJob.update({ where: { id: job.id }, data: { amountPaid: amount, paymentStatus: amount >= total ? 'PAID' : 'PARTIAL' } });
      }
    }

    if (d.stage === 'COMPLETED') {
      const startDate = days(-1);
      const expiry = new Date(startDate);
      expiry.setMonth(expiry.getMonth() + 6);
      await prisma.warranty.create({ data: { jobId: job.id, months: 6, startDate, expiryDate: expiry, terms: DEFAULT_WARRANTY_TERMS } });
    }

    console.log(`${repairId}  ${d.stage.padEnd(20)} track: phone ${d.customer.phone}`);
  }

  console.log(`\nStaff logins (password: ${DEMO_PASSWORD})\n  ${admin.email}\n  ${advisor.email}\n  ${tech1.email}\n  ${tech2.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
