import { describe, expect, it } from "vitest";
import {
  mediaLibraryFiltersFromParams,
  mediaLibraryListQueryString,
} from "@/lib/media-library-filters";

describe("mediaLibraryFiltersFromParams", () => {
  it("defaults to empty / ALL when params absent", () => {
    expect(mediaLibraryFiltersFromParams(new URLSearchParams())).toEqual({
      q: "",
      kind: "ALL",
      visibility: "ALL",
      groupFilterId: "",
    });
  });

  it("reads list filters and ignores virtual overlay keys", () => {
    const params = new URLSearchParams(
      "q=boat&kind=IMAGE&visibility=orphan&groupId=grp-1&media=m-1&group=grp-2"
    );
    expect(mediaLibraryFiltersFromParams(params)).toEqual({
      q: "boat",
      kind: "IMAGE",
      visibility: "orphan",
      groupFilterId: "grp-1",
    });
  });
});

describe("mediaLibraryListQueryString", () => {
  it("builds API query without virtual overlay params", () => {
    const params = new URLSearchParams(
      "groupId=grp-1&group=grp-2&media=new&q=alpha"
    );
    expect(mediaLibraryListQueryString(params)).toBe(
      "q=alpha&groupId=grp-1"
    );
  });

  it("omits groupId when filter cleared", () => {
    const params = new URLSearchParams("kind=VIDEO&group=grp-2");
    expect(mediaLibraryListQueryString(params)).toBe("kind=VIDEO");
  });
});
