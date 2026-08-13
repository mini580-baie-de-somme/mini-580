"use client";

import type { ReactNode } from "react";
import { MediaGroupChips, type MediaGroupSummary } from "./MediaGroupChips";
import { MediaKindThumb } from "./MediaKindThumb";

type MediaKind = "IMAGE" | "DOCUMENT" | "VIDEO";

export type MediaLibraryMobileCardProps = {
  id: string;
  kind: MediaKind;
  mimeType: string;
  title: string;
  thumbSrc: string | null;
  visibilityBadge: ReactNode;
  integrityBadge?: ReactNode;
  groups: MediaGroupSummary[];
  locale: "fr" | "en";
  busy?: boolean;
  openUrl: string;
  labels: {
    edit: string;
    open: string;
    delete: string;
  };
  onEdit: () => void;
  onDelete: () => void;
  onGroupClick: (groupId: string) => void;
};

export function MediaLibraryMobileCard({
  kind,
  mimeType,
  title,
  thumbSrc,
  visibilityBadge,
  integrityBadge,
  groups,
  locale,
  busy,
  openUrl,
  labels,
  onEdit,
  onDelete,
  onGroupClick,
}: MediaLibraryMobileCardProps) {
  return (
    <article className="flex w-full max-w-full flex-col overflow-hidden rounded-xl border border-[#d4dde6] bg-white shadow-sm">
      <button
        type="button"
        disabled={busy}
        onClick={onEdit}
        className="group block w-full text-left disabled:opacity-50"
      >
        <div className="relative aspect-[5/3] w-full overflow-hidden bg-[#eef3f7]">
          {kind === "IMAGE" && thumbSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbSrc}
              alt=""
              className="h-full w-full object-cover transition duration-200 group-active:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <MediaKindThumb
                kind={kind}
                mimeType={mimeType}
                src={null}
                size="md"
                className="h-16 w-16 bg-transparent"
              />
            </div>
          )}
        </div>

        <div className="space-y-2 px-3 py-3">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-[#0D131A]">
            {title}
          </p>
          <p className="truncate text-[11px] text-[#495867]">{mimeType}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {visibilityBadge}
            {integrityBadge}
          </div>
          {groups.length > 0 ? (
            <MediaGroupChips
              groups={groups}
              locale={locale}
              maxVisible={3}
              onGroupClick={onGroupClick}
            />
          ) : null}
        </div>
      </button>

      <div
        className="grid grid-cols-3 border-t border-[#eef3f7] bg-[#fafbfc]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          disabled={busy}
          onClick={onEdit}
          className="inline-flex min-h-[48px] flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium text-[#495867] active:bg-[#eef3f7] disabled:opacity-50"
        >
          <EditIcon className="h-4 w-4" />
          <span>{labels.edit}</span>
        </button>
        <a
          href={openUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-[48px] flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium text-[#495867] active:bg-[#eef3f7]"
        >
          <OpenIcon className="h-4 w-4" />
          <span>{labels.open}</span>
        </a>
        <button
          type="button"
          disabled={busy}
          onClick={onDelete}
          className="inline-flex min-h-[48px] flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium text-red-700 active:bg-red-50 disabled:opacity-50"
        >
          <DeleteIcon className="h-4 w-4" />
          <span>{labels.delete}</span>
        </button>
      </div>
    </article>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function OpenIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

function DeleteIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}
