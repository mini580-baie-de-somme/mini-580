export type MilestoneRecord = {
  id: string;
  slug: string;
  titleFr: string;
  titleEn: string;
  descriptionFr: string;
  descriptionEn: string;
  milestoneDate: string;
  endDate: string | null;
  workloadForecast: number | null;
};

export type MilestoneFormState = {
  titleFr: string;
  titleEn: string;
  descriptionFr: string;
  descriptionEn: string;
  milestoneDate: string;
  endDate: string;
  workloadForecast: string;
  slug: string;
};

export const emptyMilestoneForm = (): MilestoneFormState => ({
  titleFr: "",
  titleEn: "",
  descriptionFr: "",
  descriptionEn: "",
  milestoneDate: new Date().toISOString().slice(0, 10),
  endDate: "",
  workloadForecast: "",
  slug: "",
});

export function toDateInput(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

export function milestoneToForm(m: MilestoneRecord): MilestoneFormState {
  return {
    titleFr: m.titleFr,
    titleEn: m.titleEn,
    descriptionFr: m.descriptionFr,
    descriptionEn: m.descriptionEn,
    milestoneDate: toDateInput(m.milestoneDate),
    endDate: m.endDate ? toDateInput(m.endDate) : "",
    workloadForecast: m.workloadForecast != null ? String(m.workloadForecast) : "",
    slug: m.slug,
  };
}

export function formatMilestoneDate(value: string, locale: "fr" | "en") {
  return new Date(value).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB");
}
