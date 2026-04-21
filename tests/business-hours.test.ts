import { describe, expect, it } from "vitest";
import { addBusinessHours } from "@/lib/features/leads/business-hours";

// Anchor every case on a Monday 10:00 America/New_York = Monday 14:00 UTC
// during EDT (March–Nov). Keeping tests in that window sidesteps DST noise.
const MON_10AM_EDT_AS_UTC = new Date("2026-06-01T14:00:00Z");

describe("addBusinessHours", () => {
  it("adds hours within the same work day", () => {
    const result = addBusinessHours(MON_10AM_EDT_AS_UTC, 3);
    // 10am + 3h = 1pm. 1pm EDT = 17:00 UTC.
    expect(result.toISOString()).toBe("2026-06-01T17:00:00.000Z");
  });

  it("rolls past 6pm into the next morning", () => {
    // 10am + 9h = 7pm. Work day ends at 6pm → 1h spills.
    // Next start: Tue 9am EDT = 13:00 UTC. +1h = 14:00 UTC.
    const result = addBusinessHours(MON_10AM_EDT_AS_UTC, 9);
    expect(result.toISOString()).toBe("2026-06-02T14:00:00.000Z");
  });

  it("skips weekends — Friday + 48 biz hours lands on Tuesday morning", () => {
    // Fri 9am EDT = 13:00 UTC
    const fri9am = new Date("2026-06-05T13:00:00Z");
    const result = addBusinessHours(fri9am, 18); // two full work days
    // +9h Fri → 6pm Fri, +9h Mon → 6pm Mon. Zero carry.
    // 6pm EDT Mon = 22:00 UTC.
    expect(result.toISOString()).toBe("2026-06-08T22:00:00.000Z");
  });

  it("anchors a Saturday input onto Monday 9am", () => {
    // Sat noon EDT = 16:00 UTC. 0 hours requested → should not change per spec
    // (the function only rolls forward when hours > 0).
    const sat = new Date("2026-06-06T16:00:00Z");
    const result = addBusinessHours(sat, 4);
    // Roll to Mon 9am EDT = 13:00 UTC, then +4h = 17:00 UTC.
    expect(result.toISOString()).toBe("2026-06-08T17:00:00.000Z");
  });

  it("treats 0 or negative hours as no-op", () => {
    expect(addBusinessHours(MON_10AM_EDT_AS_UTC, 0).toISOString()).toBe(
      MON_10AM_EDT_AS_UTC.toISOString()
    );
    expect(addBusinessHours(MON_10AM_EDT_AS_UTC, -1).toISOString()).toBe(
      MON_10AM_EDT_AS_UTC.toISOString()
    );
  });
});
