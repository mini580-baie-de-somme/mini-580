import { describe, expect, it } from "vitest";
import { formatTagChipLabel } from "@/lib/tag-display";

describe("formatTagChipLabel", () => {
  it("prefixes labels with #", () => {
    expect(formatTagChipLabel("Okoumé")).toBe("#Okoumé");
  });

  it("does not double-prefix", () => {
    expect(formatTagChipLabel("#Okoumé")).toBe("#Okoumé");
  });

  it("trims whitespace", () => {
    expect(formatTagChipLabel("  charpente  ")).toBe("#charpente");
  });
});
