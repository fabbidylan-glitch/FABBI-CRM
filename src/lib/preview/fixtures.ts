/**
 * Static preview fixtures.
 *
 * Mirrors the contents of prisma/seed.ts so the UI can render without a database
 * during scaffold / design review. Once Phase 1 wires up Prisma queries, these
 * fixtures will be replaced by real data and this file can be deleted.
 */

export type Grade = "A" | "B" | "C" | "D";

export const PIPELINE_STAGES = [
  "NEW_LEAD",
  "CONTACTED",
  "QUALIFIED",
  "CONSULT_BOOKED",
  "CONSULT_COMPLETED",
  "PROPOSAL_DRAFTING",
  "PROPOSAL_SENT",
  "FOLLOW_UP_NEGOTIATION",
  "WON",
  "LOST",
  "COLD_NURTURE",
] as const;
export type Stage = (typeof PIPELINE_STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  NEW_LEAD: "New Lead",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  CONSULT_BOOKED: "Consult Booked",
  CONSULT_COMPLETED: "Consult Completed",
  PROPOSAL_DRAFTING: "Proposal Drafting",
  PROPOSAL_SENT: "Proposal Sent",
  FOLLOW_UP_NEGOTIATION: "Follow-Up / Negotiation",
  WON: "Won",
  LOST: "Lost",
  COLD_NURTURE: "Cold Nurture",
};

export type Lead = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName?: string;
  niche: string;
  fitType: string;
  source: string;
  campaignName?: string;
  serviceInterest: string;
  annualRevenueRange: string;
  taxesPaidLastYearRange: string;
  propertyCount: string;
  urgency: string;
  states: string[];
  painPoint?: string;
  stage: Stage;
  qualification: "QUALIFIED" | "MANUAL_REVIEW" | "NURTURE_ONLY" | "DISQUALIFIED" | "UNREVIEWED";
  score: number;
  grade: Grade;
  estimatedAnnualValue?: number;
  ownerName?: string;
  w2IncomeFlag?: boolean;
  payrollFlag?: boolean;
  otherBusinessIncomeFlag?: boolean;
  /** Mirrors Prisma's LeadStatus. Defaults to ACTIVE when omitted. */
  status?: "ACTIVE" | "ARCHIVED" | "MERGED";
  createdAt: string;
  lastContactedAt?: string;
  nextActionAt?: string;
  nextActionTitle?: string;
  nextActionPriority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  lastStageChangeAt?: string;
};

