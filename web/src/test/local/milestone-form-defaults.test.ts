import { describe, expect, it } from "vitest";
import {
  emptyMilestoneForm,
  milestoneToForm,
  type MilestoneRecord,
} from "@/components/milestone-types";

describe("milestone form defaults", () => {
  it("emptyMilestoneForm initializes endDate to start date", () => {
    const form = emptyMilestoneForm();
    expect(form.endDate).toBe(form.milestoneDate);
    expect(form.milestoneDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("milestoneToForm defaults endDate to start when milestone has no endDate", () => {
    const record: MilestoneRecord = {
      id: "m1",
      slug: "keel-laying",
      titleFr: "Pose quille",
      titleEn: "Keel laying",
      descriptionFr: "",
      descriptionEn: "",
      milestoneDate: "2026-03-15T00:00:00.000Z",
      endDate: null,
      workloadForecast: null,
    };
    const form = milestoneToForm(record);
    expect(form.endDate).toBe("2026-03-15");
    expect(form.milestoneDate).toBe("2026-03-15");
  });

  it("milestoneToForm keeps stored endDate when present", () => {
    const record: MilestoneRecord = {
      id: "m2",
      slug: "hull-works",
      titleFr: "Coque",
      titleEn: "Hull works",
      descriptionFr: "",
      descriptionEn: "",
      milestoneDate: "2026-03-15T00:00:00.000Z",
      endDate: "2026-04-20T00:00:00.000Z",
      workloadForecast: 5,
    };
    const form = milestoneToForm(record);
    expect(form.milestoneDate).toBe("2026-03-15");
    expect(form.endDate).toBe("2026-04-20");
  });
});
