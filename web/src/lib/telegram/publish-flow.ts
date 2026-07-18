import "server-only";

import { randomBytes } from "crypto";
import { Hull, Prisma, TelegramSessionStep } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { postInclude, syncPostRelations, uniqueSlug, withLegacyImages } from "@/lib/posts";
import { slugify } from "@/lib/utils";
import {
  isTranslationConfigured,
  parseTelegramDraftWithAi,
  translateArticleToEn,
  translateImagesToEn,
} from "@/lib/translate";

export type DraftMediaItem = {
  urlOrigin: string;
  urlPicto: string;
  urlPetite: string;
  urlMoyenne: string;
  urlGrande: string;
};

export type DraftPayload = {
  textParts: string[];
  /** @deprecated use mediaItems; kept as origin URLs for cover */
  mediaUrls: string[];
  mediaItems: DraftMediaItem[];
};

export type InlineButton = { text: string; callback_data: string };

export type BotReply = {
  text: string;
  buttons?: InlineButton[][] ;
  disableWebPagePreview?: boolean;
};

const ACTIVE_STEPS: TelegramSessionStep[] = [
  "AWAITING_CONTENT",
  "REVIEW_FR",
  "REVIEW_EN",
  "REVIEW_PREVIEW",
  "REVIEW_PHOTO_ORDER",
  "REVIEW_PHOTO_META_FR",
  "REVIEW_PHOTO_META_EN",
  "READY",
];

function siteBaseUrl(): string {
  return (
    process.env.SITE_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:3002"
  );
}

function approveKeyboard(prefix = "ok"): InlineButton[][] {
  return [
    [
      { text: "✅ Valider", callback_data: `${prefix}:approve` },
      { text: "✏️ Modifier", callback_data: `${prefix}:edit` },
    ],
    [{ text: "❌ Annuler", callback_data: "session:cancel" }],
  ];
}

function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return "(non définie)";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function truncate(text: string, max = 1200): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

export async function getActiveSession(telegramUserId: string, telegramChatId: string) {
  return prisma.telegramPublishSession.findFirst({
    where: {
      telegramUserId,
      telegramChatId,
      step: { in: ACTIVE_STEPS },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      post: { include: postInclude },
    },
  });
}

export async function startSession(
  telegramUserId: string,
  telegramChatId: string
): Promise<BotReply> {
  const existing = await getActiveSession(telegramUserId, telegramChatId);
  if (existing) {
    await prisma.telegramPublishSession.update({
      where: { id: existing.id },
      data: { step: "CANCELLED" },
    });
  }

  const authorId = await resolveServiceAuthorId();
  const post = await prisma.post.create({
    data: {
      slug: await uniqueSlug("brouillon-telegram"),
      titleFr: "Brouillon Telegram",
      titleEn: "Telegram draft",
      authorId,
      status: "DRAFT",
    },
  });

  await prisma.telegramPublishSession.create({
    data: {
      telegramUserId,
      telegramChatId,
      step: "AWAITING_CONTENT",
      postId: post.id,
      draftPayload: { textParts: [], mediaUrls: [], mediaItems: [] } satisfies DraftPayload,
    },
  });

  return {
    text: [
      "📝 *Nouveau post Telegram*",
      "",
      `Brouillon créé (\`${post.id}\`) — les photos et le texte seront liés tout de suite.`,
      "",
      "Envoie (dans n'importe quel ordre) :",
      "• photos (album ou une par une)",
      "• texte / titre / tags / jalon",
      "",
      "Format libre, ou structuré :",
      "`Titre: …`",
      "`Date: 2026-07-16`",
      "`Thèmes: chantier`",
      "`Tags: époxy, couples`",
      "`Jalon: pose-couples`",
      "`---`",
      "`corps de l'article…`",
      "",
      "Quand c'est prêt → *Terminer la saisie*.",
    ].join("\n"),
    buttons: [
      [{ text: "✅ Terminer la saisie", callback_data: "content:done" }],
      [{ text: "❌ Annuler", callback_data: "session:cancel" }],
    ],
  };
}