export const LEADS: Lead[] = [
  {
    id: "lead-01",
    firstName: "Alex",
    lastName: "Morgan",
    email: "alex.morgan@example.com",
    phone: "+1 (512) 555-0101",
    niche: "High-Income STR Strategy",
    fitType: "ICP Premium",
    source: "Referral",
    serviceInterest: "Full-Service",
    annualRevenueRange: "$1M+",
    taxesPaidLastYearRange: "$100k+",
    propertyCount: "5–9",
    urgency: "Now",
    states: ["TX", "FL", "CO"],
    painPoint: "Current CPA doesn't understand STR cost segregation.",
    stage: "PROPOSAL_SENT",
    qualification: "QUALIFIED",
    score: 95,
    grade: "A",
    estimatedAnnualValue: 48000,
    ownerName: "Morgan Hayes",
    w2IncomeFlag: true,
    payrollFlag: true,
    otherBusinessIncomeFlag: true,
    createdAt: "2026-04-10T14:12:00Z",
    lastContactedAt: "2026-04-16T13:00:00Z",
    nextActionAt: "2026-04-22T16:00:00Z",
  },
  {
    id: "lead-02",
    firstName: "Priya",
    lastName: "Shah",
    email: "priya.shah@example.com",
    phone: "+1 (480) 555-0102",
    niche: "STR Owner",
    fitType: "ICP",
    source: "Google Ads",
    campaignName: "STR-Owners-Search",
    serviceInterest: "Bookkeeping + Tax",
    annualRevenueRange: "$500k–$1M",
    taxesPaidLastYearRange: "$50k–$100k",
    propertyCount: "2–4",
    urgency: "Next 30 days",
    states: ["AZ", "CA"],
    painPoint: "Wants to stop using Turbotax now that STR portfolio is scaling.",
    stage: "CONSULT_BOOKED",
    qualification: "QUALIFIED",
    score: 82,
    grade: "A",
    estimatedAnnualValue: 22000,
    ownerName: "Morgan Hayes",
    w2IncomeFlag: true,
    createdAt: "2026-04-12T09:30:00Z",
    lastContactedAt: "2026-04-17T18:44:00Z",
    nextActionAt: "2026-04-21T15:00:00Z",
  },
  {
    id: "lead-03",
    firstName: "Jonathan",
    lastName: "Okafor",
    email: "jonathan.okafor@example.com",
    phone: "+1 (718) 555-0103",
    niche: "Real Estate Investor",
    fitType: "ICP",
    source: "Meta Ads",
    campaignName: "REI-Tax-Strategy",
    serviceInterest: "Tax Strategy",
    annualRevenueRange: "$500k–$1M",
    taxesPaidLastYearRange: "$25k–$50k",
    propertyCount: "10+",
    urgency: "Now",
    states: ["NY", "NJ", "PA"],
    painPoint: "Large multi-state REI portfolio needs entity restructuring.",
    stage: "QUALIFIED",
    qualification: "QUALIFIED",
    score: 78,
    grade: "B",
    estimatedAnnualValue: 18000,
    ownerName: "Riley Chen",
    createdAt: "2026-04-14T11:02:00Z",
    lastContactedAt: "2026-04-18T21:15:00Z",
    nextActionAt: "2026-04-20T18:00:00Z",
  },
  {
    id: "lead-04",
    firstName: "Maya",
    lastName: "Rodriguez",
    email: "maya.rodriguez@example.com",
    phone: "+1 (305) 555-0104",
    niche: "Real Estate Investor",
    fitType: "ICP",
    source: "Landing Page",
    campaignName: "real-estate-investors",
    serviceInterest: "CFO",
    annualRevenueRange: "$1M+",
    taxesPaidLastYearRange: "$50k–$100k",
    propertyCount: "10+",
    urgency: "Next 30 days",
    states: ["FL", "GA"],
    painPoint: "Scaling rapidly, needs CFO-level financial planning.",
    stage: "NEW_LEAD",
    qualification: "MANUAL_REVIEW",
    score: 73,
    grade: "B",
    estimatedAnnualValue: 36000,
    payrollFlag: true,
    otherBusinessIncomeFlag: true,
    createdAt: "2026-04-19T16:40:00Z",
    nextActionAt: "2026-04-20T12:00:00Z",
  },
  {
    id: "lead-05",
    firstName: "Chris",
    lastName: "Nguyen",
    email: "chris.nguyen@example.com",
    phone: "+1 (206) 555-0105",
    niche: "Airbnb / VRBO Operator",
    fitType: "ICP",
    source: "Google Ads",
    campaignName: "STR-Owners-Search",
    serviceInterest: "Tax Strategy",
    annualRevenueRange: "$250k–$500k",
    taxesPaidLastYearRange: "$25k–$50k",
    propertyCount: "2–4",
    urgency: "Next 30 days",
    states: ["WA"],
    painPoint: "W-2 + STR combo, wants to use STR loophole.",
    stage: "CONTACTED",
    qualification: "QUALIFIED",
    score: 67,
    grade: "B",
    estimatedAnnualValue: 14000,
    ownerName: "Riley Chen",
    w2IncomeFlag: true,
    createdAt: "2026-04-15T10:18:00Z",
    lastContactedAt: "2026-04-18T14:20:00Z",
    nextActionAt: "2026-04-21T14:00:00Z",
  },
  {
    id: "lead-06",
    firstName: "Erin",
    lastName: "Walsh",
    email: "erin.walsh@example.com",
    phone: "+1 (617) 555-0106",
    niche: "General SMB",
    fitType: "Stretch",
    source: "Website",
    serviceInterest: "Bookkeeping",
    annualRevenueRange: "Under $250k",
    taxesPaidLastYearRange: "Under $10k",
    propertyCount: "None",
    urgency: "Researching",
    states: [],
    painPoint: "Solo consultant — revenue below ICP floor.",
    stage: "COLD_NURTURE",
    qualification: "DISQUALIFIED",
    score: 18,
    grade: "D",
    createdAt: "2026-04-13T20:02:00Z",
  },
  {
    id: "lead-07",
    firstName: "Daniel",
    lastName: "Kim",
    email: "daniel.kim@example.com",
    phone: "+1 (415) 555-0107",
    niche: "High-Income STR Strategy",
    fitType: "ICP Premium",
    source: "Partner Referral",
    serviceInterest: "Full-Service",
    annualRevenueRange: "$1M+",
    taxesPaidLastYearRange: "$100k+",
    propertyCount: "10+",
    urgency: "Now",
    states: ["CA", "NV", "HI"],
    painPoint: "Exited tech role, full-time REI investor with W-2 residual.",
    stage: "WON",
    qualification: "QUALIFIED",
    score: 98,
    grade: "A",
    estimatedAnnualValue: 60000,
    ownerName: "Morgan Hayes",
    w2IncomeFlag: true,
    otherBusinessIncomeFlag: true,
    createdAt: "2026-04-01T12:00:00Z",
    lastContactedAt: "2026-04-10T15:00:00Z",
  },
  {
    id: "lead-08",
    firstName: "Sophia",
    lastName: "Patel",
    email: "sophia.patel@example.com",
    phone: "+1 (646) 555-0108",
    niche: "STR Owner",
    fitType: "ICP",
    source: "Organic Branded",
    serviceInterest: "Bookkeeping + Tax",
    annualRevenueRange: "$250k–$500k",
    taxesPaidLastYearRange: "$10k–$25k",
    propertyCount: "2–4",
    urgency: "Next 30 days",
    states: ["NC", "SC"],
    painPoint: "Went with a cheaper provider after second call.",
    stage: "LOST",
    qualification: "NURTURE_ONLY",
    score: 52,
    grade: "C",
    createdAt: "2026-03-25T09:00:00Z",
    lastContactedAt: "2026-04-09T15:30:00Z",
  },
  {
    id: "lead-09",
    firstName: "Jordan",
    lastName: "Reeve",
    email: "jordan@reevesupply.co",
    phone: "+1 (512) 555-0109",
    niche: "E-commerce",
    fitType: "ICP",
    source: "Landing Page",
    serviceInterest: "Bookkeeping + Tax",
    annualRevenueRange: "$500k–$1M",
    taxesPaidLastYearRange: "$25k–$50k",
    propertyCount: "None",
    urgency: "Now",
    states: ["TX", "CA", "NY", "FL"],
    painPoint:
      "Shopify + Amazon reconciliation is a mess. No real margin visibility after COGS.",
    stage: "CONSULT_BOOKED",
    qualification: "QUALIFIED",
    score: 74,
    grade: "B",
    estimatedAnnualValue: 18000,
    ownerName: "Priya Shah",
    payrollFlag: true,
    createdAt: "2026-04-18T16:20:00Z",
    lastContactedAt: "2026-04-20T10:12:00Z",
    nextActionAt: "2026-04-24T15:00:00Z",
  },
  {
    id: "lead-10",
    firstName: "Maya",
    lastName: "Okonkwo",
    email: "maya@glowsupply.shop",
    phone: "+1 (332) 555-0110",
    niche: "E-commerce",
    fitType: "ICP",
    source: "Google Ads",
    serviceInterest: "Full-Service",
    annualRevenueRange: "$1M+",
    taxesPaidLastYearRange: "$50k–$100k",
    propertyCount: "None",
    urgency: "Next 30 days",
    states: ["NY", "NJ", "CA", "WA"],
    painPoint: "Scaling on Meta Ads, books are 3 months behind, sales tax scaring us.",
    stage: "QUALIFIED",
    qualification: "QUALIFIED",
    score: 88,
    grade: "A",
    estimatedAnnualValue: 42000,
    ownerName: "Morgan Hayes",
    payrollFlag: true,
    otherBusinessIncomeFlag: true,
    createdAt: "2026-04-20T11:45:00Z",
  },
];

