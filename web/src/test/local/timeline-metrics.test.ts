import { describe, expect, it } from "vitest";
import {
  buildMilestoneBlocks,
  barPositionPercent,
  barWidthPercent,
  isMilestoneCurrent,
  postsInMilestoneWindow,
  standalonePublishedPosts,
  timelineRangeFromBlocks,
} from "@/lib/timeline-data";
import {
  calendarDaysBetween,
  elapsedProjectDays,
  parseLocalISODate,
  sumWorkDays,
} from "@/lib/project-metrics";

describe("timeline-data", () => {
  it("marks punctual milestones without endDate", () => {
    const blocks = buildMilestoneBlocks([
      {
        id: "m0",
        titleFr: "Deadline",
        titleEn: "Deadline",
        descriptionFr: "",
        descriptionEn: "",
        milestoneDate: "2026-02-01",
        endDate: null,
        workloadForecast: 5,
      },
    ], []);
    expect(blocks[0]?.isPunctual).toBe(true);
    expect(blocks[0]?.end).toBeNull();
  });

  it("includes posts within milestone date window only", () => {
    const posts = [
      {
        id: "p1",
        slug: "a",
        titleFr: "A",
        titleEn: "A",
        status: "PUBLISHED",
        publishedAt: "2026-01-15",
        workDays: 3,
      },
      {
        id: "p2",
        slug: "b",
        titleFr: "B",
        titleEn: "B",
        status: "PUBLISHED",
        publishedAt: "2026-02-01",
        workDays: 5,
      },
    ];
    const milestone = {
      id: "m1",
      titleFr: "Jalon",
      titleEn: "Milestone",
      descriptionFr: "",
      descriptionEn: "",
      milestoneDate: "2026-01-01",
      endDate: "2026-01-31",
      workloadForecast: 10,
    };
    const steps = postsInMilestoneWindow(milestone, posts);
    expect(steps.map((s) => s.post.id)).toEqual(["p1"]);
    const blocks = buildMilestoneBlocks([milestone], posts);
    expect(blocks[0]?.producedDays).toBe(3);
    expect(blocks[0]?.isPunctual).toBe(false);
  });

  it("includes published posts by date even without explicit milestone link", () => {
    const posts = [
      {
        id: "p1",
        slug: "in-window",
        titleFr: "Dans la période",
        titleEn: "In window",
        status: "PUBLISHED",
        publishedAt: "2026-02-18T09:00:00.000Z",
        workDays: 4,
      },
      {
        id: "p2",
        slug: "outside",
        titleFr: "Hors période",
        titleEn: "Outside",
        status: "PUBLISHED",
        publishedAt: "2026-03-28T09:00:00.000Z",
        workDays: 2,
      },
    ];
    const milestone = {
      id: "m1",
      titleFr: "Chantier",
      titleEn: "Workshop",
      descriptionFr: "",
      descriptionEn: "",
      milestoneDate: "2026-02-01",
      endDate: "2026-03-01",
      workloadForecast: null,
    };
    const steps = postsInMilestoneWindow(milestone, posts);
    expect(steps.map((s) => s.post.id)).toEqual(["p1"]);
    expect(
      standalonePublishedPosts(posts, [milestone]).map((s) => s.post.id)
    ).toEqual(["p2"]);
  });

  it("includes posts on boundary dates (inclusive)", () => {
    const posts = [
      {
        id: "start",
        slug: "start",
        titleFr: "Start",
        titleEn: "Start",
        status: "PUBLISHED",
        publishedAt: "2026-01-01",
        workDays: 1,
      },
      {
        id: "end",
        slug: "end",
        titleFr: "End",
        titleEn: "End",
        status: "PUBLISHED",
        publishedAt: "2026-01-10",
        workDays: 2,
      },
    ];
    const milestone = {
      id: "m2",
      titleFr: "Jalon",
      titleEn: "Milestone",
      descriptionFr: "",
      descriptionEn: "",
      milestoneDate: "2026-01-01",
      endDate: "2026-01-10",
      workloadForecast: null,
    };
    const steps = postsInMilestoneWindow(milestone, posts);
    expect(steps.map((s) => s.post.id)).toEqual(["start", "end"]);
    expect(buildMilestoneBlocks([milestone], posts)[0]?.producedDays).toBe(3);
  });

  it("detects current period milestone (inclusive boundaries)", () => {
    const start = parseLocalISODate("2026-06-01");
    const end = parseLocalISODate("2026-07-30");
    expect(
      isMilestoneCurrent(start, end, false, parseLocalISODate("2026-06-01"))
    ).toBe(true);
    expect(
      isMilestoneCurrent(start, end, false, parseLocalISODate("2026-07-30"))
    ).toBe(true);
    expect(
      isMilestoneCurrent(start, end, false, parseLocalISODate("2026-08-17"))
    ).toBe(false);
    expect(
      isMilestoneCurrent(start, end, false, parseLocalISODate("2026-05-31"))
    ).toBe(false);
  });

  it("detects current punctual milestone on start day only", () => {
    const start = parseLocalISODate("2026-02-01");
    expect(isMilestoneCurrent(start, null, true, start)).toBe(true);
    expect(
      isMilestoneCurrent(start, null, true, parseLocalISODate("2026-02-02"))
    ).toBe(false);
  });

  it("timeline range uses project start anchor and last milestone end", () => {
    const blocks = buildMilestoneBlocks(
      [
        {
          id: "m1",
          titleFr: "Lancement",
          titleEn: "Launch",
          descriptionFr: "",
          descriptionEn: "",
          milestoneDate: "2025-01-15",
          endDate: "2025-03-31",
          workloadForecast: null,
        },
        {
          id: "m2",
          titleFr: "Fin",
          titleEn: "End",
          descriptionFr: "",
          descriptionEn: "",
          milestoneDate: "2026-12-01",
          endDate: "2027-06-30",
          workloadForecast: null,
        },
      ],
      []
    );
    const { rangeStart, rangeEnd } = timelineRangeFromBlocks(blocks);
    expect(rangeStart).toEqual(parseLocalISODate("2025-01-15"));
    expect(rangeEnd).toEqual(parseLocalISODate("2027-06-30"));
  });

  it("positions punctual milestones by date on project axis (not centered)", () => {
    const rangeStart = parseLocalISODate("2025-01-15");
    const rangeEnd = parseLocalISODate("2027-06-30");
    const early = parseLocalISODate("2025-11-15");
    const mid = parseLocalISODate("2026-06-01");

    const earlyPos = barPositionPercent(early, rangeStart, rangeEnd);
    const midPos = barPositionPercent(mid, rangeStart, rangeEnd);

    expect(earlyPos).toBeGreaterThan(0);
    expect(earlyPos).toBeLessThan(50);
    expect(midPos).toBeGreaterThan(earlyPos);
    expect(midPos).toBeLessThan(100);
    expect(barPositionPercent(rangeStart, rangeStart, rangeEnd)).toBe(0);
    expect(barPositionPercent(rangeEnd, rangeStart, rangeEnd)).toBe(100);
  });

  it("bar width covers inclusive end date", () => {
    const rangeStart = parseLocalISODate("2025-01-15");
    const rangeEnd = parseLocalISODate("2027-06-30");
    const width = barWidthPercent(
      parseLocalISODate("2026-02-01"),
      parseLocalISODate("2026-03-01"),
      rangeStart,
      rangeEnd
    );
    expect(width).toBeGreaterThan(2);
    expect(width).toBeLessThan(15);
  });
});

describe("project-metrics", () => {
  it("sums work days", () => {
    expect(sumWorkDays([{ workDays: 2 }, { workDays: null }, { workDays: 5 }])).toBe(
      7
    );
  });

  it("counts calendar days between local ISO dates", () => {
    const start = parseLocalISODate("2025-01-15");
    const end = parseLocalISODate("2026-08-17");
    expect(calendarDaysBetween(start, end)).toBe(579);
    expect(calendarDaysBetween(start, start)).toBe(0);
    expect(calendarDaysBetween(start, parseLocalISODate("2025-01-16"))).toBe(1);
  });

  it("elapsed project days uses project launch anchor", () => {
    expect(elapsedProjectDays(parseLocalISODate("2026-08-17"))).toBe(579);
    expect(elapsedProjectDays(parseLocalISODate("2025-01-15"))).toBe(0);
  });
});
