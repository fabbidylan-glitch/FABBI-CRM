import { z } from "zod";

/**
 * Zod schemas for STRDeal create/update + STRComp create/update. Centralized
 * so both the API route and any future server-action callers parse the same
 * shape.
 *
 * All numeric fields accept either a number or a string (so HTML form posts
 * work without manual coercion in the route handler) and become `null` when
 * the user submits an empty string.
 */

const moneyAmount = z
  .union([z.number(), z.string()])
  .transform((v, ctx) => {
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed === "") return null;
      const n = Number(trimmed);
      if (!Number.isFinite(n)) {
        ctx.addIssue({ code: "custom", message: "Must be a number" });
        return z.NEVER;
      }
      return n;
    }
    return v;
  })
  .nullable();

const requiredMoney = z
  .union([z.number(), z.string()])
  .transform((v, ctx) => {
    const n = typeof v === "string" ? Number(v.trim()) : v;
    if (!Number.isFinite(n)) {
      ctx.addIssue({ code: "custom", message: "Must be a number" });
      return z.NEVER;
    }
    return n;
  });

const intOrNull = z
  .union([z.number(), z.string()])
  .transform((v, ctx) => {
    if (typeof v === "string") {
      const t = v.trim();
      if (t === "") return null;
      const n = Number(t);
      if (!Number.isInteger(n)) {
        ctx.addIssue({ code: "custom", message: "Must be an integer" });
        return z.NEVER;
      }
      return n;
    }
    if (!Number.isInteger(v)) {
      ctx.addIssue({ code: "custom", message: "Must be an integer" });
      return z.NEVER;
    }
    return v;
  })
  .nullable();

/** Accepts a 0–10 rating from form input. Clamps invalid values to the band. */
const rating0to10 = z
  .union([z.number(), z.string()])
  .transform((v) => {
    const n = typeof v === "string" ? Number(v) : v;
    if (!Number.isFinite(n)) return 5;
    return Math.max(0, Math.min(10, Math.round(n)));
  });

const STR_STATUS = z.enum([
  "NEW",
  "RESEARCHING",
  "UNDERWRITING",
  "OFFER_MADE",
  "UNDER_CONTRACT",
  "PASSED",
  "ACQUIRED",
]);

const STR_PROPERTY_TYPE = z.enum([
  "SINGLE_FAMILY",
  "CONDO",
  "TOWNHOUSE",
  "MULTIFAMILY",
  "CABIN",
  "COTTAGE",
  "TINY_HOME",
  "OTHER",
]);

const COMP_SOURCE = z.enum([
  "MANUAL",
  "BNB_CALC",
  "AIRDNA",
  "GOOGLE_MAPS",
  "OTHER",
]);

