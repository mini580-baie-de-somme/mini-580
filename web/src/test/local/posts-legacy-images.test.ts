import { describe, expect, it } from "vitest";
import { withLegacyImages } from "@/lib/posts";

describe("withLegacyImages", () => {
  it("includes cropAspectFormat on flattened images", () => {
    const post = {
      id: "p1",
      mediaLinks: [
        {
          postId: "p1",
          sortOrder: 0,
          isCover: true,
          media: {
            id: "m1",
            kind: "IMAGE",
            urlOrigin: "/media/m1/origin.jpg",
            urlPicto: null,
            urlPetite: null,
            urlMoyenne: "/media/m1/moyenne.webp",
            urlGrande: null,
            titleFr: "",
            titleEn: "",
            descriptionFr: "",
            descriptionEn: "",
            takenAt: null,
            offsetX: 0,
            offsetY: 0,
            scaleX: 1,
            scaleY: 1,
            lockAspect: true,
            cropShape: "RECT",
            backgroundColor: "#000",
            cropInset: 0.06,
            focusX: 0.5,
            focusY: 0.5,
            zoom: 1,
            rotation: 0,
            cropX: 0,
            cropY: 0,
            cropW: 1,
            cropH: 1,
            cropAspectFormat: "SQUARE",
          },
        },
      ],
    } as Parameters<typeof withLegacyImages>[0];

    const legacy = withLegacyImages(post);
    expect(legacy.images[0]?.cropAspectFormat).toBe("SQUARE");
    expect(legacy.images[0]?.isCover).toBe(true);
  });
});
