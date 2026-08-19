"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { dispatchExternalLinkUpdated } from "@/lib/external-link-display";
import { EditorEntityPageTitle } from "./EditorEntityPageTitle";
import { useLocale } from "./LocaleProvider";
import {
  apiExternalLinkErrorMessage,
  isExternalLinkFormValid,
  payloadFromExternalLinkForm,
  type ExternalLinkFormState,
} from "./external-link-types";

type Props = {
  mode: "create" | "edit";
  linkId?: string;
  initialForm: ExternalLinkFormState;
  backHref: string;
  title: string;
};

export function ExternalLinkEditorForm({
  mode,
  linkId,
  initialForm,
  backHref,
  title,
}: Props) {
  const { t } = useLocale();
  const router = useRouter();
  const [form, setForm] = useState<ExternalLinkFormState>(initialForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const payload = payloadFromExternalLinkForm(form);
      const res =
        mode === "create"
          ? await fetch("/api/external-links", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch(`/api/external-links/${linkId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(apiExternalLinkErrorMessage(data.error, t("externalLinks.saveError")));
      }

      const id =
        mode === "create" && data && typeof data === "object" && "id" in data
          ? String((data as { id: string }).id)
          : linkId;
      if (id) dispatchExternalLinkUpdated(id);
      router.push(`/editeur/liens/${id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("externalLinks.saveError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <EditorEntityPageTitle backHref={backHref} title={title} />

      {error ? (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      <div className="rounded-lg border border-[#d4dde6] bg-white p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-[#495867]">{t("externalLinks.labelFr")}</span>
            <input
              className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
              value={form.labelFr}
              onChange={(e) => setForm({ ...form, labelFr: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[#495867]">{t("externalLinks.labelEn")}</span>
            <input
              className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
              value={form.labelEn}
              onChange={(e) => setForm({ ...form, labelEn: e.target.value })}
            />
          </label>
          <fieldset className="block text-sm sm:col-span-2">
            <legend className="mb-2 text-[#495867]">URL</legend>
            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="urlMode"
                  checked={form.urlMode === "single"}
                  onChange={() => setForm({ ...form, urlMode: "single" })}
                />
                {t("externalLinks.urlModeSingle")}
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="urlMode"
                  checked={form.urlMode === "bilingual"}
                  onChange={() => setForm({ ...form, urlMode: "bilingual" })}
                />
                {t("externalLinks.urlModeBilingual")}
              </label>
            </div>
          </fieldset>
          {form.urlMode === "single" ? (
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-[#495867]">{t("externalLinks.url")}</span>
              <input
                type="url"
                className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://"
              />
            </label>
          ) : (
            <>
              <label className="block text-sm">
                <span className="mb-1 block text-[#495867]">{t("externalLinks.urlFr")}</span>
                <input
                  type="url"
                  className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
                  value={form.urlFr}
                  onChange={(e) => setForm({ ...form, urlFr: e.target.value })}
                  placeholder="https://"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-[#495867]">{t("externalLinks.urlEn")}</span>
                <input
                  type="url"
                  className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
                  value={form.urlEn}
                  onChange={(e) => setForm({ ...form, urlEn: e.target.value })}
                  placeholder="https://"
                />
              </label>
            </>
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={busy || !isExternalLinkFormValid(form)}
            onClick={() => void save()}
            className="rounded-md bg-[#495867] px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {t("externalLinks.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
