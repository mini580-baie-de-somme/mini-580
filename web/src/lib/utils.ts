export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Format a Date/ISO string for `<input type="datetime-local">` (local timezone). */
export function toDatetimeLocalValue(
  value: string | Date | null | undefined
): string {
  if (value == null || value === "") return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parse datetime-local / ISO / offset string to ISO-Z, or null if empty. */
export function fromDatetimeLocalValue(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Coerce API date inputs (ISO-Z, offset, datetime-local, empty) to ISO-Z or null.
 * Returns undefined when the field was omitted.
 */
export function coerceDateTimeInput(
  value: unknown
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === "string") {
    const d = new Date(value.trim());
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }
  return null;
}

export function parseHull(value: string): "HULL_268" | "HULL_269" | "HULL_270" | null {
  if (value === "268" || value === "HULL_268") return "HULL_268";
  if (value === "269" || value === "HULL_269") return "HULL_269";
  if (value === "270" || value === "HULL_270") return "HULL_270";
  return null;
}

export function hullToShort(hull: string): string {
  return hull.replace("HULL_", "");
}
