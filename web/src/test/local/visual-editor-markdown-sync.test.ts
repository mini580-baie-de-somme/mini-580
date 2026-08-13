import { describe, expect, it } from "vitest";
import { shouldApplyParentMarkdownToVisualEditor } from "@/lib/visual-editor-markdown-sync";

describe("visual-editor-markdown-sync", () => {
  it("skips setContent when parent echoes the last local edit", () => {
    const localEdit = "Hello world";
    expect(
      shouldApplyParentMarkdownToVisualEditor(localEdit, localEdit)
    ).toBe(false);
  });

  it("applies setContent when markdown changes externally", () => {
    expect(
      shouldApplyParentMarkdownToVisualEditor("Hello", "Bonjour")
    ).toBe(true);
  });

  it("models the typing loop: local edit then parent echo does not resync", () => {
    let lastSynced = "Hello";
    expect(shouldApplyParentMarkdownToVisualEditor(lastSynced, "Hello")).toBe(
      false
    );

    const typed = "Hello!";
    lastSynced = typed;
    expect(shouldApplyParentMarkdownToVisualEditor(lastSynced, typed)).toBe(
      false
    );
  });
});
