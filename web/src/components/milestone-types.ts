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
};

export const todayDateInput = () => new Date().toISOString().slice(0, 10);

export const emptyMilestoneForm = (): MilestoneFormState => {
  const milestoneDate = todayDateInput();
  return {
    titleFr: "",
    titleEn: "",
    descriptionFr: "",
    descriptionEn: "",
    milestoneDate,
    endDate: milestoneDate,
    workloadForecast: "",
  };
};

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
    endDate: m.endDate ? toDateInput(m.endDate) : toDateInput(m.milestoneDate),
    workloadForecast: m.workloadForecast != null ? String(m.workloadForecast) : "",
  };
}

export function formatMilestoneDate(value: string, locale: "fr" | "en") {
  return new Date(value).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB");
}
