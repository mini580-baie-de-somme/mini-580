"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { FullscreenEditorModal } from "./FullscreenEditorModal";
import { EditorSheetPanel } from "./EditorSheetPanel";
import { MediaKindThumb } from "./MediaKindThumb";
import { useLocale } from "./LocaleProvider";
import type { MediaKindClient } from "@/lib/media-file-client";
import { dispatchMediaGroupUpdated } from "@/lib/media-group-display";

type MediaGroupLayout = "GRID" | "ROW" | "SINGLE";

type GroupMemberMedia = {
  id: string;
  kind: MediaKindClient;
  mimeType: string;
  urlOrigin: string;
  urlPicto: string | null;
  urlMoyenne: string | null;
  urlGrande: string | null;
  titleFr: string;
  titleEn: string;
};

type GroupMember = {
  mediaId: string;
  sortOrder: number;
  media: GroupMemberMedia;
};

type ReferencedPost = {
  id: string;
  slug: string;
  titleFr: string;
  titleEn: string;
  status: string;
};

type MediaGroupDetail = {
  id: string;
  slug: string;
  titleFr: string;
  titleEn: string;
  layout: MediaGroupLayout;
  members: GroupMember[];
  memberCount: number;
  referencedByPostIds: string[];
};

type PickerItem = {
  id: string;
  kind: MediaKindClient;
  mimeType: string;
  urlOrigin: string;
  urlPicto: string | null;
  urlMoyenne: string | null;
  urlGrande: string | null;
  titleFr: string;
  titleEn: string;
};

type FormState = {
  titleFr: string;
  titleEn: string;
  layout: MediaGroupLayout;
  mediaIds: string[];
};

type Props = {
  groupId: string;
  onClose: () => void;
  onSaved?: () => void;
};

function previewSrc(m: GroupMemberMedia | PickerItem): string | null {
  if (m.kind === "IMAGE" && m.mimeType?.startsWith("image/")) {
    return m.urlPicto || m.urlMoyenne || m.urlOrigin;
  }
  return m.urlPicto || m.urlMoyenne || null;
}

function formFromDetail(detail: MediaGroupDetail): FormState {
  return {
    titleFr: detail.titleFr,
    titleEn: detail.titleEn,
    layout: detail.layout,
    mediaIds: detail.members.map((m) => m.mediaId),
  };
}

function formsEqual(a: FormState, b: FormState): boolean {
  return (
    a.titleFr === b.titleFr &&
    a.titleEn === b.titleEn &&
    a.layout === b.layout &&
    a.mediaIds.length === b.mediaIds.length &&
    a.mediaIds.every((id, index) => id === b.mediaIds[index])
  );
}

