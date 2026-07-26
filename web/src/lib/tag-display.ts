/** Public UI: prefix tag labels with # to distinguish them from themes. */
export function formatTagChipLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "#";
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}
