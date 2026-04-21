import { describe, expect, it } from "vitest";
import { computeStaleness, humanHours } from "@/lib/features/leads/sla";

describe("computeStaleness", () => {
  const now = new Date("2026-06-01T12:00:00Z");

  it("treats a brand-new lead as fresh", () => {
    const justNow = new Date(now.getTime() - 10 * 60_000);
    expect(computeStaleness("NEW_LEAD", justNow, now).level).toBe("fresh");
  });

  it("flags a NEW_LEAD as slow past 1h", () => {
    const anchor = new Date(now.getTime() - 2 * 3_600_000);
    expect(computeStaleness("NEW_LEAD", anchor, now).level).toBe("slow");
  });

  it("flags a NEW_LEAD as stale past 4h", () => {
    const anchor = new Date(now.getTime() - 5 * 3_600_000);
    expect(computeStaleness("NEW_LEAD", anchor, now).level).toBe("stale");
  });

  it("does not stale terminal stages", () => {
    const longAgo = new Date(now.getTime() - 30 * 24 * 3_600_000);
    expect(computeStaleness("WON", longAgo, now).level).toBe("fresh");
    expect(computeStaleness("LOST", longAgo, now).level).toBe("fresh");
    expect(computeStaleness("COLD_NURTURE", longAgo, now).level).toBe("fresh");
  });

  it("returns fresh when there's no anchor date", () => {
    expect(computeStaleness("QUALIFIED", null, now).level).toBe("fresh");
    expect(computeStaleness("QUALIFIED", undefined, now).level).toBe("fresh");
  });
});

describe("humanHours", () => {
  it("formats sub-hour values as minutes", () => {
    expect(humanHours(0.25)).toBe("15m");
  });
  it("formats 1-48 as hours", () => {
    expect(humanHours(5)).toBe("5h");
    expect(humanHours(47)).toBe("47h");
  });
  it("formats 48+ as days", () => {
    expect(humanHours(72)).toBe("3d");
    expect(humanHours(240)).toBe("10d");
  });
});