function asDraftPayload(raw: Prisma.JsonValue | null | undefined): DraftPayload {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { textParts: [], mediaUrls: [], mediaItems: [] };
  }
  const obj = raw as Record<string, unknown>;
  const mediaUrls = Array.isArray(obj.mediaUrls)
    ? obj.mediaUrls.filter((t): t is string => typeof t === "string")
    : [];
  const mediaItems: DraftMediaItem[] = Array.isArray(obj.mediaItems)
    ? obj.mediaItems
        .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
        .map((m) => ({
          urlOrigin: String(m.urlOrigin ?? ""),
          urlPicto: String(m.urlPicto ?? ""),
          urlPetite: String(m.urlPetite ?? ""),
          urlMoyenne: String(m.urlMoyenne ?? m.urlOrigin ?? ""),
          urlGrande: String(m.urlGrande ?? ""),
        }))
        .filter((m) => m.urlOrigin)
    : mediaUrls.map((urlOrigin) => ({
        urlOrigin,
        urlPicto: "",
        urlPetite: "",
        urlMoyenne: urlOrigin,
        urlGrande: "",
      }));
  return {
    textParts: Array.isArray(obj.textParts)
      ? obj.textParts.filter((t): t is string => typeof t === "string")
      : [],
    mediaUrls:
      mediaUrls.length > 0 ? mediaUrls : mediaItems.map((m) => m.urlOrigin),
    mediaItems,
  };
}

export async function appendContent(
  sessionId: string,
  patch: { text?: string; mediaUrl?: string; mediaItem?: DraftMediaItem }
): Promise<BotReply> {
  const session = await prisma.telegramPublishSession.findUnique({
    where: { id: sessionId },
  });
  if (!session || session.step !== "AWAITING_CONTENT") {
    return { text: "Aucune saisie en cours. Envoie /nouveau pour commencer." };
  }

  const draft = asDraftPayload(session.draftPayload);
  if (patch.text?.trim()) draft.textParts.push(patch.text.trim());

  let mediaItem = patch.mediaItem;
  if (!mediaItem && patch.mediaUrl) {
    mediaItem = {
      urlOrigin: patch.mediaUrl,
      urlPicto: "",
      urlPetite: "",
      urlMoyenne: patch.mediaUrl,
      urlGrande: "",
    };
  }

  if (mediaItem) {
    draft.mediaItems.push(mediaItem);
    draft.mediaUrls.push(mediaItem.urlOrigin);

    if (session.postId) {
      const media = await prisma.media.create({
        data: {
          kind: "IMAGE",
          mimeType: "image/jpeg",
          urlOrigin: mediaItem.urlOrigin,
          urlPicto: mediaItem.urlPicto || null,
          urlPetite: mediaItem.urlPetite || null,
          urlMoyenne: mediaItem.urlMoyenne || mediaItem.urlOrigin,
          urlGrande: mediaItem.urlGrande || null,
        },
      });
      const max = await prisma.postMedia.aggregate({
        where: { postId: session.postId },
        _max: { sortOrder: true },
      });
      await prisma.postMedia.create({
        data: {
          postId: session.postId,
          mediaId: media.id,
          sortOrder: (max._max.sortOrder ?? -1) + 1,
          isCover: draft.mediaItems.length === 1,
        },
      });
      if (draft.mediaItems.length === 1) {
        await prisma.post.update({
          where: { id: session.postId },
          data: { coverImageUrl: mediaItem.urlOrigin },
        });
      }
    }
  }

  await prisma.telegramPublishSession.update({
    where: { id: sessionId },
    data: { draftPayload: draft as unknown as Prisma.InputJsonValue },
  });

  return {
    text: `Reçu — ${draft.mediaItems.length} photo(s), ${draft.textParts.length} message(s) texte.\nAppuie sur *Terminer la saisie* quand tu as fini.`,
    buttons: [
      [{ text: "✅ Terminer la saisie", callback_data: "content:done" }],
      [{ text: "❌ Annuler", callback_data: "session:cancel" }],
    ],
  };
}

async function resolveServiceAuthorId(): Promise<string> {
  const email =
    process.env.TELEGRAM_SERVICE_USER_EMAIL?.trim().toLowerCase() ||
    process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() ||
    "admin@classmini580.blog";
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`Service user not found: ${email}`);
  return user.id;
}