export type TimelineEntry = {
  at: string;
  type:
    | "LEAD_CREATED"
    | "STAGE_CHANGED"
    | "NOTE_ADDED"
    | "COMMUNICATION_SENT"
    | "PROPOSAL_SENT"
    | "TASK_CREATED"
    | "HANDOFF_COMPLETED";
  title: string;
  body?: string;
  actor?: string;
};

export const TIMELINE: Record<string, TimelineEntry[]> = {
  "lead-01": [
    {
      at: "2026-04-10T14:12:00Z",
      type: "LEAD_CREATED",
      title: "Lead captured via partner referral",
      actor: "System",
    },
    {
      at: "2026-04-10T14:13:00Z",
      type: "COMMUNICATION_SENT",
      title: "Inquiry confirmation email sent",
      actor: "Automation",
    },
    {
      at: "2026-04-11T15:22:00Z",
      type: "STAGE_CHANGED",
      title: "Moved New Lead → Qualified",
      actor: "Morgan Hayes",
    },
    {
      at: "2026-04-12T17:05:00Z",
      type: "NOTE_ADDED",
      title: "Discovery call summary",
      body: "Alex runs a 7-property STR portfolio across TX/FL/CO. Wife is a W-2 earner; interested in STR loophole for current tax year. Currently with a local CPA who doesn't do cost seg.",
      actor: "Morgan Hayes",
    },
    {
      at: "2026-04-15T19:00:00Z",
      type: "PROPOSAL_SENT",
      title: "Proposal sent via Ignition — Full-Service Premium",
      body: "$4,000/mo · $48,000 annual",
      actor: "Morgan Hayes",
    },
    {
      at: "2026-04-16T13:00:00Z",
      type: "COMMUNICATION_SENT",
      title: "Proposal follow-up email (d+1)",
      actor: "Automation",
    },
    {
      at: "2026-04-19T09:00:00Z",
      type: "TASK_CREATED",
      title: "Call Alex re: proposal",
      body: "Due Apr 22 — walk through pricing questions.",
      actor: "Morgan Hayes",
    },
  ],
  "lead-02": [
    {
      at: "2026-04-12T09:30:00Z",
      type: "LEAD_CREATED",
      title: "Lead captured via Google Ads (STR-Owners-Search)",
      actor: "System",
    },
    {
      at: "2026-04-12T09:31:00Z",
      type: "COMMUNICATION_SENT",
      title: "Inquiry confirmation email + schedule SMS",
      actor: "Automation",
    },
    {
      at: "2026-04-14T14:02:00Z",
      type: "STAGE_CHANGED",
      title: "Moved Qualified → Consult Booked",
      actor: "Morgan Hayes",
    },
    {
      at: "2026-04-17T18:44:00Z",
      type: "NOTE_ADDED",
      title: "Pre-call prep",
      body: "2 properties in AZ, 1 in Joshua Tree. W-2 via Amazon. Wants bookkeeping + tax bundled.",
      actor: "Morgan Hayes",
    },
  ],
  "lead-07": [
    {
      at: "2026-04-01T12:00:00Z",
      type: "LEAD_CREATED",
      title: "Lead captured via partner referral (Rich Dad network)",
      actor: "System",
    },
    {
      at: "2026-04-05T20:00:00Z",
      type: "PROPOSAL_SENT",
      title: "Proposal sent — Full-Service Premium",
      body: "$5,000/mo · $60,000 annual",
      actor: "Morgan Hayes",
    },
    {
      at: "2026-04-10T15:00:00Z",
      type: "STAGE_CHANGED",
      title: "Moved Proposal Sent → Won",
      actor: "Morgan Hayes",
    },
    {
      at: "2026-04-11T11:15:00Z",
      type: "HANDOFF_COMPLETED",
      title: "Synced to Double",
      body: "Client record + onboarding tasks created in Double.",
      actor: "Automation",
    },
  ],
};

