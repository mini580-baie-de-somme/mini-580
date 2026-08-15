"use client";

export type MediaGroupSummary = {
  id: string;
  slug: string;
  titleFr: string;
  titleEn: string;
};

type Props = {
  groups: MediaGroupSummary[];
  locale: "fr" | "en";
  maxVisible?: number;
  compact?: boolean;
  onGroupClick: (groupId: string) => void;
};

export function MediaGroupChips({
  groups,
  locale,
  maxVisible = 3,
  compact = false,
  onGroupClick,
}: Props) {
  if (groups.length === 0) return null;

  const visible = groups.slice(0, maxVisible);
  const extra = groups.length - visible.length;

  return (
    <div
      className={
        compact
          ? "flex max-w-full flex-col gap-1"
          : "mt-1.5 flex max-w-full flex-col gap-1.5"
      }
      onClick={(e) => e.stopPropagation()}
    >
      {visible.map((g) => {
        const label =
          (locale === "fr" ? g.titleFr : g.titleEn) || g.slug || g.id.slice(0, 8);
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => onGroupClick(g.id)}
            className={
              compact
                ? "inline-flex w-full max-w-full items-start rounded-md bg-[#eef3f7] px-2 py-1 text-left text-[11px] font-semibold leading-snug text-[#0D131A] ring-1 ring-[#495867]/25 hover:bg-[#495867] hover:text-white"
                : "inline-flex w-full max-w-full items-start rounded-md border-2 border-[#495867]/30 bg-[#eef3f7] px-2.5 py-1.5 text-left text-xs font-semibold leading-snug text-[#0D131A] hover:border-[#495867] hover:bg-[#495867] hover:text-white"
            }
            title={label}
          >
            <span className="mr-1.5 shrink-0 opacity-70">📷</span>
            <span className="min-w-0 break-words">{label}</span>
          </button>
        );
      })}
      {extra > 0 && (
        <span
          className={
            compact
              ? "inline-flex w-fit items-center rounded-md bg-white px-2 py-0.5 text-[10px] font-medium text-[#495867] ring-1 ring-[#d4dde6]"
              : "inline-flex w-fit items-center rounded-md border border-[#d4dde6] bg-white px-2 py-0.5 text-[11px] font-medium text-[#495867]"
          }
        >
          +{extra} {locale === "fr" ? "groupes" : "groups"}
        </span>
      )}
    </div>
  );
}