async function ensureTags(labelsFr: string[]) {
  const tagIds: string[] = [];
  const created: { labelFr: string; labelEn: string; isNew: boolean }[] = [];

  for (const labelFr of labelsFr) {
    const name = slugify(labelFr) || `tag-${randomBytes(3).toString("hex")}`;
    const existing = await prisma.tag.findFirst({
      where: {
        OR: [
          { name },
          { labelFr: { equals: labelFr, mode: "insensitive" } },
        ],
      },
    });
    if (existing) {
      tagIds.push(existing.id);
      created.push({
        labelFr: existing.labelFr,
        labelEn: existing.labelEn,
        isNew: false,
      });
    } else {
      const tag = await prisma.tag.create({
        data: { name, labelFr, labelEn: labelFr },
      });
      tagIds.push(tag.id);
      created.push({ labelFr, labelEn: labelFr, isNew: true });
    }
  }
  return { tagIds, tags: created };
}

export async function finalizeContentCollection(
  sessionId: string
): Promise<BotReply> {
  const session = await prisma.telegramPublishSession.findUnique({
    where: { id: sessionId },
  });
  if (!session || session.step !== "AWAITING_CONTENT") {
    return { text: "Saisie déjà terminée ou session invalide." };
  }

  const draft = asDraftPayload(session.draftPayload);
  if (draft.textParts.length === 0 && draft.mediaUrls.length === 0) {
    return {
      text: "Rien à publier pour l'instant — envoie du texte et/ou des photos.",
      buttons: [
        [{ text: "✅ Terminer la saisie", callback_data: "content:done" }],
        [{ text: "❌ Annuler", callback_data: "session:cancel" }],
      ],
    };
  }

  const [themes, tags, milestones] = await Promise.all([
    prisma.theme.findMany(),
    prisma.tag.findMany(),
    prisma.milestone.findMany({
      orderBy: [{ milestoneDate: "asc" }, { titleFr: "asc" }],
    }),
  ]);

  const parsed = await parseTelegramDraftWithAi({
    text: draft.textParts.join("\n\n"),
    photoCount: draft.mediaUrls.length,
    knownThemes: themes.map((t) => ({ slug: t.slug, labelFr: t.labelFr })),
    knownTags: tags.map((t) => ({ name: t.name, labelFr: t.labelFr })),
    knownMilestones: milestones.map((m) => ({
      slug: m.slug,
      titleFr: m.titleFr,
    })),
  });

  const themeIds = themes
    .filter(
      (t) =>
        parsed.themeSlugs.includes(t.slug) ||
        parsed.themeSlugs.some(
          (s) =>
            s === t.labelFr.toLowerCase() ||
            s === slugify(t.labelFr)
        )
    )
    .map((t) => t.id);

  let milestoneIds: string[] = [];
  if (parsed.milestoneSlug) {
    const m =
      milestones.find((x) => x.slug === parsed.milestoneSlug) ||
      milestones.find(
        (x) =>
          slugify(x.titleFr) === slugify(parsed.milestoneSlug!) ||
          x.titleFr.toLowerCase().includes(parsed.milestoneSlug!.toLowerCase())
      );
    if (m) milestoneIds = [m.id];
  }

  const { tagIds, tags: tagMeta } = await ensureTags(parsed.tagLabelsFr);
  const slug = await uniqueSlug(parsed.titleFr, session.postId ?? undefined);

  let publishedAt: Date | null = null;
  if (parsed.publishedAt) {
    const d = new Date(parsed.publishedAt);
    if (!Number.isNaN(d.getTime())) publishedAt = d;
  }

  let postId = session.postId;
  if (!postId) {
    const authorId = await resolveServiceAuthorId();
    const created = await prisma.post.create({
      data: {
        slug,
        titleFr: parsed.titleFr,
        titleEn: parsed.titleFr,
        excerptFr: parsed.excerptFr,
        excerptEn: "",
        bodyFr: parsed.bodyFr,
        bodyEn: "",
        coverImageUrl: draft.mediaUrls[0] ?? null,
        publishedAt,
        authorId,
        status: "DRAFT",
      },
    });
    postId = created.id;
  } else {
    await prisma.post.update({
      where: { id: postId },
      data: {
        slug,
        titleFr: parsed.titleFr,
        titleEn: parsed.titleFr,
        excerptFr: parsed.excerptFr,
        excerptEn: "",
        bodyFr: parsed.bodyFr,
        bodyEn: "",
        coverImageUrl: draft.mediaUrls[0] ?? null,
        publishedAt,
      },
    });
  }

  await syncPostRelations(postId, {
    hulls: parsed.hulls as Hull[],
    tagIds,
    themeIds,
    milestoneIds,
  });

  // Images are already linked during appendContent when postId exists.
  // Backfill titles/captions from AI parse onto existing rows.
  const existingLinks = await prisma.postMedia.findMany({
    where: { postId },
    include: { media: true },
    orderBy: { sortOrder: "asc" },
  });

  if (existingLinks.length === 0 && draft.mediaItems.length) {
    for (let i = 0; i < draft.mediaItems.length; i++) {
      const item = draft.mediaItems[i]!;
      const media = await prisma.media.create({
        data: {
          kind: "IMAGE",
          mimeType: "image/jpeg",
          urlOrigin: item.urlOrigin,
          urlPicto: item.urlPicto || null,
          urlPetite: item.urlPetite || null,
          urlMoyenne: item.urlMoyenne || item.urlOrigin,
          urlGrande: item.urlGrande || null,
          titleFr: parsed.imageTitlesFr[i] ?? "",
          titleEn: "",
          descriptionFr: parsed.imageCaptionsFr[i] ?? "",
          descriptionEn: "",
          takenAt: publishedAt,
        },
      });
      await prisma.postMedia.create({
        data: {
          postId,
          mediaId: media.id,
          sortOrder: i,
          isCover: i === 0,
        },
      });
    }
  } else {
    for (let i = 0; i < existingLinks.length; i++) {
      const link = existingLinks[i]!;
      await prisma.media.update({
        where: { id: link.mediaId },
        data: {
          titleFr: parsed.imageTitlesFr[i] ?? link.media.titleFr,
          descriptionFr:
            parsed.imageCaptionsFr[i] ?? link.media.descriptionFr,
          takenAt: publishedAt ?? link.media.takenAt,
        },
      });
    }
  }

  await prisma.telegramPublishSession.update({
    where: { id: sessionId },
    data: {
      postId,
      step: "REVIEW_FR",
      photoIndex: 0,
      draftPayload: { ...draft, tagMeta } as unknown as Prisma.InputJsonValue,
    },
  });

  return formatFrReview(postId);
}