export type CommLog = {
  at: string;
  channel: "EMAIL" | "SMS" | "WHATSAPP" | "CALL" | "OTHER";
  direction: "OUTBOUND" | "INBOUND";
  subject?: string;
  preview: string;
  status: "DELIVERED" | "OPENED" | "CLICKED" | "REPLIED" | "SENT" | "FAILED";
};

export const COMMUNICATIONS: Record<string, CommLog[]> = {
  "lead-01": [
    {
      at: "2026-04-10T14:13:00Z",
      channel: "EMAIL",
      direction: "OUTBOUND",
      subject: "Thanks for reaching out to FABBI, Alex",
      preview: "Hi Alex, thanks for contacting FABBI. We specialize in tax strategy…",
      status: "OPENED",
    },
    {
      at: "2026-04-15T19:00:00Z",
      channel: "EMAIL",
      direction: "OUTBOUND",
      subject: "Your FABBI proposal",
      preview: "Alex — proposal attached via Ignition. Let me know if anything isn't clear.",
      status: "CLICKED",
    },
    {
      at: "2026-04-16T13:00:00Z",
      channel: "EMAIL",
      direction: "OUTBOUND",
      subject: "Following up on your proposal",
      preview: "Wanted to make sure the proposal arrived OK…",
      status: "DELIVERED",
    },
  ],
  "lead-02": [
    {
      at: "2026-04-12T09:31:00Z",
      channel: "EMAIL",
      direction: "OUTBOUND",
      subject: "Thanks for reaching out to FABBI, Priya",
      preview: "Hi Priya, thanks for contacting FABBI…",
      status: "OPENED",
    },
    {
      at: "2026-04-12T09:36:00Z",
      channel: "SMS",
      direction: "OUTBOUND",
      preview: "Hi Priya, Morgan from FABBI. Grab a time here: calendly.com/fabbi/consult",
      status: "DELIVERED",
    },
    {
      at: "2026-04-13T14:20:00Z",
      channel: "SMS",
      direction: "INBOUND",
      preview: "Just booked — see you Friday!",
      status: "REPLIED",
    },
  ],
};

