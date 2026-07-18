import { describe, expect, it } from "vitest";
import {
  compareByDateThenTitle,
  milestoneOrderBy,
  parseMilestoneLocale,
} from "@/lib/milestones";

describe("milestone ordering helpers", () => {
  it("parses locale with fr default", () => {
    expect(parseMilestoneLocale(null)).toBe("fr");
    expect(parseMilestoneLocale("en")).toBe("en");
    expect(parseMilestoneLocale("de")).toBe("fr");
  });

  it("orders by date then title field for locale", () => {
    expect(milestoneOrderBy("fr")).toEqual([
      { milestoneDate: "asc" },
      { titleFr: "asc" },
    ]);
    expect(milestoneOrderBy("en")).toEqual([
      { milestoneDate: "asc" },
      { titleEn: "asc" },
    ]);
  });

  it("compares same-day titles alphabetically", () => {
    const day = "2026-07-18T00:00:00.000Z";
    expect(
      compareByDateThenTitle(
        { date: day, title: "Bravo" },
        { date: day, title: "Alpha" },
        "fr"
      )
    ).toBeGreaterThan(0);
    expect(
      compareByDateThenTitle(
        { date: "2026-01-01T00:00:00.000Z", title: "Z" },
        { date: "2026-02-01T00:00:00.000Z", title: "A" },
        "en"
      )
    ).toBeLessThan(0);
  });
});
