"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HullId } from "@/lib/types";
import { LangToggle } from "./LangToggle";
import { PostGalleryEditor } from "./PostGalleryEditor";
import { useLocale } from "./LocaleProvider";
import type { GalleryEditorImage } from "@/lib/gallery-editor";
import {
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/lib/utils";

type Tag = { id: string; name: string; labelFr: string; labelEn: string };
type Theme = { id: string; slug: string; labelFr: string; labelEn: string };
type Milestone = { id: string; slug: string; titleFr: string; titleEn: string };
type PlatformEditor = { id: string; email: string; name: string | null };

export type EditorPost = {
  id: string;
  slug: string;
  titleFr: string;
  titleEn: string;
  excerptFr: string;
  excerptEn: string;
  bodyFr: string;
  bodyEn: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishedAt: string | Date | null;
  coverImageUrl: string | null;
  authorId: string;
  author: PlatformEditor;
  hulls: { hull: HullId }[];
  tags: { tag: Tag }[];
  themes: { theme: Theme }[];
  milestones: { milestone: Milestone }[];
  images: GalleryEditorImage[];
};

type Props = {
  post: EditorPost;
  tags: Tag[];
  themes: Theme[];
  milestones: Milestone[];
  editors: PlatformEditor[];
  isTestEnv?: boolean;
  onProd?: boolean;
};

const HULL_OPTIONS: HullId[] = ["HULL_268", "HULL_269", "HULL_270"];

export function PostEditor({
  post,
  tags,
  themes,
  milestones,
  editors,
  isTestEnv = false,
  onProd,
}: Props) {
  const router = useRouter();
  const { locale, t } = useLocale();
  const [lang, setLang] = useState<"fr" | "en">("fr");
  const [form, setForm] = useState({
    titleFr: post.titleFr,
    titleEn: post.titleEn,
    excerptFr: post.excerptFr,
    excerptEn: post.excerptEn,
    bodyFr: post.bodyFr,
    bodyEn: post.bodyEn,
    coverImageUrl: post.coverImageUrl ?? "",
    publishedAt: toDatetimeLocalValue(post.publishedAt),
    authorId: post.authorId,
    hulls: post.hulls.map((h) => h.hull),
    tagIds: post.tags.map((t) => t.tag.id),
    themeIds: post.themes.map((t) => t.theme.id),
    milestoneIds: post.milestones.map((m) => m.milestone.id),
  });
  const [slug, setSlug] = useState(post.slug);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [newTagFr, setNewTagFr] = useState("");
  const [newTagEn, setNewTagEn] = useState("");
  const [allTags, setAllTags] = useState(tags);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef(form);
  const skipInitialAutosave = useRef(true);
  const saveGenRef = useRef(0);
  formRef.current = form;

  const buildPayload = useCallback(() => {
    const current = formRef.current;
    return {
      titleFr: current.titleFr,
      titleEn: current.titleEn,
      excerptFr: current.excerptFr,
      excerptEn: current.excerptEn,
      bodyFr: current.bodyFr,
      bodyEn: current.bodyEn,
      coverImageUrl: current.coverImageUrl || null,
      publishedAt: fromDatetimeLocalValue(current.publishedAt),
      authorId: current.authorId,
      hulls: current.hulls,
      tagIds: current.tagIds,
      themeIds: current.themeIds,
      milestoneIds: current.milestoneIds,
    };
  }, []);

  const save = useCallback(async () => {
    const gen = ++saveGenRef.current;
    setSaveState("saving");
    try {
      const payload = buildPayload();
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      });
      if (gen !== saveGenRef.current) return;
      if (!res.ok) throw new Error("Save failed");
      const updated = (await res.json()) as { slug?: string };
      if (updated.slug) setSlug(updated.slug);
      setSaveState("saved");
    } catch {
      if (gen !== saveGenRef.current) return;
      setSaveState("error");
    }
  }, [buildPayload, post.id]);

  // Flush pending autosave on leave so date/title edits are not lost.
  useEffect(() => {
    function flush() {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      const payload = buildPayload();
      void fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    }
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
        flush();
      }
    };
  }, [buildPayload, post.id]);

  useEffect(() => {
    if (skipInitialAutosave.current) {
      skipInitialAutosave.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void save();
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [form, save]);

  async function publish() {
    await save();
    const res = await fetch(`/api/posts/${post.id}/publish`, { method: "POST" });
    if (res.ok) router.push("/editeur");
  }

  async function archive(archived: boolean) {
    const res = await fetch(`/api/posts/${post.id}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert((data as { error?: string }).error ?? t("editor.archiveFailed"));
      return;
    }
    router.refresh();
  }

  async function removePost() {
    const title = locale === "fr" ? form.titleFr : form.titleEn || form.titleFr;
    if (!confirm(t("editor.deleteConfirm").replace("{title}", title))) return;
    const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert(t("editor.deleteFailed"));
      return;
    }
    router.push("/editeur");
  }

  async function publishToProd() {
    if (!confirm(t("editor.publishProdConfirm"))) return;
    const res = await fetch("/api/sync/publish-to-prod", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: post.id, publish: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert((data as { error?: string }).error ?? t("editor.publishProdFailed"));
      return;
    }
    alert(t("editor.publishProdDone"));
    router.refresh();
  }

  async function addTag() {
    if (!newTagFr.trim() || !newTagEn.trim()) return;
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labelFr: newTagFr, labelEn: newTagEn }),
    });
    if (res.ok) {
      const tag = await res.json();
      setAllTags((prev) => [...prev, tag]);
      setForm((f) => ({ ...f, tagIds: [...f.tagIds, tag.id] }));
      setNewTagFr("");
      setNewTagEn("");
    }
  }

  function toggleHull(hull: HullId) {
    setForm((f) => ({
      ...f,
      hulls: f.hulls.includes(hull)
        ? f.hulls.filter((h) => h !== hull)
        : [...f.hulls, hull],
    }));
  }

  function toggleId(key: "tagIds" | "themeIds" | "milestoneIds", id: string) {
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(id)
        ? f[key].filter((x) => x !== id)
        : [...f[key], id],
    }));
  }

  const saveLabel =
    saveState === "saving"
      ? "Enregistrement…"
      : saveState === "saved"
        ? "Enregistré"
        : saveState === "error"
          ? "Erreur"
          : "";

  const displayTitle =
    (lang === "fr" ? form.titleFr : form.titleEn).trim() ||
    (lang === "fr" ? "Sans titre" : "Untitled");

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Link
          href="/editeur"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#d4dde6] text-lg text-[#495867] hover:bg-[#f4f7fa]"
          aria-label={lang === "fr" ? "Retour à la liste" : "Back to list"}
          title={lang === "fr" ? "Retour à la liste" : "Back to list"}
        >
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold text-[#0D131A]">
            {displayTitle}
          </h1>
          <p className="mt-0.5 text-sm text-[#495867]">
            {lang === "fr" ? "Modification" : "Editing"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <LangToggle lang={lang} onChange={setLang} />
          <span className="text-sm text-[#495867]">{saveLabel}</span>
          <span
            className={`rounded px-2 py-0.5 text-xs ${
              post.status === "PUBLISHED"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {post.status === "PUBLISHED" ? "Publié" : post.status === "ARCHIVED" ? "Archivé" : "Brouillon"}
          </span>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/apercu/${post.id}`}
            className="rounded-md border border-[#495867] px-4 py-2 text-sm text-[#495867] hover:bg-[#eef3f7]"
          >
            {locale === "fr" ? "Aperçu" : "Preview"}
          </Link>
          {isTestEnv && onProd === false && post.status !== "ARCHIVED" && (
            <button
              type="button"
              onClick={() => void publishToProd()}
              className="rounded-md border border-emerald-700 px-4 py-2 text-sm text-emerald-800 hover:bg-emerald-50"
            >
              {t("editor.publishProd")}
            </button>
          )}
          {post.status === "ARCHIVED" ? (
            <button
              type="button"
              onClick={() => void archive(false)}
              className="rounded-md border border-[#d4dde6] px-4 py-2 text-sm text-[#495867] hover:bg-[#f4f7fa]"
            >
              {t("editor.unarchive")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void archive(true)}
              className="rounded-md border border-[#d4dde6] px-4 py-2 text-sm text-[#495867] hover:bg-[#f4f7fa]"
            >
              {t("editor.archive")}
            </button>
          )}
          <button
            type="button"
            onClick={publish}
            className="rounded-md bg-[#495867] px-4 py-2 text-sm text-white hover:bg-[#3a4654]"
          >
            {locale === "fr" ? "Publier" : "Publish"}
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        <input
          value={lang === "fr" ? form.titleFr : form.titleEn}
          onChange={(e) =>
            setForm((f) =>
              lang === "fr"
                ? { ...f, titleFr: e.target.value }
                : { ...f, titleEn: e.target.value }
            )
          }
          placeholder={lang === "fr" ? "Titre (FR)" : "Title (EN)"}
          className="w-full rounded-md border border-[#d4dde6] px-4 py-3 text-xl font-semibold"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-[#495867]">{t("editor.slug")}</span>
            <input
              value={slug}
              readOnly
              className="w-full cursor-default rounded-md border border-[#d4dde6] bg-[#f4f7fa] px-3 py-2 font-mono text-sm text-[#495867]"
            />
            <span className="mt-1 block text-[11px] text-[#495867]">
              {post.status === "DRAFT"
                ? t("editor.slugHintDraft")
                : t("editor.slugHintFrozen")}
            </span>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[#495867]">
              {t("editor.publishedAt")}
            </span>
            <input
              type="datetime-local"
              value={form.publishedAt}
              onChange={(e) =>
                setForm((f) => ({ ...f, publishedAt: e.target.value }))
              }
              className="w-full rounded-md border border-[#d4dde6] px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-[11px] text-[#495867]">
              {t("editor.publishedAtHint")}
            </span>
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-[#495867]">{t("editor.author")}</span>
          <select
            value={form.authorId}
            onChange={(e) =>
              setForm((f) => ({ ...f, authorId: e.target.value }))
            }
            className="w-full rounded-md border border-[#d4dde6] bg-white px-3 py-2 text-sm"
          >
            {editors.map((editor) => (
              <option key={editor.id} value={editor.id}>
                {editor.name?.trim() || editor.email}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[11px] text-[#495867]">
            {t("editor.authorHint")}
          </span>
        </label>
        <textarea
          value={lang === "fr" ? form.excerptFr : form.excerptEn}
          onChange={(e) =>
            setForm((f) =>
              lang === "fr"
                ? { ...f, excerptFr: e.target.value }
                : { ...f, excerptEn: e.target.value }
            )
          }
          placeholder={lang === "fr" ? "Extrait" : "Excerpt"}
          rows={2}
          className="w-full rounded-md border border-[#d4dde6] px-3 py-2 text-sm"
        />
        <textarea
          value={lang === "fr" ? form.bodyFr : form.bodyEn}
          onChange={(e) =>
            setForm((f) =>
              lang === "fr"
                ? { ...f, bodyFr: e.target.value }
                : { ...f, bodyEn: e.target.value }
            )
          }
          placeholder={lang === "fr" ? "Contenu (FR)" : "Content (EN)"}
          rows={16}
          className="w-full rounded-md border border-[#d4dde6] px-3 py-2 font-mono text-sm leading-relaxed"
        />
        <PostGalleryEditor
          postId={post.id}
          lang={lang}
          initialImages={post.images}
          coverImageUrl={form.coverImageUrl || null}
          onCoverChange={(url) =>
            setForm((f) => ({ ...f, coverImageUrl: url ?? "" }))
          }
        />
      </div>

      <fieldset className="rounded-lg border border-[#d4dde6] p-4">
        <legend className="px-2 text-sm font-medium">Coques</legend>
        <div className="flex flex-wrap gap-2">
          {HULL_OPTIONS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => toggleHull(h)}
              className={`rounded border px-3 py-1 text-sm ${
                form.hulls.includes(h)
                  ? "border-[#495867] bg-[#495867] text-white"
                  : "border-[#d4dde6]"
              }`}
            >
              {h.replace("HULL_", "#")}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-[#d4dde6] p-4">
        <legend className="px-2 text-sm font-medium">Thèmes</legend>
        <div className="flex flex-wrap gap-2">
          {themes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => toggleId("themeIds", t.id)}
              className={`rounded border px-3 py-1 text-sm ${
                form.themeIds.includes(t.id)
                  ? "border-[#495867] bg-[#495867] text-white"
                  : "border-[#d4dde6]"
              }`}
            >
              {t.labelFr}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-[#d4dde6] p-4">
        <legend className="px-2 text-sm font-medium">Tags</legend>
        <div className="mb-3 flex flex-wrap gap-2">
          {allTags.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => toggleId("tagIds", t.id)}
              className={`rounded border px-3 py-1 text-sm ${
                form.tagIds.includes(t.id)
                  ? "border-[#495867] bg-[#495867] text-white"
                  : "border-[#d4dde6]"
              }`}
            >
              {t.labelFr}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={newTagFr}
            onChange={(e) => setNewTagFr(e.target.value)}
            placeholder="Nouveau tag FR"
            className="rounded border border-[#d4dde6] px-2 py-1 text-sm"
          />
          <input
            value={newTagEn}
            onChange={(e) => setNewTagEn(e.target.value)}
            placeholder="New tag EN"
            className="rounded border border-[#d4dde6] px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={addTag}
            className="rounded bg-[#eef3f7] px-3 py-1 text-sm text-[#495867]"
          >
            + Tag
          </button>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-[#d4dde6] p-4">
        <legend className="px-2 text-sm font-medium">Jalons</legend>
        <div className="flex flex-wrap gap-2">
          {milestones.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => toggleId("milestoneIds", m.id)}
              className={`rounded border px-3 py-1 text-sm ${
                form.milestoneIds.includes(m.id)
                  ? "border-[#495867] bg-[#495867] text-white"
                  : "border-[#d4dde6]"
              }`}
            >
              {m.titleFr}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
        <h2 className="text-sm font-semibold text-red-900">{t("editor.dangerZone")}</h2>
        <button
          type="button"
          onClick={() => void removePost()}
          className="mt-3 rounded-md border border-red-300 bg-white px-4 py-2 text-sm text-red-800 hover:bg-red-100"
        >
          {t("editor.delete")}
        </button>
      </div>
    </div>
  );
}
