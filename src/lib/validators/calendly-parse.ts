import "server-only";
import type {
  AnnualRevenueRange,
  LeadSource,
  Niche,
  PropertyCountBucket,
  ServiceInterest,
  TaxesPaidRange,
  UrgencyLevel,
} from "@prisma/client";

/**
 * Fuzzy-matchers that turn free-form Calendly answer strings into our Prisma
 * enum values. This lets Calendly's dropdowns be user-friendly (e.g.
 * "$500k–$1M") while our database stays typed (FROM_500K_TO_1M).
 *
 * Each matcher is permissive — missing / unrecognized answers return a
 * conservative default ("UNKNOWN" where it exists) instead of throwing.
 */

export function parseNiche(raw?: string | null): Niche {
  if (!raw) return "UNKNOWN";
  const a = raw.toLowerCase();

  if (/\bhigh.?income\b|w-?2/.test(a) && /str|short.?term|rental/.test(a))
    return "HIGH_INCOME_STR_STRATEGY";
  if (/airbnb|vrbo/.test(a)) return "AIRBNB_VRBO_OPERATOR";
  if (/\bstr\b|short.?term|rental/.test(a)) return "STR_OWNER";
  if (/real estate|\brei\b|investor|multi.?family|flip/.test(a)) return "REAL_ESTATE_INVESTOR";
  if (/multi.?service|full.?service|bundled/.test(a)) return "MULTI_SERVICE_CLIENT";
  if (/smb|small business|general/.test(a)) return "GENERAL_SMB";
  if (a.includes("other")) return "OTHER";
  return "UNKNOWN";
}

export function parseAnnualRevenue(raw?: string | null): AnnualRevenueRange {
  if (!raw) return "UNKNOWN";
  const a = raw.toLowerCase().replace(/[\s,$]/g, "");

  // Check ranges before the OVER_1M sentinel — otherwise "$500k–$1M"
  // matches OVER_1M greedily because the upper bound contains "1m".
  if (/500k.?-?.?1m|500.?1m|half.?million.?1m|500,?000.?1,?000,?000/.test(a))
    return "FROM_500K_TO_1M";
  if (/250k.?-?.?500k|250.?500k|quarter.?million|250,?000.?500,?000/.test(a))
    return "FROM_250K_TO_500K";
  if (/under\s*250k|less\s*than\s*250k|below\s*250k|<250k|0.?-?.?250k/.test(a))
    return "UNDER_250K";
  // Finally, OVER_1M — must be an "over/plus" signal, not just any "1m".
  if (/over\s*1m|\+1m|1m\+|1,?000,?000\+|million\+/.test(a)) return "OVER_1M";
  return "UNKNOWN";
}

export function parseTaxesPaid(raw?: string | null): TaxesPaidRange {
  if (!raw) return "UNKNOWN";
  const a = raw.toLowerCase().replace(/[\s,$]/g, "");

  if (/over\s*100k|100k\+|\$100k\+|100,?000\+|more\s*than\s*100k/.test(a)) return "OVER_100K";
  if (/50k.?-?.?100k|50.?100k|50,?000.?100,?000/.test(a)) return "FROM_50K_TO_100K";
  if (/25k.?-?.?50k|25.?50k|25,?000.?50,?000/.test(a)) return "FROM_25K_TO_50K";
  if (/10k.?-?.?25k|10.?25k|10,?000.?25,?000/.test(a)) return "FROM_10K_TO_25K";
  if (/under\s*10k|less\s*than\s*10k|<10k|0.?-?.?10k/.test(a)) return "UNDER_10K";
  return "UNKNOWN";
}

export function parsePropertyCount(raw?: string | null): PropertyCountBucket {
  if (!raw) return "UNKNOWN";
  const a = raw.toLowerCase();

  // Find a number first if present.
  const m = a.match(/\b(\d+)\b/);
  const n = m ? parseInt(m[1] ?? "", 10) : null;
  if (n !== null && Number.isFinite(n)) {
    if (n === 0) return "NONE";
    if (n === 1) return "ONE";
    if (n >= 2 && n <= 4) return "TWO_TO_FOUR";
    if (n >= 5 && n <= 9) return "FIVE_TO_NINE";
    if (n >= 10) return "TEN_PLUS";
  }
  if (/10\+|ten.?plus|ten.?or.?more/.test(a)) return "TEN_PLUS";
  if (/5.?9|five.?to.?nine/.test(a)) return "FIVE_TO_NINE";
  if (/2.?4|two.?to.?four|few/.test(a)) return "TWO_TO_FOUR";
  if (/\bone\b|just\s*1/.test(a)) return "ONE";
  if (/none|n\/?a|\bno\b/.test(a)) return "NONE";
  return "UNKNOWN";
}

export function parseUrgency(raw?: string | null): UrgencyLevel {
  if (!raw) return "UNKNOWN";
  const a = raw.toLowerCase();
  if (/\bnow\b|asap|immediate|urgent|this\s*week/.test(a)) return "NOW";
  if (/30\s*days|month|soon/.test(a)) return "NEXT_30_DAYS";
  if (/research|explor|shop|learn/.test(a)) return "RESEARCHING";
  return "UNKNOWN";
}

export function parseServiceInterest(raw?: string | null): ServiceInterest {
  if (!raw) return "UNSURE";
  const a = raw.toLowerCase();

  if (/full.?service|everything|all\s*of\s*it/.test(a)) return "FULL_SERVICE";
  if (/\bcfo\b|fractional|financial\s*planning/.test(a)) return "CFO";
  if (/bookkeep.*tax|tax.*bookkeep|combined/.test(a)) return "BOOKKEEPING_AND_TAX";
  if (/strategy|planning|advis/.test(a)) return "TAX_STRATEGY";
  if (/bookkeep/.test(a)) return "BOOKKEEPING";
  if (/tax\s*prep|tax\s*return|prep/.test(a)) return "TAX_PREP";
  if (/unsure|not\s*sure|help/.test(a)) return "UNSURE";
  return "UNSURE";
}

export function parseSource(raw?: string | null): LeadSource {
  if (!raw) return "CALENDLY";
  const a = raw.toLowerCase();

  if (/\bgoogle\b|search/.test(a)) return "GOOGLE_ADS";
  if (/meta|facebook|instagram|\bfb\b|\big\b/.test(a)) return "META_ADS";
  if (/linkedin/.test(a)) return "LINKEDIN_ADS";
  if (/partner/.test(a)) return "PARTNER_REFERRAL";
  if (/refer|friend|word.?of.?mouth/.test(a)) return "REFERRAL";
  if (/podcast/.test(a)) return "PODCAST";
  if (/event|conference|meetup/.test(a)) return "EVENT";
  if (/organic|brand|website/.test(a)) return "ORGANIC_BRANDED";
  return "CALENDLY";
}

/** Pull an answer out of a Calendly questions_and_answers array by partial match. */
export function answerFor(
  qa: Array<{ question?: string; answer?: string }> | undefined,
  keywordRegex: RegExp
): string | undefined {
  if (!qa || qa.length === 0) return undefined;
  for (const row of qa) {
    if (row.question && keywordRegex.test(row.question)) return row.answer;
  }
  return undefined;
}