export function MediaGroupEditor({ groupId, onClose, onSaved }: Props) {
  const { locale, t } = useLocale();
  const [detail, setDetail] = useState<MediaGroupDetail | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [referencedPosts, setReferencedPosts] = useState<ReferencedPost[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [localError, setLocalError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQ, setPickerQ] = useState("");
  const [pickerItems, setPickerItems] = useState<PickerItem[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<FormState | null>(null);
  const lastSavedFormRef = useRef<FormState | null>(null);
  const skipInitialAutosave = useRef(true);
  const saveGenRef = useRef(0);
  const onSavedRef = useRef(onSaved);
  const saveRef = useRef<() => Promise<void>>(async () => {});
  formRef.current = form;
  onSavedRef.current = onSaved;

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setLocalError(null);
    try {
      const [detailRes, refsRes] = await Promise.all([
        fetch(`/api/media-groups/${groupId}`),
        fetch(`/api/media-groups/${groupId}/references`),
      ]);
      if (!detailRes.ok) throw new Error(t("mediaGroup.loadError"));
      const data = (await detailRes.json()) as MediaGroupDetail;
      const loaded = formFromDetail(data);
      setDetail(data);
      setMembers(data.members);
      setForm(loaded);
      lastSavedFormRef.current = loaded;
      skipInitialAutosave.current = true;
      if (refsRes.ok) {
        const refs = (await refsRes.json()) as { posts: ReferencedPost[] };
        setReferencedPosts(refs.posts ?? []);
      } else {
        setReferencedPosts([]);
      }
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : t("mediaGroup.loadError"));
    } finally {
      setLoading(false);
    }
  }, [groupId, t]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const save = useCallback(async () => {
    const current = formRef.current;
    if (!current) return;
    const gen = ++saveGenRef.current;
    setSaveState("saving");
    try {
      const res = await fetch(`/api/media-groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleFr: current.titleFr,
          titleEn: current.titleEn,
          layout: current.layout,
          mediaIds: current.mediaIds,
        }),
      });
      if (gen !== saveGenRef.current) return;
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          typeof data.error === "string" ? data.error : t("mediaGroup.saveError")
        );
      }
      const updated = (await res.json()) as MediaGroupDetail;
      const synced = formFromDetail(updated);
      setDetail(updated);
      setMembers(updated.members);
      lastSavedFormRef.current = synced;
      if (current && !formsEqual(current, synced)) {
        skipInitialAutosave.current = true;
        setForm(synced);
      }
      setSaveState("saved");
      dispatchMediaGroupUpdated(groupId);
      onSavedRef.current?.();
    } catch (e) {
      if (gen !== saveGenRef.current) return;
      setSaveState("error");
      setLocalError(e instanceof Error ? e.message : t("mediaGroup.saveError"));
    }
  }, [groupId, t]);

  saveRef.current = save;

  useEffect(() => {
    if (!form || loading) return;
    if (skipInitialAutosave.current) {
      skipInitialAutosave.current = false;
      return;
    }
    if (lastSavedFormRef.current && formsEqual(form, lastSavedFormRef.current)) {
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void saveRef.current();
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [form, loading]);

  useEffect(() => {
    function flush() {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      const current = formRef.current;
      if (!current) return;
      void fetch(`/api/media-groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleFr: current.titleFr,
          titleEn: current.titleEn,
          layout: current.layout,
          mediaIds: current.mediaIds,
        }),
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
  }, [groupId]);

  useEffect(() => {
    if (!pickerOpen) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        setPickerLoading(true);
        try {
          const params = new URLSearchParams();
          if (pickerQ.trim()) params.set("q", pickerQ.trim());
          params.set("limit", "20");
          const res = await fetch(`/api/media-library?${params.toString()}`);
          if (!res.ok) throw new Error("load");
          const data = (await res.json()) as { items: PickerItem[] };
          if (!cancelled) setPickerItems(data.items ?? []);
        } catch {
          if (!cancelled) setPickerItems([]);
        } finally {
          if (!cancelled) setPickerLoading(false);
        }
      })();
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pickerOpen, pickerQ]);

  function layoutLabel(layout: MediaGroupLayout) {
    if (layout === "GRID") return t("mediaGroup.layoutGrid");
    if (layout === "ROW") return t("mediaGroup.layoutRow");
    return t("mediaGroup.layoutSingle");
  }

  function moveMember(index: number, delta: -1 | 1) {
    if (!form) return;
    const next = index + delta;
    if (next < 0 || next >= form.mediaIds.length) return;
    const ids = [...form.mediaIds];
    [ids[index], ids[next]] = [ids[next], ids[index]];
    setForm({ ...form, mediaIds: ids });
    setMembers((prev) => {
      const copy = [...prev];
      [copy[index], copy[next]] = [copy[next], copy[index]];
      return copy;
    });
  }

  function removeMember(mediaId: string) {
    if (!form) return;
    setForm({ ...form, mediaIds: form.mediaIds.filter((id) => id !== mediaId) });
    setMembers((prev) => prev.filter((m) => m.mediaId !== mediaId));
  }

  function addMember(item: PickerItem) {
    if (!form || form.mediaIds.includes(item.id)) return;
    setForm({ ...form, mediaIds: [...form.mediaIds, item.id] });
    setMembers((prev) => [
      ...prev,
      {
        mediaId: item.id,
        sortOrder: prev.length,
        media: item,
      },
    ]);
    setPickerOpen(false);
    setPickerQ("");
  }

  async function confirmRemoveGroup() {
    if (!detail) return;
    if (referencedPosts.length > 0) return;
    setSaveState("saving");
    try {
      const res = await fetch(`/api/media-groups/${groupId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          typeof data.error === "string" ? data.error : t("mediaGroup.deleteError")
        );
      }
      setDeleteConfirmOpen(false);
      onSaved?.();
      onClose();
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : t("mediaGroup.deleteError"));
      setSaveState("error");
    }
  }

  const deleteGroupMessage =
    detail &&
    t("mediaGroup.deleteConfirm").replace(
      "{name}",
      (locale === "fr" ? detail.titleFr : detail.titleEn) || detail.slug
    );

  const saveLabel =
    saveState === "saving"
      ? t("mediaGroup.saving")
      : saveState === "saved"
        ? t("mediaGroup.saved")
        : saveState === "error"
          ? t("mediaGroup.saveError")
          : t("mediaGroup.autosave");

  const canDelete = referencedPosts.length === 0;

  return (
    <>
    <FullscreenEditorModal
      title={t("mediaGroup.edit")}
      onClose={onClose}
      busy={loading || saveState === "saving"}
      error={localError}
      footerLeft={
        <button
          type="button"
          disabled={!canDelete || loading || saveState === "saving"}
          title={
            canDelete
              ? undefined
              : t("mediaGroup.deleteBlocked").replace(
                  "{n}",
                  String(referencedPosts.length)
                )
          }
          onClick={() => setDeleteConfirmOpen(true)}
          className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("mediaGroup.delete")}
        </button>
      }
      footerRight={
        <span className="text-xs text-[#495867]" aria-live="polite">
          {saveLabel}
        </span>
      }
    >
      {loading || !form ? (
        <p className="p-4 text-sm text-[#495867]">{t("editor.loading")}</p>
      ) : (
        <div className="flex h-full min-h-0 flex-col overflow-hidden md:flex-row">
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#eef3f7]">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#d4dde6] bg-white px-3 py-2">
              <p className="text-sm font-medium text-[#0D131A]">
                {t("mediaGroup.members")} ({form.mediaIds.length})
              </p>
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                className="rounded-md border border-[#495867] px-3 py-1.5 text-sm text-[#495867] hover:bg-[#eef3f7]"
              >
                {t("mediaGroup.addMedia")}
              </button>
            </div>

            {pickerOpen && (
              <div className="shrink-0 border-b border-[#d4dde6] bg-white p-3">
                <input
                  type="search"
                  value={pickerQ}
                  onChange={(e) => setPickerQ(e.target.value)}
                  placeholder={t("mediaGroup.searchMedia")}
                  className="w-full rounded border border-[#d4dde6] px-3 py-2 text-sm"
                />
                {pickerLoading ? (
                  <p className="mt-2 text-xs text-[#495867]">{t("editor.loading")}</p>
                ) : (
                  <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                    {pickerItems.map((item) => {
                      const already = form.mediaIds.includes(item.id);
                      const label =
                        (locale === "fr" ? item.titleFr : item.titleEn) ||
                        item.id.slice(0, 8);
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            disabled={already}
                            onClick={() => addMember(item)}
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-[#eef3f7] disabled:opacity-40"
                          >
                            <MediaKindThumb
                              kind={item.kind}
                              mimeType={item.mimeType}
                              src={previewSrc(item)}
                            />
                            <span className="min-w-0 flex-1 truncate">{label}</span>
                            {already && (
                              <span className="text-[10px] text-[#495867]">
                                {t("mediaGroup.alreadyInGroup")}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                    {pickerItems.length === 0 && (
                      <li className="px-2 py-1 text-xs text-[#495867]">
                        {t("media.empty")}
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {members.length === 0 ? (
                <p className="text-sm text-[#495867]">{t("mediaGroup.emptyMembers")}</p>
              ) : (
                <ul className="space-y-2">
                  {members.map((member, index) => {
                    const m = member.media;
                    const label =
                      (locale === "fr" ? m.titleFr : m.titleEn) || m.id.slice(0, 8);
                    return (
                      <li
                        key={member.mediaId}
                        className="flex items-center gap-2 rounded-lg border border-[#d4dde6] bg-white p-2"
                      >
                        <MediaKindThumb
                          kind={m.kind}
                          mimeType={m.mimeType}
                          src={previewSrc(m)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[#0D131A]">
                            {label}
                          </p>
                          <p className="text-[10px] text-[#495867]">{m.mimeType}</p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-0.5">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => moveMember(index, -1)}
                            className="rounded border border-[#d4dde6] px-2 text-xs disabled:opacity-30"
                            aria-label={t("mediaGroup.moveUp")}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={index === members.length - 1}
                            onClick={() => moveMember(index, 1)}
                            className="rounded border border-[#d4dde6] px-2 text-xs disabled:opacity-30"
                            aria-label={t("mediaGroup.moveDown")}
                          >
                            ↓
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeMember(member.mediaId)}
                          className="shrink-0 text-xs text-red-700 hover:underline"
                        >
                          {t("mediaGroup.removeMedia")}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          <EditorSheetPanel
            handleLabel={
              locale === "fr"
                ? "Redimensionner le panneau de saisie"
                : "Resize input panel"
            }
            className="md:w-[min(100%,24rem)] md:flex-none md:shrink-0 md:border-l md:border-t-0"
          >
            <div className="flex flex-col gap-3 p-3 sm:p-4">
              <div className="space-y-2 text-sm">
                <div className="flex gap-2">
                  <label className="block min-w-0 flex-1">
                    <span className="text-[11px] text-[#495867]">
                      {t("media.titleFr")}
                    </span>
                    <input
                      className="mt-0.5 w-full rounded border border-[#d4dde6] px-2 py-1 text-sm"
                      value={form.titleFr}
                      onChange={(e) =>
                        setForm({ ...form, titleFr: e.target.value })
                      }
                    />
                  </label>
                  <label className="block min-w-0 flex-1">
                    <span className="text-[11px] text-[#495867]">
                      {t("media.titleEn")}
                    </span>
                    <input
                      className="mt-0.5 w-full rounded border border-[#d4dde6] px-2 py-1 text-sm"
                      value={form.titleEn}
                      onChange={(e) =>
                        setForm({ ...form, titleEn: e.target.value })
                      }
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-[11px] text-[#495867]">
                    {t("mediaGroup.slug")}
                  </span>
                  <input
                    readOnly
                    className="mt-0.5 w-full cursor-default rounded border border-[#d4dde6] bg-[#f4f7fa] px-2 py-1 font-mono text-sm text-[#495867]"
                    value={detail?.slug ?? ""}
                  />
                  <span className="mt-1 block text-[11px] text-[#495867]">
                    {t("mediaGroup.slugHint")}
                  </span>
                </label>

                <div>
                  <span className="text-[11px] text-[#495867]">
                    {t("mediaGroup.layout")}
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(["GRID", "ROW", "SINGLE"] as const).map((layout) => (
                      <button
                        key={layout}
                        type="button"
                        onClick={() => setForm({ ...form, layout })}
                        className={`rounded border px-2 py-1 text-xs ${
                          form.layout === layout
                            ? "border-[#495867] bg-[#495867] text-white"
                            : "border-[#d4dde6] bg-white text-[#495867]"
                        }`}
                      >
                        {layoutLabel(layout)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-[#eef3f7] pt-3">
                <p className="text-[11px] font-medium text-[#495867]">
                  {t("mediaGroup.referencedIn")} ({referencedPosts.length})
                </p>
                {referencedPosts.length === 0 ? (
                  <p className="mt-1 text-xs text-[#495867]">
                    {t("mediaGroup.notReferenced")}
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {referencedPosts.map((post) => (
                      <li key={post.id}>
                        <Link
                          href={`/editeur/${post.id}`}
                          className="text-xs text-[#495867] hover:underline"
                        >
                          {(locale === "fr" ? post.titleFr : post.titleEn) ||
                            post.slug}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </EditorSheetPanel>
        </div>
      )}
    </FullscreenEditorModal>

    <ConfirmDialog
      open={deleteConfirmOpen}
      title={t("mediaGroup.deleteConfirmTitle")}
      message={deleteGroupMessage ?? ""}
      confirmLabel={t("mediaGroup.delete")}
      cancelLabel={t("media.cancel")}
      busy={saveState === "saving"}
      onConfirm={() => void confirmRemoveGroup()}
      onCancel={() => {
        if (saveState !== "saving") setDeleteConfirmOpen(false);
      }}
    />
    </>
  );
}