async function loadSession(sessionId: string) {
  const session = await prisma.telegramPublishSession.findUnique({
    where: { id: sessionId },
    include: { post: { include: postInclude } },
  });
  if (!session) return null;
  return {
    ...session,
    post: session.post ? withLegacyImages(session.post) : null,
  };
}

async function loadPost(postId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: postInclude,
  });
  if (!post) throw new Error("Post not found");
  return withLegacyImages(post);
}

export async function formatFrReview(postId: string): Promise<BotReply> {
  const post = await loadPost(postId);
  const themes = post.themes.map((t) => t.theme.labelFr).join(", ") || "(aucun)";
  const tags = post.tags
    .map((t) => `${t.tag.labelFr}${t.tag.labelEn === t.tag.labelFr ? " [nouveau]" : ""}`)
    .join(", ") || "(aucun)";
  const jalon =
    post.milestones.map((m) => m.milestone.titleFr).join(", ") || "(aucun)";

  return {
    text: [
      "📋 *Confirmation demande (FR)*",
      "",
      `*Titre :* ${post.titleFr}`,
      `*Date de publication :* ${formatDate(post.publishedAt)}`,
      `*Texte :*\n${truncate(post.bodyFr || "(vide)")}`,
      `*Thèmes :* ${themes}`,
      `*Tags :* ${tags}`,
      `*Jalon timeline :* ${jalon}`,
      `*Photos :* ${post.images.length}`,
      "",
      "Valide ou demande des changements.",
    ].join("\n"),
    buttons: approveKeyboard("fr"),
  };
}

