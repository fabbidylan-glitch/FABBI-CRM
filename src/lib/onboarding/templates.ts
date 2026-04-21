import type { OnboardingStage } from "@prisma/client";

/**
 * Onboarding templates — kept in code (not DB) so ops can iterate on checklists
 * via PR rather than via a config UI we haven't built yet. If these stabilize
 * and start needing per-client tweaks, we move them to a DB table.
 *
 * Every template materializes a list of checklist items when an onboarding is
 * created. The full stage ladder (from the OnboardingStage enum) is shown on
 * every onboarding — templates don't hide stages, they just drive the items.
 */

export type ChecklistItemKind = "DOCUMENT" | "ACCESS" | "QUESTION" | "SETUP";

export type TemplateItem = {
  kind: ChecklistItemKind;
  label: string;
  /** Short helper shown under the label — what/why/where to look. */
  description?: string;
};

export type OnboardingTemplate = {
  key: string;
  name: string;
  summary: string;
  items: TemplateItem[];
};

/** Items shared by every onboarding regardless of template. */
const SHARED_ITEMS: TemplateItem[] = [
  {
    kind: "ACCESS",
    label: "QuickBooks Online / Xero admin access",
    description: "Invite fabbi@fabbi.co or dylan@fabbi.co as company admin.",
  },
  {
    kind: "ACCESS",
    label: "Bank login (view-only) or statement uploads",
    description: "Use a view-only secondary user if supported; otherwise 12 months of PDF statements.",
  },
  {
    kind: "ACCESS",
    label: "Credit card statements (last 12 months)",
  },
  {
    kind: "DOCUMENT",
    label: "Prior accountant contact info (for file handoff)",
    description: "Name + email of the person we'll request prior-year files from.",
  },
  {
    kind: "QUESTION",
    label: "Preferred close date each month",
    description: "We'll target this date for monthly book close + reporting.",
  },
];

const BOOKKEEPING_CORE: TemplateItem[] = [
  {
    kind: "DOCUMENT",
    label: "Prior-year financials (P&L, balance sheet)",
    description: "Even if messy — helps us validate opening balances.",
  },
  {
    kind: "DOCUMENT",
    label: "Chart of accounts (if non-standard)",
  },
  {
    kind: "SETUP",
    label: "Book opening balances validated",
    description: "Internal task — bookkeeper confirms beginning balances tie out.",
  },
];

const TAX_CORE: TemplateItem[] = [
  {
    kind: "DOCUMENT",
    label: "Prior-year federal tax return (entity + personal if applicable)",
  },
  {
    kind: "DOCUMENT",
    label: "Prior-year state tax returns",
  },
  {
    kind: "DOCUMENT",
    label: "EIN / entity formation documents",
  },
  {
    kind: "QUESTION",
    label: "Are there any pending notices or audits?",
  },
];

const STR_SPECIFIC: TemplateItem[] = [
  {
    kind: "ACCESS",
    label: "Airbnb / VRBO host account access",
    description: "At minimum, read-only / CSV export permission for transaction history.",
  },
  {
    kind: "DOCUMENT",
    label: "Property list with addresses + acquisition dates",
    description: "We'll track each property as a class/location in the books.",
  },
  {
    kind: "QUESTION",
    label: "Who handles cleaners/vendors — rep or external mgmt co?",
    description: "Determines whether we're booking vendor expenses or just receiving a net deposit.",
  },
];

const ADVISORY_SPECIFIC: TemplateItem[] = [
  {
    kind: "QUESTION",
    label: "Top 3 business goals for the next 12 months",
  },
  {
    kind: "QUESTION",
    label: "Biggest financial blind spot today",
    description: "Cash flow? Unit economics? Tax exposure?",
  },
  {
    kind: "SETUP",
    label: "Schedule monthly/quarterly advisory cadence",
  },
];

const CLEANUP_SPECIFIC: TemplateItem[] = [
  {
    kind: "DOCUMENT",
    label: "Last clean P&L / balance sheet date",
    description: "So we know exactly how far back the catch-up reaches.",
  },
  {
    kind: "QUESTION",
    label: "Known problem areas (payroll, 1099s, personal/business mixing)?",
  },
  {
    kind: "SETUP",
    label: "Catch-up scope confirmed and kickoff scheduled",
  },
];

const PAYROLL_SPECIFIC: TemplateItem[] = [
  {
    kind: "ACCESS",
    label: "Payroll provider access (Gusto / ADP / Paychex / Rippling)",
  },
  {
    kind: "DOCUMENT",
    label: "Most recent payroll summary",
  },
];

