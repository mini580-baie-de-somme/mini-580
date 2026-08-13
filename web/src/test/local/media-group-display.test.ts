import { describe, expect, it } from "vitest";
import {
  mediaGroupIdHint,
  resolveMediaGroupDisplayName,
} from "@/lib/media-group-display";

describe("media-group-display", () => {
  it("prefers localized title then slug", () => {
    expect(
      resolveMediaGroupDisplayName(
        { titleFr: "Mon groupe", titleEn: "My group", slug: "mon-groupe" },
        "fr",
        "clgroupabc123"
      )
    ).toBe("Mon groupe");

    expect(
      resolveMediaGroupDisplayName(
        { titleFr: "", titleEn: "", slug: "test-images" },
        "en",
        "clgroupabc123"
      )
    ).toBe("test-images");
  });

  it("uses short id hint helper", () => {
    expect(mediaGroupIdHint("clgroupabc123")).toBe("clgroupa");
  });
});