export async function formatEnReview(postId: string): Promise<BotReply> {
  const post = await loadPost(postId);
  const themes = post.themes.map((t) => t.theme.labelEn).join(", ") || "(none)";
  const tags = post.tags.map((t) => t.tag.labelEn).join(", ") || "(none)";
  const jalon =
    post.milestones.map((m) => m.milestone.titleEn).join(", ") || "(none)";

  return {
    text: [
      "🇬🇧 *Confirmation traduction (EN)*",
      "",
      `*Title :* ${post.titleEn}`,
      `*Publish date :* ${formatDate(post.publishedAt)}`,
      `*Body :*\n${truncate(post.bodyEn || "(empty)")}`,
      `*Themes :* ${themes}`,
      `*Tags :* ${tags}`,
      `*Timeline milestone :* ${jalon}`,
      "",
      "Valide la traduction ou demande des changements.",
    ].join("\n"),
    buttons: approveKeyboard("en"),
  };
}

export async function createPreviewLink(postId: string): Promise<string> {
  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 72); // 72h
  await prisma.previewToken.create({
    data: { token, postId, expiresAt },
  });
  return `${siteBaseUrl()}/apercu/t/${token}`;
}

export async function formatPreviewReview(postId: string): Promise<BotReply> {
  const post = await loadPost(postId);
  const url = await createPreviewLink(postId);
  return {
    text: [
      "🔗 *Lien de prévisualisation*",
      "",
      `Titre : ${post.titleFr}`,
      `Date : ${formatDate(post.publishedAt)}`,
      `Description : ${truncate(post.excerptFr || post.bodyFr, 280)}`,
      `Photos : ${post.images.length}`,
      "",
      url,
      "",
      "Valide l'aperçu ou demande des changements (ordre des photos ensuite).",
    ].join("\n"),
    buttons: approveKeyboard("preview"),
    disableWebPagePreview: false,
  };
}

export async function formatPhotoOrderReview(postId: string): Promise<BotReply> {
  const post = await loadPost(postId);
  const list =
    post.images
      .map(
        (img, i) =>
          `${i + 1}. ${img.titleFr || "(sans titre)"} — ${truncate(img.descriptionFr || img.urlOrigin, 60)}`
      )
      .join("\n") || "(aucune photo)";

  return {
    text: [
      "🖼️ *Ordre des photos*",
      "",
      list,
      "",
      "Valide l'ordre, ou envoie `ordre: 3,1,2` pour réordonner.",
    ].join("\n"),
    buttons: approveKeyboard("order"),
  };
}

function formatTransform(img: {
  focusX: number;
  focusY: number;
  zoom: number;
  rotation: number;
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
}): string {
  return [
    `centrage=${img.focusX.toFixed(2)},${img.focusY.toFixed(2)}`,
    `zoom=${img.zoom}`,
    `rotation=${img.rotation}°`,
    `crop=${img.cropX.toFixed(2)},${img.cropY.toFixed(2)},${img.cropW.toFixed(2)}×${img.cropH.toFixed(2)}`,
  ].join(" · ");
}

export async function formatPhotoMetaFrReview(
  postId: string,
  photoIndex: number
): Promise<BotReply> {
  const post = await loadPost(postId);
  const img = post.images[photoIndex];
  if (!img) {
    return { text: "Plus de photos à valider (FR)." };
  }

  return {
    text: [
      `📷 *Photo ${photoIndex + 1}/${post.images.length} (FR)*`,
      "",
      `*Titre :* ${img.titleFr || "(vide)"}`,
      `*Description :* ${img.descriptionFr || "(vide)"}`,
      `*Date :* ${formatDate(img.takenAt)}`,
      `*Transform :* ${formatTransform(img)}`,
      "",
      "Valide, ou envoie par ex. :",
      "`titre: …`",
      "`description: …`",
      "`date: 2026-07-16`",
      "`centrage: 0.5,0.4`",
      "`zoom: 1.2`",
      "`rotation: 90`",
      "`crop: 0,0,1,1`",
    ].join("\n"),
    buttons: approveKeyboard("photofr"),
  };
}

