import { describe, expect, it } from "vitest";
import {
  milestonesForPostPublishedAt,
  publishedAtForNamedMilestone,
  publishedAtRangeForMilestone,
} from "@/lib/milestone-windows";

describe("milestone-windows", () => {
  const period = {
    id: "m1",
    slug: "period",
    titleFr: "Période",
    titleEn: "Period",
    milestoneDate: new Date("2026-01-01T00:00:00.000Z"),
    endDate: new Date("2026-01-31T00:00:00.000Z"),
  };

  it("infers milestones from publishedAt", () => {
    const matched = milestonesForPostPublishedAt(
      {
        publishedAt: "2026-01-15",
        status: "DRAFT",
      },
      [period],
      false
    );
    expect(matched.map((m) => m.id)).toEqual(["m1"]);
  });

  it("defaults publishedAt to milestone start when jalon is named", () => {
    const d = publishedAtForNamedMilestone(null, period);
    expect(d.toISOString()).toBe(period.milestoneDate.toISOString());
  });

  it("builds prisma range for punctual milestone", () => {
    const punctual = {
      milestoneDate: new Date("2026-02-01T00:00:00.000Z"),
      endDate: null,
    };
    const where = publishedAtRangeForMilestone(punctual);
    expect(where.publishedAt).toBeDefined();
  });
});
