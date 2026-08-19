"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EditorEntityActionsBar } from "./EditorEntityActionsBar";
import { EditorEntityPageTitle } from "./EditorEntityPageTitle";
import { EditorFormDangerZone } from "./EditorFormDangerZone";
import { useLocale } from "./LocaleProvider";
import {
  apiExternalLinkErrorMessage,
  displayExternalLinkUrl,
  type ExternalLinkRecord,
  type ExternalLinkReferencePost,
} from "./external-link-types";

type Props = {
  link: ExternalLinkRecord;
  references: ExternalLinkReferencePost[];
};

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-[#495867]">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm text-[#0D131A]">{value || "—"}</dd>
    </div>
  );
}

export function ExternalLinkConsultation({ link, references }: Props) {
  const { locale, t } = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName =
    (locale === "fr" ? link.labelFr : link.labelEn) || link.labelFr || link.labelEn || "—";
  const hasReferences = references.length > 0;

  async function remove() {
    if (!confirm(t("externalLinks.deleteConfirm").replace("{name}", displayName))) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/external-links/${link.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        throw new Error(t("externalLinks.deleteInUse"));
      }
      if (!res.ok) {
        throw new Error(apiExternalLinkErrorMessage(data.error, t("externalLinks.deleteError")));
      }
      router.push("/editeur/liens");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("externalLinks.deleteError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <EditorEntityPageTitle
        backHref="/editeur/liens"
        title={t("externalLinks.viewTitle").replace("{name}", displayName)}
        meta={<span className="font-mono text-xs">#{link.id}</span>}
      />

      {error ? (
        <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      <EditorEntityActionsBar
        editHref={`/editeur/liens/${link.id}/modifier`}
        editLabel={t("list.edit")}
      />

      <div className="rounded-lg border border-[#d4dde6] bg-white p-4 sm:p-6">
        <dl className="grid gap-5 sm:grid-cols-2">
          <ReadOnlyField label={t("externalLinks.labelFr")} value={link.labelFr} />
          <ReadOnlyField label={t("externalLinks.labelEn")} value={link.labelEn} />
          {link.url?.trim() ? (
            <div className="sm:col-span-2">
              <ReadOnlyField label={t("externalLinks.url")} value={link.url} />
            </div>
          ) : (
            <>
              <ReadOnlyField label={t("externalLinks.urlFr")} value={link.urlFr ?? ""} />
              <ReadOnlyField label={t("externalLinks.urlEn")} value={link.urlEn ?? ""} />
            </>
          )}
          <div className="sm:col-span-2">
            <ReadOnlyField
              label={t("externalLinks.colUrl")}
              value={displayExternalLinkUrl(link)}
            />
          </div>
        </dl>
      </div>

      <section className="mt-6 rounded-lg border border-[#d4dde6] bg-white p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-[#0D131A]">{t("externalLinks.referencesTitle")}</h2>
        <p className="mt-1 text-xs text-[#495867]">
          {hasReferences
            ? t("externalLinks.referencedIn").replace("{count}", String(references.length))
            : t("externalLinks.referencesEmpty")}
        </p>
        {hasReferences ? (
          <ul className="mt-4 divide-y divide-[#eef3f7]">
            {references.map((post) => {
              const title =
                (locale === "fr" ? post.titleFr : post.titleEn) || post.titleFr || post.titleEn;
              return (
                <li key={post.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#0D131A]">{title}</p>
                    <p className="text-xs text-[#495867]">{post.status}</p>
                  </div>
                  <Link
                    href={`/editeur/${post.id}`}
                    className="shrink-0 text-xs text-[#495867] hover:underline"
                  >
                    {t("externalLinks.openArticle")}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      <EditorFormDangerZone description={t("externalLinks.dangerHint")}>
        <button
          type="button"
          disabled={busy || hasReferences}
          onClick={() => void remove()}
          className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
          title={hasReferences ? t("externalLinks.deleteInUse") : undefined}
        >
          {t("externalLinks.delete")}
        </button>
      </EditorFormDangerZone>
    </div>
  );
}