export async function formatPhotoMetaEnReview(
  postId: string,
  photoIndex: number
): Promise<BotReply> {
  const post = await loadPost(postId);
  const img = post.images[photoIndex];
  if (!img) {
    return { text: "Plus de photos à valider (EN)." };
  }

  return {
    text: [
      `🇬🇧 *Photo ${photoIndex + 1}/${post.images.length} (EN)*`,
      "",
      `*Title :* ${img.titleEn || "(empty)"}`,
      `*Description :* ${img.descriptionEn || "(empty)"}`,
      "",
      "Valide, ou envoie `title: …` / `description: …`.",
    ].join("\n"),
    buttons: approveKeyboard("photoen"),
  };
}

export async function runArticleTranslation(postId: string): Promise<BotReply> {
  if (!isTranslationConfigured()) {
    return {
      text: "⚠️ Traduction IA indisponible (CURSOR_API_KEY manquant). Remplis titleEn/bodyEn via l'éditeur web, ou configure la clé puis renvoie /traduire.",
      buttons: approveKeyboard("en"),
    };
  }

  const post = await loadPost(postId);
  const newTags = post.tags
    .filter((t) => t.tag.labelEn === t.tag.labelFr)
    .map((t) => ({ id: t.tag.id, labelFr: t.tag.labelFr }));

  const translated = await translateArticleToEn({
    titleFr: post.titleFr,
    excerptFr: post.excerptFr,
    bodyFr: post.bodyFr,
    newTags: newTags.map((t) => ({ labelFr: t.labelFr })),
  });

  await prisma.post.update({
    where: { id: postId },
    data: {
      titleEn: translated.titleEn || post.titleFr,
      excerptEn: translated.excerptEn ?? post.excerptFr,
      bodyEn: translated.bodyEn || post.bodyFr,
    },
  });

  if (translated.tags?.length) {
    for (const t of translated.tags) {
      const match = newTags.find(
        (n) => n.labelFr.toLowerCase() === t.labelFr.toLowerCase()
      );
      if (match) {
        await prisma.tag.update({
          where: { id: match.id },
          data: { labelEn: t.labelEn },
        });
      }
    }
  }

  await prisma.telegramPublishSession.updateMany({
    where: { postId, step: { in: ACTIVE_STEPS } },
    data: { step: "REVIEW_EN" },
  });

  return formatEnReview(postId);
}

export async function runImagesTranslation(postId: string): Promise<void> {
  if (!isTranslationConfigured()) return;
  const post = await loadPost(postId);
  const result = await translateImagesToEn({
    images: post.images.map((img) => ({
      titleFr: img.titleFr,
      descriptionFr: img.descriptionFr,
    })),
  });

  for (let i = 0; i < post.images.length; i++) {
    const tr = result.images[i];
    if (!tr) continue;
    await prisma.media.update({
      where: { id: post.images[i].id },
      data: {
        titleEn: tr.titleEn || post.images[i].titleFr,
        descriptionEn: tr.descriptionEn || post.images[i].descriptionFr,
      },
    });
  }
}

async function setStep(
  sessionId: string,
  step: TelegramSessionStep,
  photoIndex?: number
) {
  await prisma.telegramPublishSession.update({
    where: { id: sessionId },
    data: {
      step,
      ...(photoIndex !== undefined ? { photoIndex } : {}),
    },
  });
}