export const ONBOARDING_TEMPLATES: Record<string, OnboardingTemplate> = {
  bookkeeping_only_v1: {
    key: "bookkeeping_only_v1",
    name: "Bookkeeping only",
    summary: "Monthly bookkeeping, no tax work.",
    items: [...SHARED_ITEMS, ...BOOKKEEPING_CORE],
  },
  bookkeeping_plus_tax_v1: {
    key: "bookkeeping_plus_tax_v1",
    name: "Bookkeeping + Tax",
    summary: "Monthly bookkeeping with annual tax prep bundled.",
    items: [...SHARED_ITEMS, ...BOOKKEEPING_CORE, ...TAX_CORE],
  },
  tax_only_v1: {
    key: "tax_only_v1",
    name: "Tax only",
    summary: "Annual tax prep only — no bookkeeping engagement.",
    items: [
      {
        kind: "ACCESS",
        label: "Bookkeeping platform read-only access",
        description: "Just enough to pull the year-end P&L / BS.",
      },
      {
        kind: "QUESTION",
        label: "Preferred close date each month",
      },
      ...TAX_CORE,
    ],
  },
  catchup_cleanup_v1: {
    key: "catchup_cleanup_v1",
    name: "Catch-up / Cleanup",
    summary: "Retrospective cleanup before recurring service begins.",
    items: [...SHARED_ITEMS, ...BOOKKEEPING_CORE, ...CLEANUP_SPECIFIC],
  },
  str_client_v1: {
    key: "str_client_v1",
    name: "STR / real estate client",
    summary: "Bookkeeping with short-term-rental / real estate specifics.",
    items: [...SHARED_ITEMS, ...BOOKKEEPING_CORE, ...STR_SPECIFIC, ...TAX_CORE],
  },
  advisory_cfo_v1: {
    key: "advisory_cfo_v1",
    name: "Advisory / Fractional CFO",
    summary: "Recurring advisory engagement on top of clean books.",
    items: [...SHARED_ITEMS, ...BOOKKEEPING_CORE, ...ADVISORY_SPECIFIC],
  },
  payroll_addon_v1: {
    key: "payroll_addon_v1",
    name: "Bookkeeping + Payroll oversight",
    summary: "Monthly bookkeeping with payroll module oversight.",
    items: [...SHARED_ITEMS, ...BOOKKEEPING_CORE, ...PAYROLL_SPECIFIC],
  },
};

export function getTemplate(key: string | null | undefined): OnboardingTemplate {
  if (key && ONBOARDING_TEMPLATES[key]) return ONBOARDING_TEMPLATES[key];
  return ONBOARDING_TEMPLATES.bookkeeping_only_v1;
}

/** Ordered stage ladder — single source of truth for the UI progress bar. */
export const ONBOARDING_STAGE_ORDER: OnboardingStage[] = [
  "SIGNED",
  "WELCOME_SENT",
  "PAYMENT_COLLECTED",
  "ENGAGEMENT_COMPLETED",
  "DOCS_REQUESTED",
  "DOCS_RECEIVED",
  "ACCESS_RECEIVED",
  "QUESTIONNAIRE_COMPLETE",
  "KICKOFF_SCHEDULED",
  "ACCOUNT_SETUP_COMPLETE",
  "READY_FOR_RECURRING",
  "COMPLETE",
];

export const STAGE_LABEL: Record<OnboardingStage, string> = {
  SIGNED: "Signed",
  WELCOME_SENT: "Welcome sent",
  PAYMENT_COLLECTED: "Payment collected",
  ENGAGEMENT_COMPLETED: "Engagement completed",
  DOCS_REQUESTED: "Docs requested",
  DOCS_RECEIVED: "Docs received",
  ACCESS_RECEIVED: "Access received",
  QUESTIONNAIRE_COMPLETE: "Questionnaire complete",
  KICKOFF_SCHEDULED: "Kickoff scheduled",
  ACCOUNT_SETUP_COMPLETE: "Account setup complete",
  READY_FOR_RECURRING: "Ready for recurring",
  COMPLETE: "Complete",
};

export function stageIndex(stage: OnboardingStage): number {
  return ONBOARDING_STAGE_ORDER.indexOf(stage);
}

export function nextStage(stage: OnboardingStage): OnboardingStage | null {
  const i = stageIndex(stage);
  if (i < 0 || i >= ONBOARDING_STAGE_ORDER.length - 1) return null;
  return ONBOARDING_STAGE_ORDER[i + 1];
}

/** The three "required to complete" steps — block final COMPLETE until these are done. */
export const REQUIRED_BEFORE_COMPLETE: OnboardingStage[] = [
  "DOCS_RECEIVED",
  "ACCESS_RECEIVED",
  "ACCOUNT_SETUP_COMPLETE",
];
