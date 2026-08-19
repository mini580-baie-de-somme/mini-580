export type ExternalLinkRecord = {
  id: string;
  labelFr: string;
  labelEn: string;
  url: string | null;
  urlFr: string | null;
  urlEn: string | null;
  createdAt?: string;
  referencedByPostIds?: string[];
};

export type ExternalLinkReferencePost = {
  id: string;
  slug: string;
  titleFr: string;
  titleEn: string;
  status: string;
};

export type UrlMode = "single" | "bilingual";

export type ExternalLinkFormState = {
  labelFr: string;
  labelEn: string;
  urlMode: UrlMode;
  url: string;
  urlFr: string;
  urlEn: string;
};

export function emptyExternalLinkForm(): ExternalLinkFormState {
  return {
    labelFr: "",
    labelEn: "",
    urlMode: "single",
    url: "",
    urlFr: "",
    urlEn: "",
  };
}

export function displayExternalLinkUrl(
  link: Pick<ExternalLinkRecord, "url" | "urlFr" | "urlEn">
): string {
  return link.url?.trim() || link.urlFr?.trim() || link.urlEn?.trim() || "—";
}

export function externalLinkToForm(link: ExternalLinkRecord): ExternalLinkFormState {
  if (link.url?.trim()) {
    return {
      labelFr: link.labelFr,
      labelEn: link.labelEn,
      urlMode: "single",
      url: link.url,
      urlFr: "",
      urlEn: "",
    };
  }
  return {
    labelFr: link.labelFr,
    labelEn: link.labelEn,
    urlMode: "bilingual",
    url: "",
    urlFr: link.urlFr ?? "",
    urlEn: link.urlEn ?? "",
  };
}

export function payloadFromExternalLinkForm(form: ExternalLinkFormState) {
  const base = {
    labelFr: form.labelFr.trim(),
    labelEn: form.labelEn.trim(),
  };
  if (form.urlMode === "single") {
    return { ...base, url: form.url.trim() };
  }
  return { ...base, urlFr: form.urlFr.trim(), urlEn: form.urlEn.trim() };
}

export function isExternalLinkFormValid(form: ExternalLinkFormState): boolean {
  if (!form.labelFr.trim() || !form.labelEn.trim()) return false;
  if (form.urlMode === "single") return Boolean(form.url.trim());
  return Boolean(form.urlFr.trim() && form.urlEn.trim());
}

export function apiExternalLinkErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object" && "formErrors" in error) {
    const formErrors = (error as { formErrors?: string[] }).formErrors;
    if (formErrors?.length) return formErrors.join(" · ");
    const fieldErrors = (error as { fieldErrors?: Record<string, string[]> }).fieldErrors;
    if (fieldErrors) {
      const messages = Object.values(fieldErrors).flat().filter(Boolean);
      if (messages.length) return messages.join(" · ");
    }
  }
  return fallback;
}
