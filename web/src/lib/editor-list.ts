import { EDITOR_LIST_PAGE_SIZE } from "@/lib/constants";

export type EditorListPage<T> = {
  items: T[];
  total: number;
  totalAll: number;
  limit: number;
  offset: number;
};

export function parseListPagination(searchParams: URLSearchParams): {
  limit: number;
  offset: number;
  q: string | undefined;
  paginated: boolean;
} {
  const hasLimit = searchParams.has("limit");
  const hasOffset = searchParams.has("offset");
  const q = searchParams.get("q")?.trim() || undefined;
  const paginated = hasLimit || hasOffset || Boolean(q);

  const limit = Math.min(
    100,
    Math.max(
      1,
      Number.parseInt(searchParams.get("limit") ?? String(EDITOR_LIST_PAGE_SIZE), 10) ||
        EDITOR_LIST_PAGE_SIZE
    )
  );
  const offset = Math.max(0, Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0);

  return { limit, offset, q, paginated };
}

export function isListFiltered(searchParams: URLSearchParams, filterKeys: string[]): boolean {
  return countListFilters(searchParams, filterKeys) > 0;
}

export function countListFilters(searchParams: URLSearchParams, filterKeys: string[]): number {
  let count = 0;
  for (const key of filterKeys) {
    const value = searchParams.get(key)?.trim();
    if (value && value !== "ALL") count += 1;
  }
  return count;
}
