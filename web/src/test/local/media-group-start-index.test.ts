import { describe, expect, it } from "vitest";
import { clampMediaGroupStartIndex } from "@/lib/media-group-start-index";

describe("clampMediaGroupStartIndex", () => {
  it("keeps a valid clicked index", () => {
    expect(clampMediaGroupStartIndex(2, 5)).toBe(2);
  });

  it("defaults empty groups and invalid values to 0", () => {
    expect(clampMediaGroupStartIndex(3, 0)).toBe(0);
    expect(clampMediaGroupStartIndex(Number.NaN, 4)).toBe(0);
    expect(clampMediaGroupStartIndex(-2, 4)).toBe(0);
  });

  it("clamps past the last member", () => {
    expect(clampMediaGroupStartIndex(9, 4)).toBe(3);
    expect(clampMediaGroupStartIndex(3.8, 4)).toBe(3);
  });
});
