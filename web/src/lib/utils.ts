export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
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
