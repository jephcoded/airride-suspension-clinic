import { Activity, Cog, Droplets, Gauge, ScanSearch, Settings2, Wind, Wrench, Zap } from 'lucide-react';

/** Shared website copy: used by the pages and by the site search. */

export const SERVICES = [
  {
    id: 'air-suspension',
    icon: Wind,
    title: 'Air Suspension Repair',
    text: 'Complete diagnosis and repair of air suspension systems — from leaking bags and struts to faulty height sensors and control valves.',
    points: ['Leak detection & air-line repair', 'Height sensor & control faults', 'Full system pressure test'],
  },
  {
    id: 'hydraulic-suspension',
    icon: Droplets,
    title: 'Hydraulic Suspension Repair',
    text: 'Repair of hydraulic and hydro-pneumatic suspension including active body control (ABC), struts, accumulators and lines.',
    points: ['Strut & accumulator service', 'Hydraulic line and valve repair', 'Fluid flush & bleeding'],
  },
  {
    id: 'shock-rebuilding',
    icon: Wrench,
    title: 'Shock Absorber Rebuilding',
    text: 'We strip, clean, re-seal and re-valve shock absorbers to restore factory damping — often for a fraction of the cost of new.',
    points: ['New seals, oil & bushes', 'Rod inspection & re-chroming', 'Damping force test'],
  },
  {
    id: 'automatic-transmission',
    icon: Cog,
    title: 'Automatic Transmission Rebuilding',
    text: 'Automatic gearboxes stripped, cleaned and rebuilt to fix slipping, harsh shifting, delayed engagement and limp mode, then road-tested before return.',
    points: ['Clutch packs, seals & gaskets', 'Valve body & solenoid repair', 'Fluid service & road test'],
  },
  {
    id: 'air-strut',
    icon: Gauge,
    title: 'Air Strut Rebuilding',
    text: 'Air strut rebuilding with new air bag membranes, crimp rings and seals, followed by 24-hour leak testing.',
    points: ['New membrane & crimp rings', 'Damper unit inspection', '24-hour leak-down test'],
  },
  {
    id: 'hydraulic-strut',
    icon: Settings2,
    title: 'Hydraulic Strut Repair',
    text: 'Restoration of hydraulic struts for luxury vehicles and commercial applications with full pressure testing.',
    points: ['Seal kit replacement', 'Piston & cylinder inspection', 'Pressure & leak test'],
  },
  {
    id: 'compressor',
    icon: Zap,
    title: 'Compressor Repair',
    text: 'Air suspension compressor rebuilds — piston rings, dryers, relays and thermal fuses — to stop overrunning and slow lifting.',
    points: ['Piston ring & cylinder', 'Air dryer replacement', 'Output pressure & duty test'],
  },
  {
    id: 'pump',
    icon: Cog,
    title: 'Hydraulic Pump Repair',
    text: 'Tandem and suspension pump rebuilding for ABC and hydraulic systems, tested for flow and pressure.',
    points: ['Seal & bearing replacement', 'Flow & pressure test', 'Noise diagnosis'],
  },
  {
    id: 'diagnostics',
    icon: ScanSearch,
    title: 'Suspension Diagnostics',
    text: "Not sure what's wrong? Computer diagnostics and physical inspection to pinpoint the exact fault before any money is spent.",
    points: ['Fault code reading', 'Physical inspection', 'Written diagnosis report'],
  },
  {
    id: 'calibration',
    icon: Activity,
    title: 'Testing & Calibration',
    text: 'Ride-height calibration and performance testing after repair, so your vehicle sits level and rides as designed.',
    points: ['Ride-height calibration', 'Bench & road testing', 'Documented results'],
  },
];

export const FAQS: [string, string][] = [
  ['How do I know if my suspension needs repair?', 'Common signs include the vehicle sinking overnight, leaning to one side, a suspension warning light, the compressor running constantly, oil leaking from a shock or strut, knocking over bumps, or a ride that feels too hard or too soft.'],
  ['Is rebuilding as good as buying a new part?', 'A professional rebuild replaces the worn seals, membranes and internal parts, and we test every unit before it leaves. For most components this restores factory performance at a fraction of the price of a new part — and it is covered by our warranty.'],
  ['How long does a repair take?', 'Most rebuilds take 2–5 working days after we receive the component, depending on parts availability. You will see an estimated completion date on your quotation and in your repair tracker.'],
  ['Do I need to bring the whole vehicle?', 'Not always. You can bring or ship only the removed component. If you need us to remove and refit it, choose pickup or bring the vehicle — we will advise when we contact you.'],
  ['Will I be charged before I approve?', 'No. We inspect and diagnose the component, then send you a digital quotation. Nothing is repaired until you approve it online.'],
  ['How do I pay?', 'Once you approve your quotation, you pay at the workshop by cash or bank transfer. Depending on the job, a deposit may be needed to start and the balance is paid before collection. Every payment gets a receipt on your tracking page.'],
  ['How do I track my repair?', 'Use your Repair ID (for example ARC-2026-00125) and the phone number you booked with on the Track My Repair page. We also send WhatsApp, SMS and email updates at each key stage.'],
  ['Do you accept components from outside Lagos?', 'Yes. Choose "I will ship the component" when booking and follow the shipping instructions. We will ship it back to you after repair.'],
  ['What warranty do I get?', 'Every repair comes with a warranty — the period is shown on your quotation. Your warranty is stored against your Repair ID and you can open a claim online.'],
];
