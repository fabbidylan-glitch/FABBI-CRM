import { describe, expect, it } from "vitest";
import {
  answerFor,
  parseAnnualRevenue,
  parseNiche,
  parsePropertyCount,
  parseServiceInterest,
  parseSource,
  parseTaxesPaid,
  parseUrgency,
} from "@/lib/validators/calendly-parse";

describe("parseNiche", () => {
  it("recognizes STR operators", () => {
    expect(parseNiche("Short-term rental owner")).toBe("STR_OWNER");
    expect(parseNiche("Airbnb / VRBO operator")).toBe("AIRBNB_VRBO_OPERATOR");
  });
  it("recognizes REI", () => {
    expect(parseNiche("Real estate investor")).toBe("REAL_ESTATE_INVESTOR");
  });
  it("upgrades to high-income STR when both markers appear", () => {
    expect(parseNiche("High-income W-2 with STR strategy")).toBe(
      "HIGH_INCOME_STR_STRATEGY"
    );
  });
  it("falls back to UNKNOWN cleanly", () => {
    expect(parseNiche("")).toBe("UNKNOWN");
    expect(parseNiche(undefined)).toBe("UNKNOWN");
    expect(parseNiche("something weird and unlabeled")).toBe("UNKNOWN");
  });
});

describe("parseAnnualRevenue", () => {
  it("maps common bucket labels", () => {
    expect(parseAnnualRevenue("$1M+")).toBe("OVER_1M");
    expect(parseAnnualRevenue("$500k – $1M")).toBe("FROM_500K_TO_1M");
    expect(parseAnnualRevenue("$250k – $500k")).toBe("FROM_250K_TO_500K");
    expect(parseAnnualRevenue("Under $250k")).toBe("UNDER_250K");
  });
  it("returns UNKNOWN on unrecognized input", () => {
    expect(parseAnnualRevenue("Prefer not to say")).toBe("UNKNOWN");
  });
});

describe("parseTaxesPaid", () => {
  it("matches buckets with flexible delimiters", () => {
    expect(parseTaxesPaid("$100k+")).toBe("OVER_100K");
    expect(parseTaxesPaid("$50k – $100k")).toBe("FROM_50K_TO_100K");
    expect(parseTaxesPaid("under $10k")).toBe("UNDER_10K");
  });
});

describe("parsePropertyCount", () => {
  it("maps numeric inputs to buckets", () => {
    expect(parsePropertyCount("1")).toBe("ONE");
    expect(parsePropertyCount("3 properties")).toBe("TWO_TO_FOUR");
    expect(parsePropertyCount("7")).toBe("FIVE_TO_NINE");
    expect(parsePropertyCount("20+")).toBe("TEN_PLUS");
    expect(parsePropertyCount("none")).toBe("NONE");
  });
});

describe("parseUrgency", () => {
  it("classifies urgency phrasing", () => {
    expect(parseUrgency("Now — ready to start")).toBe("NOW");
    expect(parseUrgency("Within the next 30 days")).toBe("NEXT_30_DAYS");
    expect(parseUrgency("Just researching")).toBe("RESEARCHING");
  });
});

describe("parseServiceInterest", () => {
  it("maps common service labels", () => {
    expect(parseServiceInterest("Full-service")).toBe("FULL_SERVICE");
    expect(parseServiceInterest("CFO / fractional")).toBe("CFO");
    expect(parseServiceInterest("Bookkeeping + tax")).toBe("BOOKKEEPING_AND_TAX");
    expect(parseServiceInterest("Tax strategy")).toBe("TAX_STRATEGY");
    expect(parseServiceInterest("Bookkeeping only")).toBe("BOOKKEEPING");
    expect(parseServiceInterest("Tax prep")).toBe("TAX_PREP");
    expect(parseServiceInterest("Not sure yet")).toBe("UNSURE");
  });
});

describe("parseSource", () => {
  it("classifies common source answers", () => {
    expect(parseSource("Google search")).toBe("GOOGLE_ADS");
    expect(parseSource("Meta (FB/IG)")).toBe("META_ADS");
    expect(parseSource("LinkedIn")).toBe("LINKEDIN_ADS");
    expect(parseSource("Referral from a friend")).toBe("REFERRAL");
    expect(parseSource("Partner referral")).toBe("PARTNER_REFERRAL");
    expect(parseSource("Podcast / event")).toBe("PODCAST");
  });
  it("defaults to CALENDLY when unrecognized", () => {
    expect(parseSource("Somewhere on the internet")).toBe("CALENDLY");
  });
});

describe("answerFor", () => {
  it("finds an answer by question keyword", () => {
    const qa = [
      { question: "What's your annual revenue?", answer: "$500k – $1M" },
      { question: "How urgent is this?", answer: "Now" },
    ];
    expect(answerFor(qa, /revenue/i)).toBe("$500k – $1M");
    expect(answerFor(qa, /urgency|urgent/i)).toBe("Now");
    expect(answerFor(qa, /nonsense/i)).toBeUndefined();
  });
  it("handles empty or missing arrays", () => {
    expect(answerFor(undefined, /anything/)).toBeUndefined();
    expect(answerFor([], /anything/)).toBeUndefined();
  });
});
