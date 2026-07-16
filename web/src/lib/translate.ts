import "server-only";

import { Agent } from "@cursor/sdk";
import { mkdirSync } from "fs";
import { z } from "zod";

const translateResponseSchema = z.object({
  titleEn: z.string().optional(),
  excerptEn: z.string().optional(),
  bodyEn: z.string().optional(),
  tags: z
    .array(z.object({ labelFr: z.string(), labelEn: z.string() }))
    .optional(),
  images: z
    .array(
      z.object({
        titleEn: z.string(),
        descriptionEn: z.string().optional(),
        captionEn: z.string().optional(),
      })
    )
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
  images: { titleFr: string; descriptionFr: string }[];
};

function getCursorApiKey(): string | null {
  const key = process.env.CURSOR_API_KEY?.trim();
  return key || null;
}

function getCursorModelId(): string {
  return process.env.CURSOR_MODEL?.trim() || "composer-2.5";
}

function getCursorCwd(): string {
  const cwd = process.env.CURSOR_CWD?.trim() || "/tmp/mini580-cursor";
  try {
    mkdirSync(cwd, { recursive: true });
  } catch {
    // ignore — Agent.prompt will surface a clearer error if cwd is unusable
  }
  return cwd;
}

export function isTranslationConfigured(): boolean {
  return Boolean(getCursorApiKey());
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const candidate = (fenced?.[1] ?? trimmed).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("Cursor agent did not return JSON");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

async function cursorJson(system: string, user: string): Promise<unknown> {
  const apiKey = getCursorApiKey();
  if (!apiKey) {
    throw new Error("CURSOR_API_KEY is not configured — translation unavailable");
  }

  const prompt = [
    system,
    "",
    "IMPORTANT:",
    "- Do not use tools, do not edit files, do not run shell commands.",
    "- Reply with a single JSON object only (no markdown, no commentary).",
    "",
    user,
  ].join("\n");

  const result = await Agent.prompt(prompt, {
    apiKey,
    model: { id: getCursorModelId() },
    name: "mini580-llm",
    local: { cwd: getCursorCwd() },
  });

  if (result.status === "error") {
    throw new Error(`Cursor agent run failed (${result.id})`);
  }

  const text = typeof result.result === "string" ? result.result : "";
  if (!text.trim()) {
    throw new Error("Empty Cursor agent response");
  }
  return extractJson(text);
}

export async function translateArticleToEn(input: TranslateArticleInput) {
  const raw = await cursorJson(
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
  if (input.images.length === 0) {
    return { images: [] as { titleEn: string; descriptionEn: string }[] };
  }

  const raw = await cursorJson(
    `Tu traduis titres et descriptions photo de blog nautique FR → EN.
Réponds UNIQUEMENT en JSON: { "images": [{ "titleEn", "descriptionEn" }] } dans le même ordre.`,
    JSON.stringify({
      images: input.images.map((img) => ({
        titleFr: img.titleFr,
        descriptionFr: img.descriptionFr,
      })),
    })
  );

  const parsed = translateResponseSchema.parse(raw);
  return {
    images: (parsed.images ?? []).map((img) => ({
      titleEn: img.titleEn ?? "",
      descriptionEn: img.descriptionEn ?? img.captionEn ?? "",
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
  if (!isTranslationConfigured()) {
    return heuristicParse(input.text, input.photoCount);
  }

  try {
    const raw = await cursorJson(
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
    field(/^titre\s*[:=]\s*/i) || lines[0] || "Nouvel article chantier";

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
      ? themesRaw
          .split(/[,;]/)
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      : [],
    tagLabelsFr: tagsRaw
      ? tagsRaw
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    milestoneSlug: jalon,
    imageTitlesFr: Array.from({ length: photoCount }, () => ""),
    imageCaptionsFr: Array.from({ length: photoCount }, () => ""),
  };
}
