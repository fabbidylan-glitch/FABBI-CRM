import { z } from "zod";

/**
 * Shared scoping schema — the shape of the input the rep fills out in the
 * pricing engine. Persisted as-is into Quote.scopingInputs (JSONB), so we can
 * iterate on questions without breaking historical quotes.
 *
 * Kept deliberately terse: defaults align to the "simple S-Corp, 1 entity"
 * baseline so an empty form still yields a usable starting price.
 */
export const ScopingInputSchema = z.object({
  // Business shape
  industry: z.string().default("GENERAL"),
  entityType: z
    .enum(["SOLE_PROP", "LLC", "S_CORP", "C_CORP", "PARTNERSHIP", "OTHER"])
    .default("LLC"),
  entityCount: z.coerce.number().int().min(1).max(50).default(1),

  // Books + accounts
  monthlyTxnVolume: z.coerce.number().int().min(0).max(50000).default(100),
  bankAccounts: z.coerce.number().int().min(0).max(100).default(1),
  creditCardAccounts: z.coerce.number().int().min(0).max(100).default(1),

  // Operational modules
  payroll: z.boolean().default(false),
  payrollEmployees: z.coerce.number().int().min(0).max(500).default(0),
  salesTax: z.boolean().default(false),
  salesTaxStates: z.coerce.number().int().min(0).max(50).default(0),
  apArTracking: z.boolean().default(false),
  inventory: z.boolean().default(false),
  classLocationTracking: z.boolean().default(false),
  multiStateOperations: z.coerce.number().int().min(0).max(50).default(0),

  // One-time work
  cleanupMonths: z.coerce.number().int().min(0).max(72).default(0),
  taxScope: z
    .enum(["NONE", "PERSONAL_1040", "BUSINESS_RETURN", "PERSONAL_PLUS_BUSINESS", "MULTI_ENTITY"])
    .default("NONE"),

  // Advisory
  advisoryLevel: z.enum(["NONE", "QUARTERLY", "MONTHLY", "FRACTIONAL_CFO"]).default("NONE"),

  // Freeform + meta
  complexityNotes: z.string().max(4000).optional(),
  packageKey: z.string().optional(),
});

export type ScopingInput = z.infer<typeof ScopingInputSchema>;

export const SCOPING_DEFAULTS: ScopingInput = ScopingInputSchema.parse({});

/**
 * Question catalog for the form UI. Order matters — this is the tab order the
 * rep will see. `section` groups related questions on the page.
 */
export type QuestionSection =
  | "Business shape"
  | "Books + accounts"
  | "Operational modules"
  | "One-time work"
  | "Advisory"
  | "Notes";

export const SCOPING_QUESTIONS: Array<{
  key: keyof ScopingInput;
  label: string;
  section: QuestionSection;
  type: "select" | "number" | "boolean" | "text";
  options?: Array<{ value: string; label: string }>;
  hint?: string;
}> = [
  // Business shape
  {
    key: "industry",
    label: "Industry / niche",
    section: "Business shape",
    type: "select",
    options: [
      { value: "GENERAL", label: "General SMB" },
      { value: "STR", label: "Short-term rental" },
      { value: "REAL_ESTATE", label: "Real estate investor" },
      { value: "ECOMMERCE", label: "E-commerce" },
      { value: "PROFESSIONAL_SERVICES", label: "Professional services" },
      { value: "CONSTRUCTION", label: "Construction / trades" },
      { value: "RESTAURANT", label: "Restaurant / hospitality" },
      { value: "OTHER", label: "Other" },
    ],
  },
  {
    key: "entityType",
    label: "Entity type",
    section: "Business shape",
    type: "select",
    options: [
      { value: "SOLE_PROP", label: "Sole proprietor" },
      { value: "LLC", label: "LLC" },
      { value: "S_CORP", label: "S-Corp" },
      { value: "C_CORP", label: "C-Corp" },
      { value: "PARTNERSHIP", label: "Partnership" },
      { value: "OTHER", label: "Other" },
    ],
  },
  {
    key: "entityCount",
    label: "Number of entities",
    section: "Business shape",
    type: "number",
    hint: "1 = single-entity. Multi-entity groups multiply base fees.",
  },

  // Books + accounts
  {
    key: "monthlyTxnVolume",
    label: "Monthly transaction volume",
    section: "Books + accounts",
    type: "number",
    hint: "Lines across all bank + credit card accounts per month.",
  },
  {
    key: "bankAccounts",
    label: "Bank accounts",
    section: "Books + accounts",
    type: "number",
  },
  {
    key: "creditCardAccounts",
    label: "Credit card accounts",
    section: "Books + accounts",
    type: "number",
  },

  // Operational modules
  { key: "payroll", label: "Payroll", section: "Operational modules", type: "boolean" },
  {
    key: "payrollEmployees",
    label: "Payroll employees",
    section: "Operational modules",
    type: "number",
    hint: "Only counts if Payroll is enabled.",
  },
  { key: "salesTax", label: "Sales tax", section: "Operational modules", type: "boolean" },
  {
    key: "salesTaxStates",
    label: "Sales tax states",
    section: "Operational modules",
    type: "number",
  },
  { key: "apArTracking", label: "AP / AR tracking", section: "Operational modules", type: "boolean" },
  { key: "inventory", label: "Inventory", section: "Operational modules", type: "boolean" },
  {
    key: "classLocationTracking",
    label: "Class / location tracking",
    section: "Operational modules",
    type: "boolean",
  },
  {
    key: "multiStateOperations",
    label: "States of operation",
    section: "Operational modules",
    type: "number",
  },

  // One-time work
  {
    key: "cleanupMonths",
    label: "Cleanup months",
    section: "One-time work",
    type: "number",
    hint: "Months behind that need catch-up bookkeeping.",
  },
  {
    key: "taxScope",
    label: "Tax scope",
    section: "One-time work",
    type: "select",
    options: [
      { value: "NONE", label: "No tax services" },
      { value: "PERSONAL_1040", label: "Personal (1040) only" },
      { value: "BUSINESS_RETURN", label: "Business return only" },
      { value: "PERSONAL_PLUS_BUSINESS", label: "Personal + business" },
      { value: "MULTI_ENTITY", label: "Multi-entity complex" },
    ],
  },

  // Advisory
  {
    key: "advisoryLevel",
    label: "Advisory / CFO needs",
    section: "Advisory",
    type: "select",
    options: [
      { value: "NONE", label: "None" },
      { value: "QUARTERLY", label: "Quarterly advisory" },
      { value: "MONTHLY", label: "Monthly advisory" },
      { value: "FRACTIONAL_CFO", label: "Fractional CFO" },
    ],
  },

  // Notes
  {
    key: "complexityNotes",
    label: "Complexity notes (internal)",
    section: "Notes",
    type: "text",
    hint: "Anything unusual — messy history, foreign ops, crypto, etc.",
  },
];
