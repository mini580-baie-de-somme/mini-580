"use client";

import type { ReactNode } from "react";
import { MediaGroupChips, type MediaGroupSummary } from "./MediaGroupChips";
import { MediaKindThumb } from "./MediaKindThumb";

type MediaKind = "IMAGE" | "DOCUMENT" | "VIDEO";

export type MediaLibraryMobileCardProps = {
  id: string;
  kind: MediaKind;
  kindLabel: string;
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

function shortMime(mimeType: string): string {
  const sub = mimeType.split("/")[1];
  if (!sub) return mimeType;
  return sub.replace(/^x-/, "").toUpperCase();
}

export function MediaLibraryMobileCard({
  kind,
  kindLabel,
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
    <article className="flex w-full max-w-full items-stretch gap-2.5 overflow-hidden rounded-xl border border-[#d4dde6] bg-white p-2.5 shadow-sm">
      <button
        type="button"
        disabled={busy}
        onClick={onEdit}
        className="group shrink-0 disabled:opacity-50"
        aria-label={labels.edit}
      >
        <div className="relative h-[4.5rem] w-[4.5rem] overflow-hidden rounded-lg bg-[#eef3f7] ring-1 ring-[#d4dde6]/60">
          {kind === "IMAGE" && thumbSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbSrc}
              alt=""
              className="h-full w-full object-cover transition duration-200 group-active:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <MediaKindThumb
                kind={kind}
                mimeType={mimeType}
                src={null}
                size="sm"
                className="h-10 w-10 bg-transparent"
              />
            </div>
          )}
        </div>
      </button>

      <button
        type="button"
        disabled={busy}
        onClick={onEdit}
        className="flex min-w-0 flex-1 flex-col justify-center gap-1 text-left disabled:opacity-50"
      >
        <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-[#0D131A]">
          {title}
        </p>
        <p className="truncate text-[11px] text-[#6b7a8a]">
          {kindLabel}
          <span className="mx-1 text-[#c5ced8]">·</span>
          {shortMime(mimeType)}
        </p>
        <div className="flex flex-wrap items-center gap-1">
          {visibilityBadge}
          {integrityBadge}
          {groups.length > 0 ? (
            <MediaGroupChips
              groups={groups}
              locale={locale}
              maxVisible={2}
              compact
              onGroupClick={onGroupClick}
            />
          ) : null}
        </div>
      </button>

      <div
        className="flex shrink-0 flex-col items-center justify-center gap-0.5 border-l border-[#eef3f7] pl-2"
        onClick={(e) => e.stopPropagation()}
      >
        <IconAction
          title={labels.edit}
          disabled={busy}
          onClick={onEdit}
          icon={<EditIcon className="h-3.5 w-3.5" />}
        />
        <IconAction
          title={labels.open}
          href={openUrl}
          icon={<OpenIcon className="h-3.5 w-3.5" />}
        />
        <IconAction
          title={labels.delete}
          disabled={busy}
          onClick={onDelete}
          destructive
          icon={<DeleteIcon className="h-3.5 w-3.5" />}
        />
      </div>
    </article>
  );
}

function IconAction({
  title,
  icon,
  onClick,
  href,
  disabled,
  destructive,
}: {
  title: string;
  icon: ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const cls = [
    "inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors",
    destructive
      ? "text-red-600 hover:bg-red-50 active:bg-red-100"
      : "text-[#495867] hover:bg-[#eef3f7] active:bg-[#e2e9ef]",
    disabled ? "pointer-events-none opacity-40" : "",
  ].join(" ");

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" title={title} className={cls}>
        {icon}
      </a>
    );
  }

  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick} className={cls}>
      {icon}
    </button>
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