export async function handleCallback(
  sessionId: string,
  data: string
): Promise<BotReply> {
  const session = await loadSession(sessionId);
  if (!session) return { text: "Session introuvable." };

  if (data === "session:cancel") {
    await setStep(sessionId, "CANCELLED");
    return { text: "❌ Session annulée." };
  }

  if (data === "content:done") {
    return finalizeContentCollection(sessionId);
  }

  if (!session.postId || !session.post) {
    return { text: "Brouillon pas encore créé." };
  }

  const [scope, action] = data.split(":");

  if (action === "edit") {
    return {
      text: [
        "✏️ Envoie tes modifications en texte libre.",
        "Exemples : `titre: …`, `texte: …`, `date: 2026-07-16`, `tags: a, b`, `jalon: …`",
        "Pour les photos : `ordre: 2,1,3` ou champs titre/description/zoom…",
      ].join("\n"),
    };
  }

  if (action !== "approve") {
    return { text: "Action inconnue." };
  }

  switch (scope) {
    case "fr": {
      const reply = await runArticleTranslation(session.postId);
      await setStep(sessionId, "REVIEW_EN");
      return reply;
    }
    case "en": {
      await setStep(sessionId, "REVIEW_PREVIEW");
      return formatPreviewReview(session.postId);
    }
    case "preview": {
      if (session.post.images.length === 0) {
        await setStep(sessionId, "READY");
        return readyReply(session.postId);
      }
      await setStep(sessionId, "REVIEW_PHOTO_ORDER");
      return formatPhotoOrderReview(session.postId);
    }
    case "order": {
      await setStep(sessionId, "REVIEW_PHOTO_META_FR", 0);
      return formatPhotoMetaFrReview(session.postId, 0);
    }
    case "photofr": {
      const next = session.photoIndex + 1;
      if (next < session.post.images.length) {
        await setStep(sessionId, "REVIEW_PHOTO_META_FR", next);
        return formatPhotoMetaFrReview(session.postId, next);
      }
      await runImagesTranslation(session.postId);
      await setStep(sessionId, "REVIEW_PHOTO_META_EN", 0);
      return formatPhotoMetaEnReview(session.postId, 0);
    }
    case "photoen": {
      const next = session.photoIndex + 1;
      if (next < session.post.images.length) {
        await setStep(sessionId, "REVIEW_PHOTO_META_EN", next);
        return formatPhotoMetaEnReview(session.postId, next);
      }
      await setStep(sessionId, "READY");
      return readyReply(session.postId);
    }
    case "ready": {
      await prisma.post.update({
        where: { id: session.postId },
        data: {
          status: "PUBLISHED",
          publishedAt: session.post.publishedAt ?? new Date(),
        },
      });
      await setStep(sessionId, "COMPLETED");
      const post = await loadPost(session.postId);
      return {
        text: `🚀 Publié : ${siteBaseUrl()}/blog/${post.slug}`,
      };
    }
    default:
      return { text: "Étape inconnue." };
  }
}

async function readyReply(postId: string): Promise<BotReply> {
  const post = await loadPost(postId);
  return {
    text: [
      "✅ *Brouillon prêt*",
      "",
      `Titre : ${post.titleFr}`,
      `Aperçu éditeur : ${siteBaseUrl()}/apercu/${post.id}`,
      "",
      "Publier maintenant ?",
    ].join("\n"),
    buttons: [
      [
        { text: "🚀 Publier", callback_data: "ready:approve" },
        { text: "✏️ Garder en brouillon", callback_data: "session:cancel" },
      ],
    ],
  };
}

function parseKv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^([a-zàâäéèêëïîôùûüç_]+)\s*[:=]\s*(.+)$/i.exec(line.trim());
    if (m) out[m[1].toLowerCase()] = m[2].trim();
  }
  return out;
}