export type TaskItem = {
  id: string;
  leadId: string;
  title: string;
  type: "CALL" | "EMAIL" | "SMS" | "MEETING" | "REVIEW";
  dueAt: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  assignee: string;
};

export const TASKS: TaskItem[] = [
  {
    id: "task-1",
    leadId: "lead-01",
    title: "Call Alex re: proposal",
    type: "CALL",
    dueAt: "2026-04-22T16:00:00Z",
    priority: "HIGH",
    assignee: "Morgan Hayes",
  },
  {
    id: "task-2",
    leadId: "lead-03",
    title: "Send Jonathan entity-restructuring one-pager",
    type: "EMAIL",
    dueAt: "2026-04-20T18:00:00Z",
    priority: "MEDIUM",
    assignee: "Riley Chen",
  },
  {
    id: "task-3",
    leadId: "lead-04",
    title: "Qualification review for Maya (MANUAL_REVIEW)",
    type: "REVIEW",
    dueAt: "2026-04-20T12:00:00Z",
    priority: "URGENT",
    assignee: "Morgan Hayes",
  },
];

export type SourcePerf = {
  source: string;
  leads: number;
  qualified: number;
  consults: number;
  proposals: number;
  won: number;
  wonArr: number;
  spend: number;
};

export const SOURCE_PERFORMANCE: SourcePerf[] = [
  { source: "Partner Referral", leads: 6, qualified: 6, consults: 5, proposals: 4, won: 3, wonArr: 162000, spend: 0 },
  { source: "Google Ads · STR-Owners-Search", leads: 49, qualified: 22, consults: 14, proposals: 6, won: 2, wonArr: 44000, spend: 9300 },
  { source: "Meta Ads · REI-Tax-Strategy", leads: 14, qualified: 7, consults: 4, proposals: 2, won: 1, wonArr: 18000, spend: 2800 },
  { source: "Landing Page · real-estate-investors", leads: 11, qualified: 6, consults: 3, proposals: 2, won: 1, wonArr: 36000, spend: 0 },
  { source: "Organic Branded", leads: 18, qualified: 9, consults: 5, proposals: 3, won: 1, wonArr: 24000, spend: 0 },
];

export const DASHBOARD_KPIS = {
  leadsThisMonth: 98,
  qualifiedThisMonth: 42,
  consultsBookedThisMonth: 27,
  proposalsSent: 12,
  wonThisMonth: 4,
  wonArrThisMonth: 186000,
  pipelineValue: 414000,
  avgResponseMinutes: 7,
  showRate: 0.81,
  closeRate: 0.33,
};

export function gradeColor(g: Grade) {
  return (
    {
      A: "bg-brand-blue text-white ring-brand-blue",
      B: "bg-brand-blue-tint text-brand-blue ring-brand-blue-soft",
      C: "bg-amber-100 text-amber-800 ring-amber-200",
      D: "bg-rose-100 text-rose-800 ring-rose-200",
    } as const
  )[g];
}

export function stageColor(s: Stage) {
  const map: Record<Stage, string> = {
    NEW_LEAD: "bg-slate-100 text-slate-700 ring-slate-200",
    CONTACTED: "bg-slate-100 text-slate-700 ring-slate-200",
    QUALIFIED: "bg-brand-blue-tint text-brand-blue ring-brand-blue-soft",
    CONSULT_BOOKED: "bg-brand-blue-tint text-brand-blue-dark ring-brand-blue-soft",
    CONSULT_COMPLETED: "bg-brand-blue-tint text-brand-blue-dark ring-brand-blue-soft",
    PROPOSAL_DRAFTING: "bg-amber-100 text-amber-800 ring-amber-200",
    PROPOSAL_SENT: "bg-amber-100 text-amber-800 ring-amber-200",
    FOLLOW_UP_NEGOTIATION: "bg-amber-100 text-amber-800 ring-amber-200",
    WON: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    LOST: "bg-rose-100 text-rose-800 ring-rose-200",
    COLD_NURTURE: "bg-slate-100 text-slate-500 ring-slate-200",
  };
  return map[s];
}

export function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function formatRelative(iso: string) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const absMs = Math.abs(diffMs);
  const min = Math.round(absMs / 60000);
  const hr = Math.round(absMs / 3600000);
  const d = Math.round(absMs / 86400000);
  const suffix = diffMs >= 0 ? "ago" : "from now";
  if (absMs < 60_000) return "just now";
  if (min < 60) return `${min}m ${suffix}`;
  if (hr < 48) return `${hr}h ${suffix}`;
  return `${d}d ${suffix}`;
}
