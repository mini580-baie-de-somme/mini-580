/** Query string for public blog list filters (`/blog?…`). */
export function blogListQueryString(filters: {
  hull?: string;
  theme?: string;
  tag?: string;
  search?: string;
}): string {
  const params = new URLSearchParams();
  const search = filters.search?.trim();
  if (search) params.set("search", search);
  if (filters.hull) params.set("hull", filters.hull);
  if (filters.theme) params.set("theme", filters.theme);
  if (filters.tag) params.set("tag", filters.tag);
  const q = params.toString();
  return q ? `?${q}` : "";
}

export function blogListPath(filters?: {
  hull?: string;
  theme?: string;
  tag?: string;
  search?: string;
}): string {
  return `/blog${blogListQueryString(filters ?? {})}`;
}
