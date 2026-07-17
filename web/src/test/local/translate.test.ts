import { beforeAll, describe, expect, it } from "vitest";
import {
  isTranslationConfigured,
  translateArticleToEn,
  translateImagesToEn,
} from "@/lib/translate";

describe("Cursor IA translation (real CURSOR_API_KEY)", () => {
  beforeAll(() => {
    if (!isTranslationConfigured()) {
      throw new Error(
        "CURSOR_API_KEY required. Set web/.env.cursor.local or /tmp/mini580-cursor.env"
      );
    }
  });

  it("translates article FR → EN", async () => {
    const result = await translateArticleToEn({
      titleFr: "Assemblage du couple n°4",
      excerptFr: "Avancement chantier Baie de Somme",
      bodyFr:
        "Nous avons posé le couple n°4 sur la coque #268. Le travail avance bien.",
      newTags: [{ labelFr: "Charpente" }],
    });

    expect(result.titleEn?.trim().length).toBeGreaterThan(0);
    expect(result.bodyEn?.trim().length).toBeGreaterThan(0);
    expect(result.titleEn).not.toBe("Assemblage du couple n°4");
    // Hull numbers must stay
    expect(`${result.bodyEn}`).toMatch(/#?268/);
    if (result.tags?.length) {
      expect(result.tags[0].labelEn.trim().length).toBeGreaterThan(0);
    }
  }, 180_000);

  it("translates image metas FR → EN", async () => {
    const result = await translateImagesToEn({
      images: [
        {
          titleFr: "Vue latérale bâbord",
          descriptionFr: "Couple en place avant collage",
        },
      ],
    });

    expect(result.images.length).toBe(1);
    expect(result.images[0].titleEn.trim().length).toBeGreaterThan(0);
    expect(result.images[0].titleEn).not.toBe("Vue latérale bâbord");
  }, 180_000);
});
