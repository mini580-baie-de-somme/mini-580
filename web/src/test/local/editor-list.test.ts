import { describe, expect, it } from "vitest";
import { countListFilters, isListFiltered } from "@/lib/editor-list";

const FILTER_KEYS = ["q", "status", "hull", "theme", "tag"];

describe("editor-list filters", () => {
  it("counts active filters excluding ALL status", () => {
    const params = new URLSearchParams("q=foo&status=PUBLISHED&hull=268");
    expect(countListFilters(params, FILTER_KEYS)).toBe(3);
    expect(isListFiltered(params, FILTER_KEYS)).toBe(true);
  });

  it("ignores empty or ALL values", () => {
    const params = new URLSearchParams("status=ALL&theme=");
    expect(countListFilters(params, FILTER_KEYS)).toBe(0);
    expect(isListFiltered(params, FILTER_KEYS)).toBe(false);
  });
});
