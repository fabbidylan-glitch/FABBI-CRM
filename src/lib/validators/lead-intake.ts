import { z } from "zod";

// Match Prisma enums from schema.prisma.
export const ServiceInterestEnum = z.enum([
  "TAX_PREP",
  "BOOKKEEPING",
  "TAX_STRATEGY",
  "BOOKKEEPING_AND_TAX",
  "CFO",
  "FULL_SERVICE",
  "UNSURE",
]);

export const AnnualRevenueEnum = z.enum([
  "UNDER_250K",
  "FROM_250K_TO_500K",
  "FROM_500K_TO_1M",
  "OVER_1M",
  "UNKNOWN",
]);

export const TaxesPaidEnum = z.enum([
  "UNDER_10K",
  "FROM_10K_TO_25K",
  "FROM_25K_TO_50K",
  "FROM_50K_TO_100K",
  "OVER_100K",
  "UNKNOWN",
]);

export const PropertyCountEnum = z.enum([
  "NONE",
  "ONE",
  "TWO_TO_FOUR",
  "FIVE_TO_NINE",
  "TEN_PLUS",
  "UNKNOWN",
]);

export const UrgencyEnum = z.enum(["RESEARCHING", "NEXT_30_DAYS", "NOW", "UNKNOWN"]);

export const NicheEnum = z.enum([
  "STR_OWNER",
  "AIRBNB_VRBO_OPERATOR",
  "REAL_ESTATE_INVESTOR",
  "HIGH_INCOME_STR_STRATEGY",
  "MULTI_SERVICE_CLIENT",
  "GENERAL_SMB",
  "OTHER",
  "UNKNOWN",
]);

export const SourceEnum = z.enum([
  "WEBSITE",
  "LANDING_PAGE",
  "GOOGLE_ADS",
  "META_ADS",
  "LINKEDIN_ADS",
  "ORGANIC_SEARCH",
  "ORGANIC_BRANDED",
  "REFERRAL",
  "PARTNER_REFERRAL",
  "CALENDLY",
  "MANUAL",
  "CSV_IMPORT",
  "EVENT",
  "PODCAST",
  "OTHER",
]);

export const leadIntakeSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  email: z.string().trim().toLowerCase().email("Valid email required").max(160),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  companyName: z.string().trim().max(160).optional().or(z.literal("")),
  websiteUrl: z.string().trim().url().max(400).optional().or(z.literal("")),

  source: SourceEnum.default("WEBSITE"),
  campaignName: z.string().trim().max(160).optional(),

  niche: NicheEnum.default("UNKNOWN"),
  serviceInterest: ServiceInterestEnum.default("UNSURE"),
  annualRevenueRange: AnnualRevenueEnum.default("UNKNOWN"),
  taxesPaidLastYearRange: TaxesPaidEnum.default("UNKNOWN"),
  propertyCount: PropertyCountEnum.default("UNKNOWN"),
  urgency: UrgencyEnum.default("UNKNOWN"),
  statesOfOperation: z.array(z.string().trim().length(2).toUpperCase()).max(20).default([]),

  w2IncomeFlag: z.boolean().default(false),
  payrollFlag: z.boolean().default(false),
  otherBusinessIncomeFlag: z.boolean().default(false),

  painPoint: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(2000).optional(),

  utmSource: z.string().trim().max(160).optional(),
  utmMedium: z.string().trim().max(160).optional(),
  utmCampaign: z.string().trim().max(160).optional(),
  utmTerm: z.string().trim().max(160).optional(),
  utmContent: z.string().trim().max(160).optional(),

  // Honeypot. Real browsers leave this blank; bots fill it.
  website_hp: z.string().max(0).optional(),
});

export type LeadIntakeInput = z.infer<typeof leadIntakeSchema>;

export function normalizePhoneE164(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 11) return `+${digits}`;
  return null;
}
