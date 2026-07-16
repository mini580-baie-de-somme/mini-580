"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HullId } from "@/lib/types";

const HULL_OPTIONS: HullId[] = ["HULL_268", "HULL_269", "HULL_270"];
import { LangToggle } from "./LangToggle";

type Tag = { id: string; name: string; labelFr: string; labelEn: string };
type Theme = { id: string; slug: string; labelFr: string; labelEn: string };
type Milestone = { id: string; slug: string; titleFr: string; titleEn: string };

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
  coverImageUrl: string | null;
  hulls: { hull: HullId }[];
  tags: { tag: Tag }[];
  themes: { theme: Theme }[];
  milestones: { milestone: Milestone }[];
};

type Props = {
  post: EditorPost;
  tags: Tag[];
  themes: Theme[];
  milestones: Milestone[];
};

export function PostEditor({ post, tags, themes, milestones }: Props) {
  const router = useRouter();
  const [lang, setLang] = useState<"fr" | "en">("fr");
  const [form, setForm] = useState({
    titleFr: post.titleFr,
    titleEn: post.titleEn,
    excerptFr: post.excerptFr,
    excerptEn: post.excerptEn,
    bodyFr: post.bodyFr,
    bodyEn: post.bodyEn,
    slug: post.slug,
    coverImageUrl: post.coverImageUrl ?? "",
    hulls: post.hulls.map((h) => h.hull),
    tagIds: post.tags.map((t) => t.tag.id),
    themeIds: post.themes.map((t) => t.theme.id),
    milestoneIds: post.milestones.map((m) => m.milestone.id),
  });
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "error">("idle");
  const [newTagFr, setNewTagFr] = useState("");
  const [newTagEn, setNewTagEn] = useState("");
  const [allTags, setAllTags] = useState(tags);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef(form);
  formRef.current = form;

  const save = useCallback(async () => {
    setSaveState("saving");
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formRef.current,
          coverImageUrl: formRef.current.coverImageUrl || null,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaveState("saved");
      router.refresh();
    } catch {
      setSaveState("error");
    }
  }, [post.id, router]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      save();
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

  async function uploadCover(file: File) {
    setUploadState("uploading");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/media", { method: "POST", body });
      if (!res.ok) throw new Error("upload failed");
      const data = (await res.json()) as { url: string };
      setForm((f) => ({ ...f, coverImageUrl: data.url }));
      setUploadState("idle");
    } catch {
      setUploadState("error");
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

  return (
    <div className="space-y-6">
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
            Aperçu
          </Link>
          <button
            type="button"
            onClick={publish}
            className="rounded-md bg-[#495867] px-4 py-2 text-sm text-white hover:bg-[#3a4654]"
          >
            Publier
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
        <input
          value={form.slug}
          onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
          placeholder="slug-url"
          className="w-full rounded-md border border-[#d4dde6] px-3 py-2 text-sm font-mono"
        />
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
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[#495867]">
            Image de couverture
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadCover(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadState === "uploading"}
              className="rounded-md border border-[#495867] px-3 py-2 text-sm text-[#495867] hover:bg-[#eef3f7] disabled:opacity-50"
            >
              {uploadState === "uploading" ? "Envoi…" : "Téléverser une image"}
            </button>
            {uploadState === "error" && (
              <span className="text-sm text-red-600">Échec de l’envoi</span>
            )}
          </div>
          <input
            value={form.coverImageUrl}
            onChange={(e) =>
              setForm((f) => ({ ...f, coverImageUrl: e.target.value }))
            }
            placeholder="URL ou chemin /media/… (après téléversement)"
            className="w-full rounded-md border border-[#d4dde6] px-3 py-2 text-sm"
          />
          {form.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={form.coverImageUrl}
              alt=""
              className="mt-1 max-h-48 w-auto rounded-md border border-[#d4dde6] object-cover"
            />
          ) : null}
        </div>
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
    </div>
  );
}
