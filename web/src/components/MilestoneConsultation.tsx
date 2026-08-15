"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EditorEntityActionsBar } from "./EditorEntityActionsBar";
import { EditorEntityPageTitle } from "./EditorEntityPageTitle";
import { EditorFormDangerZone } from "./EditorFormDangerZone";
import { useLocale } from "./LocaleProvider";
import { formatMilestoneDate, type MilestoneRecord } from "./milestone-types";

type Props = {
  milestone: MilestoneRecord;
  isTestEnv?: boolean;
  onProd?: boolean;
};

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-[#495867]">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm text-[#0D131A]">{value || "—"}</dd>
    </div>
  );
}

export function MilestoneConsultation({ milestone, isTestEnv = false, onProd }: Props) {
  const { locale, t } = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prodOnProd, setProdOnProd] = useState(onProd ?? false);

  useEffect(() => {
    if (!isTestEnv || onProd !== undefined) return;
    let cancelled = false;
    void (async () => {
      try {
        const statusRes = await fetch("/api/sync/status");
        if (!statusRes.ok) return;
        const status = await statusRes.json();
        const onlyLocal = new Set(
          (status.milestones?.onlyLocal ?? []).map((m: { id: string }) => m.id)
        );
        if (!cancelled) setProdOnProd(!onlyLocal.has(milestone.id));
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isTestEnv, milestone.id, onProd]);

  const displayName = locale === "fr" ? milestone.titleFr : milestone.titleEn;
  const dateLocale = locale === "fr" ? "fr" : "en";
  const startLabel = formatMilestoneDate(milestone.milestoneDate, dateLocale);
  const endLabel = milestone.endDate
    ? formatMilestoneDate(milestone.endDate, dateLocale)
    : null;

  async function remove() {
    if (!confirm(t("milestones.deleteConfirm").replace("{name}", displayName))) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/milestones/${milestone.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(t("list.loadError"));
      router.push("/editeur/jalons");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("list.loadError"));
    } finally {
      setBusy(false);
    }
  }

  async function publishToProd() {
    if (!confirm(`Publier le jalon « ${milestone.titleFr} » sur PROD ?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sync/publish-milestone-to-prod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestoneId: milestone.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Publication PROD impossible");
      setProdOnProd(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <EditorEntityPageTitle
        backHref="/editeur/jalons"
        title={t("milestones.viewTitle").replace("{name}", displayName)}
        meta={<span className="font-mono text-xs">{milestone.slug}</span>}
        sub={`${startLabel}${endLabel ? ` → ${endLabel}` : ""}`}
      />

      {error ? (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      <EditorEntityActionsBar
        editHref={`/editeur/jalons/${milestone.id}/modifier`}
        editLabel={t("list.edit")}
      />

      <div className="rounded-lg border border-[#d4dde6] bg-white p-4 sm:p-6">
        <dl className="grid gap-5 sm:grid-cols-2">
          <ReadOnlyField label="Titre FR" value={milestone.titleFr} />
          <ReadOnlyField label="Title EN" value={milestone.titleEn} />
          <div className="sm:col-span-2">
            <ReadOnlyField label="Description FR" value={milestone.descriptionFr} />
          </div>
          <div className="sm:col-span-2">
            <ReadOnlyField label="Description EN" value={milestone.descriptionEn} />
          </div>
          <ReadOnlyField label={t("milestones.startDate")} value={startLabel} />
          <ReadOnlyField
            label={t("milestones.endDate")}
            value={endLabel ?? t("milestones.noEndDate")}
          />
          <ReadOnlyField
            label={t("milestones.workloadForecast")}
            value={
              milestone.workloadForecast != null ? String(milestone.workloadForecast) : "—"
            }
          />
        </dl>
      </div>

      <EditorFormDangerZone description={t("milestones.dangerHint")}>
        {isTestEnv && !prodOnProd ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void publishToProd()}
            className="rounded-md border border-emerald-300 bg-white px-4 py-2 text-sm text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
          >
            {t("milestones.publishProd")}
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void remove()}
          className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
        >
          {t("milestones.delete")}
        </button>
      </EditorFormDangerZone>
    </div>
  );
}
