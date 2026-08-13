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
  onGroupClick: (groupId: string) => void;
};

export function MediaGroupChips({
  groups,
  locale,
  maxVisible = 2,
  onGroupClick,
}: Props) {
  if (groups.length === 0) return null;

  const visible = groups.slice(0, maxVisible);
  const extra = groups.length - visible.length;

  return (
    <div
      className="mt-1 flex max-w-full flex-wrap gap-1"
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
            className="inline-flex max-w-[10rem] items-center truncate rounded border border-[#495867] bg-[#eef3f7] px-1.5 py-0.5 text-[10px] font-medium text-[#495867] hover:bg-[#495867] hover:text-white"
            title={label}
          >
            📷 {label}
          </button>
        );
      })}
      {extra > 0 && (
        <span className="inline-flex items-center rounded border border-[#d4dde6] bg-white px-1.5 py-0.5 text-[10px] text-[#495867]">
          +{extra}
        </span>
      )}
    </div>
  );
}
