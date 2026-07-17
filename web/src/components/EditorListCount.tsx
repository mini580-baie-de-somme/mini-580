"use client";

type Props = {
  total: number;
  totalAll: number;
  filtered: boolean;
  /** e.g. "{n} ligne(s)" */
  totalLabel: string;
  /** e.g. "{result} / {total} ligne(s)" */
  filteredLabel: string;
};

export function EditorListCount({
  total,
  totalAll,
  filtered,
  totalLabel,
  filteredLabel,
}: Props) {
  const text = filtered
    ? filteredLabel.replace("{result}", String(total)).replace("{total}", String(totalAll))
    : totalLabel.replace("{n}", String(totalAll));

  return <p className="mb-3 text-sm text-[#495867]">{text}</p>;
}
