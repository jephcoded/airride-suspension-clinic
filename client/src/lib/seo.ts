/**
 * What Google shows for each public page (title + description). Used twice:
 * at build time to write a ready-made HTML file per page, and in the browser when moving between pages.
 */
export type PageSeo = { title: string; description: string };

export const SITE_NAME = 'Airride Suspension Clinic';

export const PAGE_SEO: Record<string, PageSeo> = {
  '/': {
    title: 'Suspension, Shock Absorber & Automatic Transmission Repair in Lagos | Airride',
    description:
      'Airride Suspension Clinic repairs and rebuilds air suspension, hydraulic suspension, shock absorbers and automatic transmissions in Lagos, Nigeria. Book online, approve your quote and track your repair live.',
  },
  '/services': {
    title: 'Suspension, Shock Absorber & Automatic Transmission Services | Airride',
    description:
      'Air springs, air struts, hydraulic struts, shock absorbers, compressors, valve blocks and automatic transmissions repaired and rebuilt for cars, SUVs, trucks and buses. Tested and warranted.',
  },
  '/about': {
    title: 'About Us | Airride Suspension Clinic',
    description:
      'Airride Suspension Clinic repairs and rebuilds air suspension, hydraulic suspension and shock absorbers for drivers and fleets across Nigeria.',
  },
  '/book': {
    title: 'Book a Repair Online | Airride Suspension Clinic',
    description: 'Book your suspension or automatic transmission repair in about 3 minutes. Get a Repair ID straight away and follow every step of the repair live.',
  },
  '/track': {
    title: 'Track My Repair | Airride Suspension Clinic',
    description: 'Enter your Repair ID to see live progress, workshop photos, your quote and payments for your suspension repair.',
  },
  '/quote': {
    title: 'Get a Suspension Repair Quote | Airride Suspension Clinic',
    description: "Tell us what's wrong with your suspension and get an idea of the repair cost. Exact quotations after inspection.",
  },
  '/warranty': {
    title: 'Repair Warranty | Airride Suspension Clinic',
    description: 'Every Airride repair comes with a warranty stored digitally against your Repair ID. Check your warranty status any time.',
  },
  '/faqs': {
    title: 'Suspension Repair FAQs | Airride Suspension Clinic',
    description: 'Answers to common questions about air suspension, hydraulic suspension and shock absorber repair, booking, pricing, warranty and tracking.',
  },
  '/contact': {
    title: 'Contact Us | Airride Suspension Clinic',
    description: 'Call, WhatsApp or email Airride Suspension Clinic, or visit our workshop in Lagos. For repairs, the fastest way is to book online.',
  },
};

/** Pages Google should not list: private customer/staff screens and unknown addresses. */
export function isIndexable(path: string) {
  return path in PAGE_SEO;
}
