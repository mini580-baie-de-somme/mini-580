import "server-only";

import { z } from "zod";

const translateResponseSchema = z.object({
  titleEn: z.string().optional(),
  excerptEn: z.string().optional(),
  bodyEn: z.string().optional(),
  tags: z
    .array(z.object({ labelFr: z.string(), labelEn: z.string() }))
    .optional(),
  images: z
    .array(z.object({ titleEn: z.string(), captionEn: z.string() }))
    .optional(),
});

export type TranslateArticleInput = {
  titleFr: string;
  excerptFr?: string;
  bodyFr: string;
  /** New tags that need an English label */
  newTags?: { labelFr: string }[];
};

export type TranslateImagesInput = {
  images: { titleFr: string; captionFr: string }[];
};

function getOpenAiConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(
      /\/$/,
      ""
    ),
    model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
  };
}

async function chatJson(system: string, user: string): Promise<unknown> {
  const config = getOpenAiConfig();
  if (!config) {
    throw new Error(
      "OPENAI_API_KEY is not configured — translation unavailable"
    );
  }

  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Translation API error (${res.status}): ${text.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty translation response");
  return JSON.parse(content);
}

export function isTranslationConfigured(): boolean {
  return Boolean(getOpenAiConfig());
}

export async function translateArticleToEn(input: TranslateArticleInput) {
  const raw = await chatJson(
    `Tu traduis du contenu de blog nautique Class Mini 5.80 FR → EN.
Réponds UNIQUEMENT en JSON avec les clés demandées.
Garde un ton clair, factuel, adapté à un chantier naval amateur.
Ne traduis pas les numéros de coque (#268, #269, #270) ni les noms propres.`,
    JSON.stringify({
      titleFr: input.titleFr,
      excerptFr: input.excerptFr ?? "",
      bodyFr: input.bodyFr,
      newTags: input.newTags ?? [],
      expectedKeys: {
        titleEn: "string",
        excerptEn: "string",
        bodyEn: "string",
        tags: "[{labelFr, labelEn}] only for newTags",
      },
    })
  );

  return translateResponseSchema.parse(raw);
}

export async function translateImagesToEn(input: TranslateImagesInput) {
  if (input.images.length === 0) return { images: [] as { titleEn: string; captionEn: string }[] };

  const raw = await chatJson(
    `Tu traduis titres et légendes photo de blog nautique FR → EN.
Réponds UNIQUEMENT en JSON: { "images": [{ "titleEn", "captionEn" }] } dans le même ordre.`,
    JSON.stringify({ images: input.images })
  );

  const parsed = translateResponseSchema.parse(raw);
  return {
    images: (parsed.images ?? []).map((img) => ({
      titleEn: img.titleEn,
      captionEn: img.captionEn,
    })),
  };
}

export type ParsedDraftContent = {
  titleFr: string;
  excerptFr: string;
  bodyFr: string;
  publishedAt: string | null;
  hulls: ("HULL_268" | "HULL_269" | "HULL_270")[];
  themeSlugs: string[];
  tagLabelsFr: string[];
  milestoneSlug: string | null;
  imageTitlesFr: string[];
  imageCaptionsFr: string[];
};

export async function parseTelegramDraftWithAi(input: {
  text: string;
  photoCount: number;
  knownThemes: { slug: string; labelFr: string }[];
  knownTags: { name: string; labelFr: string }[];
  knownMilestones: { slug: string; titleFr: string }[];
}): Promise<ParsedDraftContent> {
  const config = getOpenAiConfig();
  if (!config) {
    return heuristicParse(input.text, input.photoCount);
  }

  try {
    const raw = await chatJson(
      `Tu extrais un brouillon d'article de blog Class Mini 5.80 depuis un message Telegram (FR).
Réponds UNIQUEMENT en JSON avec:
titleFr, excerptFr, bodyFr, publishedAt (ISO date ou null),
hulls (HULL_268|HULL_269|HULL_270[]),
themeSlugs (parmi les thèmes connus si possible),
tagLabelsFr (libellés FR, existants ou nouveaux),
milestoneSlug (slug connu ou null),
imageTitlesFr[], imageCaptionsFr[] (longueur = photoCount, sinon tableaux vides).`,
      JSON.stringify(input)
    );

    const schema = z.object({
      titleFr: z.string().min(1),
      excerptFr: z.string().optional().default(""),
      bodyFr: z.string().optional().default(""),
      publishedAt: z.string().nullable().optional().default(null),
      hulls: z
        .array(z.enum(["HULL_268", "HULL_269", "HULL_270"]))
        .optional()
        .default([]),
      themeSlugs: z.array(z.string()).optional().default([]),
      tagLabelsFr: z.array(z.string()).optional().default([]),
      milestoneSlug: z.string().nullable().optional().default(null),
      imageTitlesFr: z.array(z.string()).optional().default([]),
      imageCaptionsFr: z.array(z.string()).optional().default([]),
    });

    return schema.parse(raw);
  } catch {
    return heuristicParse(input.text, input.photoCount);
  }
}

function heuristicParse(text: string, photoCount: number): ParsedDraftContent {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const field = (re: RegExp) => {
    const line = lines.find((l) => re.test(l));
    if (!line) return null;
    return line.replace(re, "").trim() || null;
  };

  const titleFr =
    field(/^titre\s*[:=]\s*/i) ||
    lines[0] ||
    "Nouvel article chantier";

  const bodyStart = lines.findIndex((l) => /^---+/.test(l));
  const bodyFr =
    bodyStart >= 0
      ? lines.slice(bodyStart + 1).join("\n")
      : lines.slice(1).join("\n");

  const hulls: ParsedDraftContent["hulls"] = [];
  for (const n of ["268", "269", "270"] as const) {
    if (new RegExp(`#?${n}\\b`).test(text)) {
      hulls.push(`HULL_${n}`);
    }
  }

  const tagsRaw = field(/^tags?\s*[:=]\s*/i);
  const themesRaw = field(/^th[eè]mes?\s*[:=]\s*/i);
  const jalon = field(/^jalons?\s*[:=]\s*/i);
  const dateRaw = field(/^dates?\s*[:=]\s*/i);

  return {
    titleFr,
    excerptFr: "",
    bodyFr,
    publishedAt: dateRaw,
    hulls,
    themeSlugs: themesRaw
      ? themesRaw.split(/[,;]/).map((s) => s.trim().toLowerCase()).filter(Boolean)
      : [],
    tagLabelsFr: tagsRaw
      ? tagsRaw.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
      : [],
    milestoneSlug: jalon,
    imageTitlesFr: Array.from({ length: photoCount }, () => ""),
    imageCaptionsFr: Array.from({ length: photoCount }, () => ""),
  };
}
