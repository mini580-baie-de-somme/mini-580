import { HULL_LABELS, HullValue } from "@/lib/constants";
import type { HullId } from "@/lib/types";
import { hullToShort } from "@/lib/utils";

const hullColors: Record<HullId, string> = {
  HULL_268: "bg-sky-100 text-sky-900 border-sky-200",
  HULL_269: "bg-emerald-100 text-emerald-900 border-emerald-200",
  HULL_270: "bg-amber-100 text-amber-900 border-amber-200",
};

export function HullBadge({ hull }: { hull: HullId }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${hullColors[hull]}`}
    >
      {HULL_LABELS[hull as HullValue]}
    </span>
  );
}

export function HullBadgeList({ hulls }: { hulls: { hull: HullId }[] }) {
  if (hulls.length === 0) {
    return (
      <span className="inline-flex rounded border border-[#d4dde6] px-2 py-0.5 text-xs text-[#495867]">
        Chantier commun
      </span>
    );
  }
  return (
    <span className="flex flex-wrap gap-1">
      {hulls.map(({ hull }) => (
        <HullBadge key={hull} hull={hull} />
      ))}
    </span>
  );
}

export function hullFilterValue(hull: HullId): string {
  return hullToShort(hull);
}
