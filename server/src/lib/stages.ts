import type { RepairStage } from '@prisma/client';

type StageInfo = { label: string; customerMessage: string; notify: boolean };

// Order matters: this is the customer-facing progress order.
export const STAGES: Record<RepairStage, StageInfo> = {
  REQUEST_SUBMITTED: { label: 'Request Submitted', customerMessage: 'We have received your repair request.', notify: true },
  AWAITING_COMPONENT: { label: 'Awaiting Component', customerMessage: 'We are waiting for your component to arrive at the workshop.', notify: false },
  RECEIVED: { label: 'Received', customerMessage: 'Your component has been received at the workshop.', notify: true },
  INSPECTION: { label: 'Inspection', customerMessage: 'A technician has started inspecting your component.', notify: false },
  DIAGNOSIS: { label: 'Diagnosis', customerMessage: 'Diagnosis is complete. The fault has been identified.', notify: true },
  QUOTE_SENT: { label: 'Quote Sent', customerMessage: 'Your repair quotation is ready to view.', notify: true },
  AWAITING_APPROVAL: { label: 'Awaiting Approval', customerMessage: 'Your approval is required before we continue.', notify: true },
  PARTS_SOURCING: { label: 'Parts Sourcing', customerMessage: 'Repair approved. We are sourcing the required parts.', notify: false },
  REPAIR_IN_PROGRESS: { label: 'Repair in Progress', customerMessage: 'Your component is being repaired/rebuilt.', notify: true },
  TESTING: { label: 'Testing', customerMessage: 'Your component is undergoing pressure, leak and performance testing.', notify: true },
  QUALITY_CONTROL: { label: 'Quality Control', customerMessage: 'Final quality-control inspection in progress.', notify: false },
  READY_FOR_COLLECTION: { label: 'Ready for Collection', customerMessage: 'Repair complete! Your component is ready.', notify: true },
  DISPATCHED: { label: 'Dispatched', customerMessage: 'Your component has been dispatched.', notify: true },
  DELIVERED: { label: 'Delivered', customerMessage: 'Your component has been delivered.', notify: true },
  COMPLETED: { label: 'Completed', customerMessage: 'Your repair is complete. Thank you for choosing Airride.', notify: false },
  CANCELLED: { label: 'Cancelled', customerMessage: 'This repair has been cancelled.', notify: true },
};

export const STAGE_ORDER = Object.keys(STAGES) as RepairStage[];

export const ACTIVE_STAGES = STAGE_ORDER.filter((s) => !['COMPLETED', 'CANCELLED', 'DELIVERED'].includes(s));

export const COMPONENT_LABELS: Record<string, string> = {
  SHOCK_ABSORBER: 'Shock Absorber',
  AIR_STRUT: 'Air Strut',
  HYDRAULIC_STRUT: 'Hydraulic Strut',
  AIR_SPRING: 'Air Spring',
  HYDRAULIC_CYLINDER: 'Hydraulic Cylinder',
  VALVE_BLOCK: 'Valve Block',
  COMPRESSOR: 'Compressor',
  PUMP: 'Pump',
  AUTOMATIC_TRANSMISSION: 'Automatic Transmission',
  OTHER: 'Other',
};
