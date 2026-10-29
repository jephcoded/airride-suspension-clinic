export type Stage =
  | 'REQUEST_SUBMITTED'
  | 'AWAITING_COMPONENT'
  | 'RECEIVED'
  | 'INSPECTION'
  | 'DIAGNOSIS'
  | 'QUOTE_SENT'
  | 'AWAITING_APPROVAL'
  | 'PARTS_SOURCING'
  | 'REPAIR_IN_PROGRESS'
  | 'TESTING'
  | 'QUALITY_CONTROL'
  | 'READY_FOR_COLLECTION'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED';

export const STAGE_LABELS: Record<Stage, string> = {
  REQUEST_SUBMITTED: 'Request Submitted',
  AWAITING_COMPONENT: 'Awaiting Component',
  RECEIVED: 'Received',
  INSPECTION: 'Inspection',
  DIAGNOSIS: 'Diagnosis',
  QUOTE_SENT: 'Quote Sent',
  AWAITING_APPROVAL: 'Awaiting Approval',
  PARTS_SOURCING: 'Parts Sourcing',
  REPAIR_IN_PROGRESS: 'Repair in Progress',
  TESTING: 'Testing',
  QUALITY_CONTROL: 'Quality Control',
  READY_FOR_COLLECTION: 'Ready for Collection',
  DISPATCHED: 'Dispatched',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const STAGE_ORDER = Object.keys(STAGE_LABELS) as Stage[];

/** The simplified milestones a customer sees on the progress bar. Each maps to the detailed stages it covers. */
export const CUSTOMER_MILESTONES: { label: string; stages: Stage[] }[] = [
  { label: 'Submitted', stages: ['REQUEST_SUBMITTED', 'AWAITING_COMPONENT'] },
  { label: 'Received', stages: ['RECEIVED'] },
  { label: 'Diagnosis', stages: ['INSPECTION', 'DIAGNOSIS'] },
  { label: 'Quote', stages: ['QUOTE_SENT', 'AWAITING_APPROVAL'] },
  { label: 'Repairing', stages: ['PARTS_SOURCING', 'REPAIR_IN_PROGRESS'] },
  { label: 'Testing', stages: ['TESTING', 'QUALITY_CONTROL'] },
  { label: 'Ready', stages: ['READY_FOR_COLLECTION', 'DISPATCHED'] },
  { label: 'Delivered', stages: ['DELIVERED', 'COMPLETED'] },
];

export const SUSPENSION_TYPES = [
  { value: 'AIR', label: 'Air suspension' },
  { value: 'HYDRAULIC', label: 'Hydraulic suspension' },
  { value: 'ELECTRONIC', label: 'Electronic / Adaptive' },
  { value: 'UNKNOWN', label: 'Unknown' },
] as const;

export const COMPONENTS = [
  { value: 'SHOCK_ABSORBER', label: 'Shock absorber' },
  { value: 'AIR_STRUT', label: 'Air strut' },
  { value: 'HYDRAULIC_STRUT', label: 'Hydraulic strut' },
  { value: 'AIR_SPRING', label: 'Air spring / bag' },
  { value: 'HYDRAULIC_CYLINDER', label: 'Hydraulic cylinder' },
  { value: 'VALVE_BLOCK', label: 'Valve block' },
  { value: 'COMPRESSOR', label: 'Compressor' },
  { value: 'PUMP', label: 'Pump' },
  { value: 'AUTOMATIC_TRANSMISSION', label: 'Automatic transmission' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const COMPONENT_LABELS: Record<string, string> = Object.fromEntries(COMPONENTS.map((c) => [c.value, c.label]));

export const POSITIONS = ['Front Left', 'Front Right', 'Rear Left', 'Rear Right', 'Front Pair', 'Rear Pair', 'All Four', 'N/A'];

/** The booking form's component choices for suspension jobs (transmission is chosen separately). */
export const SUSPENSION_COMPONENTS = COMPONENTS.filter((c) => c.value !== 'AUTOMATIC_TRANSMISSION');

export const TRANSMISSION_SYMPTOMS = [
  'Slipping gears',
  'Delayed engagement',
  'Harsh or jerky shifting',
  'Stuck in one gear / limp mode',
  'No drive or reverse',
  'Transmission warning light',
  'Fluid leak',
  'Burning smell',
  'Whining or grinding noise',
  'Overheating',
];

export const SYMPTOMS = [
  'Oil leak',
  'Air leak',
  'Vehicle sinking',
  'Vehicle leaning',
  'Suspension too hard',
  'Suspension too soft',
  'Knocking sound',
  'Vehicle not raising',
  'Vehicle not lowering',
  'Compressor running continuously',
  'Warning light',
  'Uneven ride height',
  'Other',
];

export const VEHICLE_TYPES = [
  { value: 'CAR', label: 'Car' },
  { value: 'SUV', label: 'SUV' },
  { value: 'TRUCK', label: 'Truck' },
  { value: 'BUS', label: 'Bus' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const CONTACT_METHODS = [
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'PHONE', label: 'Phone call' },
  { value: 'SMS', label: 'SMS' },
  { value: 'EMAIL', label: 'Email' },
] as const;

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  AWAITING: 'Awaiting payment',
  PARTIAL: 'Partially paid',
  PAID: 'Paid',
  REFUNDED: 'Refunded',
};

export type Business = {
  name: string;
  phone: string;
  phoneHref: string;
  whatsappHref: string;
  email: string;
  address: string;
  hours: string;
  mapsHref: string;
  warrantyMonths: number;
};

/**
 * Business details shown across the site. Filled at startup from the server (admin → Settings),
 * so nothing here is hard-coded business data; these are only fallbacks if the server is unreachable.
 */
export const BUSINESS: Business = {
  name: 'Airride Suspension Clinic',
  phone: '0703 306 0775',
  phoneHref: 'tel:+2347033060775',
  whatsappHref: 'https://wa.me/2347033060775',
  email: '',
  address: '',
  hours: 'Mon – Sat, 8:00am – 6:00pm',
  mapsHref: '',
  warrantyMonths: 6,
};

export function setBusiness(b: Partial<Business>) {
  Object.assign(BUSINESS, Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined && v !== null)));
}

/** Address line for customer-facing text, with a sensible fallback before the admin fills it in. */
export function workshopAddress() {
  return BUSINESS.address || 'our workshop (call us for directions)';
}
