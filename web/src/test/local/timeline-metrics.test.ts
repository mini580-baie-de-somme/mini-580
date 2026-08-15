import { describe, expect, it } from "vitest";
import {
  buildMilestoneBlocks,
  postsInMilestoneWindow,
} from "@/lib/timeline-data";
import { elapsedProjectDays, sumWorkDays } from "@/lib/project-metrics";

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
        posts: [],
      },
    ]);
    expect(blocks[0]?.isPunctual).toBe(true);
    expect(blocks[0]?.end).toBeNull();
  });

  it("includes posts within milestone date window only", () => {
    const milestone = {
      id: "m1",
      titleFr: "Jalon",
      titleEn: "Milestone",
      descriptionFr: "",
      descriptionEn: "",
      milestoneDate: "2026-01-01",
      endDate: "2026-01-31",
      workloadForecast: 10,
      posts: [
        {
          post: {
            id: "p1",
            slug: "a",
            titleFr: "A",
            titleEn: "A",
            status: "PUBLISHED",
            publishedAt: "2026-01-15",
            workDays: 3,
          },
        },
        {
          post: {
            id: "p2",
            slug: "b",
            titleFr: "B",
            titleEn: "B",
            status: "PUBLISHED",
            publishedAt: "2026-02-01",
            workDays: 5,
          },
        },
      ],
    };
    const steps = postsInMilestoneWindow(milestone);
    expect(steps.map((s) => s.post.id)).toEqual(["p1"]);
    const blocks = buildMilestoneBlocks([milestone]);
    expect(blocks[0]?.producedDays).toBe(3);
    expect(blocks[0]?.isPunctual).toBe(false);
  });

  it("includes posts on boundary dates (inclusive)", () => {
    const milestone = {
      id: "m2",
      titleFr: "Jalon",
      titleEn: "Milestone",
      descriptionFr: "",
      descriptionEn: "",
      milestoneDate: "2026-01-01",
      endDate: "2026-01-10",
      workloadForecast: null,
      posts: [
        {
          post: {
            id: "start",
            slug: "start",
            titleFr: "Start",
            titleEn: "Start",
            status: "PUBLISHED",
            publishedAt: "2026-01-01",
            workDays: 1,
          },
        },
        {
          post: {
            id: "end",
            slug: "end",
            titleFr: "End",
            titleEn: "End",
            status: "PUBLISHED",
            publishedAt: "2026-01-10",
            workDays: 2,
          },
        },
      ],
    };
    const steps = postsInMilestoneWindow(milestone);
    expect(steps.map((s) => s.post.id)).toEqual(["start", "end"]);
    expect(buildMilestoneBlocks([milestone])[0]?.producedDays).toBe(3);
  });
});

describe("project-metrics", () => {
  it("sums work days", () => {
    expect(sumWorkDays([{ workDays: 2 }, { workDays: null }, { workDays: 5 }])).toBe(
      7
    );
  });

  it("computes elapsed days", () => {
    expect(elapsedProjectDays(new Date("2026-01-11"))).toBeGreaterThan(800);
  });
});
