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
  maxVisible = 2,
  compact = false,
  onGroupClick,
}: Props) {
  if (groups.length === 0) return null;

  const visible = groups.slice(0, maxVisible);
  const extra = groups.length - visible.length;

  return (
    <div
      className={compact ? "flex max-w-full flex-wrap gap-0.5" : "mt-1 flex max-w-full flex-wrap gap-1"}
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
                ? "inline-flex max-w-[7rem] items-center truncate rounded-full bg-[#eef3f7] px-1.5 py-px text-[9px] font-medium text-[#495867] ring-1 ring-[#d4dde6]/80 hover:bg-[#495867] hover:text-white"
                : "inline-flex max-w-[10rem] items-center truncate rounded border border-[#495867] bg-[#eef3f7] px-1.5 py-0.5 text-[10px] font-medium text-[#495867] hover:bg-[#495867] hover:text-white"
            }
            title={label}
          >
            {compact ? label : `📷 ${label}`}
          </button>
        );
      })}
      {extra > 0 && (
        <span
          className={
            compact
              ? "inline-flex items-center rounded-full bg-white px-1.5 py-px text-[9px] text-[#6b7a8a] ring-1 ring-[#d4dde6]"
              : "inline-flex items-center rounded border border-[#d4dde6] bg-white px-1.5 py-0.5 text-[10px] text-[#495867]"
          }
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
