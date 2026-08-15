"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EditorEntityPageTitle } from "./EditorEntityPageTitle";
import { useLocale } from "./LocaleProvider";
import type { MilestoneFormState } from "./milestone-types";

type Props = {
  mode: "create" | "edit";
  milestoneId?: string;
  initialForm: MilestoneFormState;
  backHref: string;
  title: string;
};

export function MilestoneEditorForm({ mode, milestoneId, initialForm, backHref, title }: Props) {
  const { t } = useLocale();
  const router = useRouter();
  const [form, setForm] = useState<MilestoneFormState>(initialForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        titleFr: form.titleFr.trim(),
        titleEn: form.titleEn.trim(),
        descriptionFr: form.descriptionFr,
        descriptionEn: form.descriptionEn,
        milestoneDate: new Date(form.milestoneDate).toISOString(),
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
        workloadForecast:
          form.workloadForecast.trim() === ""
            ? null
            : Math.max(0, parseInt(form.workloadForecast, 10) || 0),
        ...(form.slug.trim() ? { slug: form.slug.trim() } : {}),
      };

      const res =
        mode === "create"
          ? await fetch("/api/milestones", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch(`/api/milestones/${milestoneId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("list.loadError"));

      const id = mode === "create" ? data.id : milestoneId;
      router.push(`/editeur/jalons/${id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("list.loadError"));
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
            <span className="mb-1 block text-[#495867]">Titre FR</span>
            <input
              className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
              value={form.titleFr}
              onChange={(e) => setForm({ ...form, titleFr: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[#495867]">Title EN</span>
            <input
              className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
              value={form.titleEn}
              onChange={(e) => setForm({ ...form, titleEn: e.target.value })}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-[#495867]">Description FR</span>
            <textarea
              rows={3}
              className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
              value={form.descriptionFr}
              onChange={(e) => setForm({ ...form, descriptionFr: e.target.value })}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-[#495867]">Description EN</span>
            <textarea
              rows={3}
              className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
              value={form.descriptionEn}
              onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[#495867]">{t("milestones.startDate")}</span>
            <input
              type="date"
              className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
              value={form.milestoneDate}
              onChange={(e) => setForm({ ...form, milestoneDate: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[#495867]">{t("milestones.endDate")}</span>
            <input
              type="date"
              className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[#495867]">{t("milestones.workloadForecast")}</span>
            <input
              type="number"
              min={0}
              step={1}
              className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
              value={form.workloadForecast}
              onChange={(e) => setForm({ ...form, workloadForecast: e.target.value })}
              placeholder={t("milestones.optional")}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-[#495867]">Slug (optionnel)</span>
            <input
              className="w-full rounded-md border border-[#d4dde6] px-3 py-2"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="auto depuis le titre EN"
            />
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={busy || !form.titleFr.trim() || !form.titleEn.trim()}
            onClick={() => void save()}
            className="rounded-md bg-[#495867] px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {t("milestones.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