export const dealCreateSchema = z.object({
  dealName: z.string().trim().min(1).max(160),
  propertyAddress: z.string().trim().max(400).nullable().optional(),
  listingUrl: z.string().trim().max(600).nullable().optional(),
  market: z.string().trim().max(120).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  state: z.string().trim().max(40).nullable().optional(),
  status: STR_STATUS.default("NEW"),
  askingPrice: moneyAmount.optional(),
  targetOfferPrice: moneyAmount.optional(),
  propertyType: STR_PROPERTY_TYPE.nullable().optional(),
  beds: intOrNull.optional(),
  baths: moneyAmount.optional(),
  sleeps: intOrNull.optional(),
  squareFootage: intOrNull.optional(),
  lotSize: moneyAmount.optional(),
  yearBuilt: intOrNull.optional(),
  notes: z.string().trim().max(8000).nullable().optional(),

  purchasePrice: requiredMoney.default(0),
  downPaymentPct: requiredMoney.default(0.20),
  interestRate: requiredMoney.default(0.07),
  loanTermYears: z
    .union([z.number(), z.string()])
    .transform((v) => Math.max(0, Math.round(typeof v === "string" ? Number(v) : v)))
    .default(30),
  interestOnly: z
    .union([z.boolean(), z.string()])
    .transform((v) => (typeof v === "string" ? v === "true" || v === "on" : v))
    .default(false),
  closingCosts: requiredMoney.default(0),
  renovationBudget: requiredMoney.default(0),
  furnitureBudget: requiredMoney.default(0),
  initialReserves: requiredMoney.default(0),

  conservativeRevenue: moneyAmount.optional(),
  baseRevenue: moneyAmount.optional(),
  aggressiveRevenue: moneyAmount.optional(),
  adr: moneyAmount.optional(),
  occupancyPct: moneyAmount.optional(),
  cleaningFeesIncome: moneyAmount.optional(),
  otherIncome: moneyAmount.optional(),

  propertyTaxes: moneyAmount.optional(),
  insurance: moneyAmount.optional(),
  utilities: moneyAmount.optional(),
  internet: moneyAmount.optional(),
  repairsMaintenance: moneyAmount.optional(),
  supplies: moneyAmount.optional(),
  cleaningExpense: moneyAmount.optional(),
  platformFeesPct: moneyAmount.optional(),
  propertyMgmtPct: moneyAmount.optional(),
  exteriorServices: moneyAmount.optional(),
  hoa: moneyAmount.optional(),
  accounting: moneyAmount.optional(),
  miscExpense: moneyAmount.optional(),

  revenueConfidence: rating0to10.default(5),
  compQualityRating: rating0to10.default(5),
  marketStrength: rating0to10.default(5),
  upgradeUpside: rating0to10.default(5),
  regulatoryRisk: rating0to10.default(5),
  maintenanceComplexity: rating0to10.default(5),
  financingRisk: rating0to10.default(5),

  targetCashOnCash: requiredMoney.default(0.10),
  targetDscr: requiredMoney.default(1.25),
});

export const dealUpdateSchema = dealCreateSchema.partial();

export const compCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  listingUrl: z.string().trim().max(600).nullable().optional(),
  distanceMiles: moneyAmount.optional(),
  beds: intOrNull.optional(),
  baths: moneyAmount.optional(),
  sleeps: intOrNull.optional(),
  adr: moneyAmount.optional(),
  occupancyPct: moneyAmount.optional(),
  annualRevenue: moneyAmount.optional(),
  reviewCount: intOrNull.optional(),
  rating: moneyAmount.optional(),
  hasHotTub: z.coerce.boolean().optional().default(false),
  hasSauna: z.coerce.boolean().optional().default(false),
  hasPool: z.coerce.boolean().optional().default(false),
  hasGameRoom: z.coerce.boolean().optional().default(false),
  hasFirepit: z.coerce.boolean().optional().default(false),
  hasViews: z.coerce.boolean().optional().default(false),
  hasWaterfront: z.coerce.boolean().optional().default(false),
  hasSkiAccess: z.coerce.boolean().optional().default(false),
  notes: z.string().trim().max(4000).nullable().optional(),
  qualityScore: intOrNull.optional(),
  source: COMP_SOURCE.default("MANUAL"),
  externalRefId: z.string().trim().max(160).nullable().optional(),
});

export const compUpdateSchema = compCreateSchema.partial();

const EXPENSE_CATEGORY = z.enum([
  "PROPERTY_TAXES",
  "INSURANCE",
  "UTILITIES",
  "INTERNET",
  "REPAIRS_MAINTENANCE",
  "SUPPLIES",
  "CLEANING",
  "PLATFORM_FEES",
  "PROPERTY_MANAGEMENT",
  "EXTERIOR_SERVICES",
  "HOA",
  "ACCOUNTING",
  "MISC",
  "CUSTOM",
]);

const EXPENSE_FREQUENCY = z.enum(["MONTHLY", "ANNUAL", "PER_BOOKING", "ONE_TIME"]);

export const expenseCreateSchema = z.object({
  category: EXPENSE_CATEGORY.default("CUSTOM"),
  label: z.string().trim().min(1).max(120),
  amount: requiredMoney.default(0),
  frequency: EXPENSE_FREQUENCY.default("MONTHLY"),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export type DealCreateInput = z.infer<typeof dealCreateSchema>;
export type DealUpdateInput = z.infer<typeof dealUpdateSchema>;
export type CompCreateInput = z.infer<typeof compCreateSchema>;
export type CompUpdateInput = z.infer<typeof compUpdateSchema>;
export type ExpenseCreateInput = z.infer<typeof expenseCreateSchema>;