export async function handleEditMessage(
  sessionId: string,
  text: string
): Promise<BotReply> {
  const session = await loadSession(sessionId);
  if (!session?.postId || !session.post) {
    return { text: "Pas de brouillon à modifier." };
  }

  const kv = parseKv(text);
  const postId = session.postId;

  if (session.step === "REVIEW_PHOTO_ORDER" && (kv.ordre || kv.order)) {
    const raw = kv.ordre || kv.order;
    const order = raw
      .split(/[,;\s]+/)
      .map((n) => Number(n) - 1)
      .filter((n) => Number.isInteger(n) && n >= 0);
    const images = session.post.images;
    if (order.length === images.length) {
      const reordered = order.map((i) => images[i]).filter(Boolean);
      if (reordered.length === images.length) {
        for (let i = 0; i < reordered.length; i++) {
          await prisma.postMedia.update({
            where: { postId_mediaId: { postId, mediaId: reordered[i].id } },
            data: { sortOrder: i },
          });
        }
      }
    }
    return formatPhotoOrderReview(postId);
  }

  if (session.step === "REVIEW_PHOTO_META_FR") {
    const img = session.post.images[session.photoIndex];
    if (!img) return { text: "Photo introuvable." };
    const data: Prisma.MediaUpdateInput = {};
    if (kv.titre || kv.title) data.titleFr = kv.titre || kv.title;
    if (kv.description || kv.desc || kv.caption) {
      data.descriptionFr = kv.description || kv.desc || kv.caption;
    }
    if (kv.date) {
      const d = new Date(kv.date);
      if (!Number.isNaN(d.getTime())) data.takenAt = d;
    }
    if (kv.centrage || kv.focus) {
      const [x, y] = (kv.centrage || kv.focus).split(",").map(Number);
      if (!Number.isNaN(x)) data.focusX = x;
      if (!Number.isNaN(y)) data.focusY = y;
    }
    if (kv.zoom) {
      const z = Number(kv.zoom);
      if (!Number.isNaN(z)) data.zoom = z;
    }
    if (kv.rotation) {
      const r = Number(kv.rotation);
      if (!Number.isNaN(r)) data.rotation = r;
    }
    if (kv.crop) {
      const [x, y, w, h] = kv.crop.split(",").map(Number);
      if (![x, y, w, h].some(Number.isNaN)) {
        data.cropX = x;
        data.cropY = y;
        data.cropW = w;
        data.cropH = h;
      }
    }
    await prisma.media.update({ where: { id: img.id }, data });
    return formatPhotoMetaFrReview(postId, session.photoIndex);
  }

  if (session.step === "REVIEW_PHOTO_META_EN") {
    const img = session.post.images[session.photoIndex];
    if (!img) return { text: "Photo introuvable." };
    const data: Prisma.MediaUpdateInput = {};
    if (kv.title || kv.titre) data.titleEn = kv.title || kv.titre;
    if (kv.description || kv.desc || kv.caption) {
      data.descriptionEn = kv.description || kv.desc || kv.caption;
    }
    await prisma.media.update({ where: { id: img.id }, data });
    return formatPhotoMetaEnReview(postId, session.photoIndex);
  }

  // Article-level edits (FR / EN / preview)
  const data: Prisma.PostUpdateInput = {};
  if (kv.titre || kv.title) {
    if (session.step === "REVIEW_EN") data.titleEn = kv.titre || kv.title;
    else data.titleFr = kv.titre || kv.title;
  }
  if (kv.texte || kv.body || kv.text) {
    const body = kv.texte || kv.body || kv.text;
    if (session.step === "REVIEW_EN") data.bodyEn = body;
    else data.bodyFr = body;
  }
  if (kv.date) {
    const d = new Date(kv.date);
    if (!Number.isNaN(d.getTime())) data.publishedAt = d;
  }

  if (Object.keys(data).length) {
    await prisma.post.update({ where: { id: postId }, data });
  }

  if (kv.tags) {
    const labels = kv.tags.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    const { tagIds } = await ensureTags(labels);
    await syncPostRelations(postId, { tagIds });
  }

  if (kv.thèmes || kv.themes || kv.theme) {
    const raw = kv.thèmes || kv.themes || kv.theme;
    const slugs = raw.split(/[,;]/).map((s) => slugify(s.trim())).filter(Boolean);
    const themes = await prisma.theme.findMany();
    const themeIds = themes
      .filter((t) => slugs.includes(t.slug) || slugs.includes(slugify(t.labelFr)))
      .map((t) => t.id);
    await syncPostRelations(postId, { themeIds });
  }

  if (kv.jalon || kv.milestone) {
    const q = kv.jalon || kv.milestone;
    const milestones = await prisma.milestone.findMany();
    const m =
      milestones.find((x) => x.slug === q || slugify(x.titleFr) === slugify(q)) ||
      milestones.find((x) => x.titleFr.toLowerCase().includes(q.toLowerCase()));
    await syncPostRelations(postId, {
      milestoneIds: m ? [m.id] : [],
    });
  }

  if (session.step === "REVIEW_EN") return formatEnReview(postId);
  if (session.step === "REVIEW_PREVIEW") return formatPreviewReview(postId);
  return formatFrReview(postId);
}
