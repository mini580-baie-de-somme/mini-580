import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  cleanupBySlug,
  cleanupTestPosts,
  ensureAdminUser,
  makeTestJpeg,
  resetMediaRoot,
  uniqueSlug,
} from "../helpers";
import { prisma } from "@/lib/db";
import { withLegacyImages } from "@/lib/posts";
import type { TelegramUpdate } from "@/lib/telegram/webhook-handler";

const USER_ID = 7257839706;
const CHAT_ID = 7257839706;
const PREFIX = "it-tg-";

type Outbound = { chatId: number | string; text: string };

const outbound: Outbound[] = [];
let updateCounter = 1;

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock("@/lib/telegram/api", () => ({
  sendTelegramReply: vi.fn(
    async (chatId: number | string, reply: { text: string }) => {
      outbound.push({ chatId, text: reply.text });
    }
  ),
  answerCallbackQuery: vi.fn(async () => undefined),
  downloadTelegramFile: vi.fn(async () => {
    const buffer = await makeTestJpeg();
    return {
      buffer,
      filename: "telegram.jpg",
      contentType: "image/jpeg",
    };
  }),
  getTelegramBotToken: vi.fn(() => "test-bot-token"),
}));

vi.mock("@/lib/telegram/agent", () => ({
  resetTelegramAgent: vi.fn(async () => undefined),
  runTelegramAgentTurn: vi.fn(async () => "agent-mock-ok"),
}));

function nextId() {
  return updateCounter++;
}

function textMsg(text: string, userId = USER_ID): TelegramUpdate {
  const id = nextId();
  return {
    update_id: id,
    message: {
      message_id: id,
      chat: { id: CHAT_ID, type: "private" },
      from: { id: userId, username: "it_user", first_name: "IT" },
      text,
    },
  };
}

function photoMsg(fileId: string, caption?: string): TelegramUpdate {
  const id = nextId();
  return {
    update_id: id,
    message: {
      message_id: id,
      chat: { id: CHAT_ID, type: "private" },
      from: { id: USER_ID, username: "it_user", first_name: "IT" },
      caption,
      photo: [
        { file_id: `${fileId}_s`, width: 90, height: 90 },
        { file_id: fileId, width: 1280, height: 960 },
      ],
    },
  };
}

function cb(data: string): TelegramUpdate {
  const id = nextId();
  return {
    update_id: id,
    callback_query: {
      id: `cq-${id}`,
      from: { id: USER_ID, username: "it_user", first_name: "IT" },
      data,
      message: {
        message_id: id,
        chat: { id: CHAT_ID, type: "private" },
        from: { id: USER_ID },
      },
    },
  };
}

async function loadProcessor() {
  const { processTelegramUpdate } = await import(
    "@/lib/telegram/webhook-handler"
  );
  return processTelegramUpdate;
}

async function activeSession() {
  return prisma.telegramPublishSession.findFirst({
    where: {
      telegramUserId: String(USER_ID),
      telegramChatId: String(CHAT_ID),
      step: {
        notIn: ["CANCELLED", "COMPLETED"],
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

async function cancelActive() {
  await prisma.telegramPublishSession.updateMany({
    where: {
      telegramUserId: String(USER_ID),
      telegramChatId: String(CHAT_ID),
      step: { notIn: ["CANCELLED", "COMPLETED"] },
    },
    data: { step: "CANCELLED" },
  });
}

async function loadGuidedPost() {
  const session = await activeSession();
  expect(session?.postId).toBeTruthy();
  const post = await prisma.post.findUnique({
    where: { id: session!.postId! },
    include: {
      tags: { include: { tag: true } },
      milestones: { include: { milestone: true } },
      mediaLinks: { orderBy: { sortOrder: "asc" }, include: { media: true } },
    },
  });
  expect(post).toBeTruthy();
  return { session: session!, post: post! };
}

/** Start /nouveau, send photos + structured text, finish collection → REVIEW_FR */
async function startDraft(opts: {
  title: string;
  body: string;
  photos?: number;
  tags?: string;
  jalon?: string;
}) {
  const run = await loadProcessor();
  await run(textMsg("/nouveau"));
  const n = opts.photos ?? 1;
  for (let i = 0; i < n; i++) {
    await run(photoMsg(`file-${opts.title}-${i}`, i === 1 ? "caption mid" : undefined));
  }
  const lines = [`Titre: ${opts.title}`, `Texte: ${opts.body}`];
  if (opts.tags) lines.push(`Tags: ${opts.tags}`);
  if (opts.jalon) lines.push(`Jalon: ${opts.jalon}`);
  await run(textMsg(lines.join("\n")));
  await run(cb("content:done"));
  const session = await activeSession();
  expect(session?.step).toBe("REVIEW_FR");
  return session!;
}

describe("Telegram conversation simulations — parcours guidé", () => {
  beforeAll(async () => {
    process.env.TELEGRAM_ALLOWED_USER_IDS = String(USER_ID);
    process.env.TELEGRAM_SERVICE_USER_EMAIL =
      process.env.SEED_ADMIN_EMAIL || "admin@classmini580.blog";

    if (!process.env.CURSOR_API_KEY?.trim()) {
      throw new Error(
        "CURSOR_API_KEY required for Telegram IA tests. " +
          "Provide via web/.env.cursor.local or /tmp/mini580-cursor.env (never commit)."
      );
    }
    process.env.CURSOR_MODEL =
      process.env.CURSOR_MODEL?.trim() || "composer-2.5";

    await ensureAdminUser();
    await resetMediaRoot();
    await cleanupTestPosts(PREFIX);
    await cleanupBySlug("tag", PREFIX);
    await cleanupBySlug("milestone", PREFIX);
  });

  beforeEach(async () => {
    outbound.length = 0;
    await cancelActive();
  });

  afterAll(async () => {
    await cancelActive();
    await prisma.telegramPublishSession.deleteMany({
      where: { telegramUserId: String(USER_ID) },
    });
    await cleanupTestPosts(PREFIX);
    await cleanupBySlug("tag", PREFIX);
    await cleanupBySlug("milestone", PREFIX);
  });

  it("rejects unauthorized user", async () => {
    const run = await loadProcessor();
    await run(textMsg("/nouveau", 999999999));
    expect(outbound.at(-1)?.text.toLowerCase()).toMatch(/autoris/);
  });

  it("one photo + new tag + delayed /traduire after FR edit (Cursor IA)", async () => {
    const run = await loadProcessor();
    const tagLabel = `IT-TG-new-${uniqueSlug(PREFIX)}`;
    await startDraft({
      title: `Pose quille ${PREFIX}`,
      body: "Première photo du chantier Baie de Somme.",
      photos: 1,
    });

    await run(cb("fr:edit"));
    expect(outbound.at(-1)?.text).toMatch(/modifications/i);
    // Human correction: titre + corps + tag (AI parse may omit tags)
    await run(
      textMsg(
        [
          "titre: Pose de la quille mise à jour",
          "texte: Corps français corrigé pour la traduction.",
          `tags: ${tagLabel}`,
        ].join("\n")
      )
    );

    const afterEdit = await loadGuidedPost();
    expect(afterEdit.post.titleFr).toBe("Pose de la quille mise à jour");
    expect(afterEdit.post.bodyFr).toContain("français");
    expect(afterEdit.post.tags.some((t) => t.tag.labelFr === tagLabel)).toBe(
      true
    );

    await run(textMsg("/traduire"));
    const session = await activeSession();
    expect(session?.step).toBe("REVIEW_EN");
    const last = outbound.at(-1)?.text || "";
    expect(last).not.toMatch(/CURSOR_API_KEY manquant/);
    expect(last).toMatch(/Title|EN|Confirmation|milestone|Timeline/i);

    const { post } = await loadGuidedPost();
    expect(post.titleEn.trim().length).toBeGreaterThan(0);
    expect(post.bodyEn.trim().length).toBeGreaterThan(0);
    expect(post.titleEn).not.toBe(post.titleFr);
  }, 300_000);

  it("uses existing tag and existing milestone", async () => {
    const tagName = uniqueSlug(PREFIX);
    const tag = await prisma.tag.create({
      data: {
        name: tagName,
        labelFr: `TagExistant ${tagName}`,
        labelEn: "Existing tag",
      },
    });
    const mileSlug = uniqueSlug(PREFIX);
    const mile = await prisma.milestone.create({
      data: {
        slug: mileSlug,
        titleFr: `Jalon Existant ${mileSlug}`,
        titleEn: "Existing milestone",
        milestoneDate: new Date("2026-02-01"),
      },
    });

    await startDraft({
      title: `Avec catalogue ${PREFIX}`,
      body: "Réutilise tag et jalon.",
      tags: tag.labelFr,
      jalon: mile.titleFr,
      photos: 1,
    });

    const { post } = await loadGuidedPost();
    expect(post.tags.some((t) => t.tag.id === tag.id)).toBe(true);
    expect(post.milestones.some((m) => m.milestone.id === mile.id)).toBe(true);
  });

  it("several photos → Cursor trad → reorder → meta FR/EN → keep as draft", async () => {
    const run = await loadProcessor();
    await startDraft({
      title: `Multi photos chantier ${PREFIX}`,
      body: "Trois photos du chantier naval.",
      photos: 3,
    });

    await run(cb("fr:approve"));
    expect((await activeSession())?.step).toBe("REVIEW_EN");
    expect(outbound.at(-1)?.text || "").not.toMatch(/CURSOR_API_KEY manquant/);

    const afterTrad = await loadGuidedPost();
    expect(afterTrad.post.titleEn.trim().length).toBeGreaterThan(0);
    expect(afterTrad.post.titleEn).not.toBe(afterTrad.post.titleFr);

    await run(cb("en:approve"));
    expect((await activeSession())?.step).toBe("REVIEW_PREVIEW");

    await run(cb("preview:approve"));
    expect((await activeSession())?.step).toBe("REVIEW_PHOTO_ORDER");

    const before = await loadGuidedPost();
    const idsBefore = withLegacyImages(before.post!).images.map((i) => i.id);
    expect(idsBefore.length).toBe(3);

    await run(cb("order:edit"));
    await run(textMsg("ordre: 3,1,2"));
    const afterOrder = await loadGuidedPost();
    expect(withLegacyImages(afterOrder.post!).images.map((i) => i.id)).toEqual([
      idsBefore[2],
      idsBefore[0],
      idsBefore[1],
    ]);

    await run(cb("order:approve"));
    expect((await activeSession())?.step).toBe("REVIEW_PHOTO_META_FR");

    await run(
      textMsg(
        [
          "titre: Photo A FR",
          "description: Légende A du couple",
          "zoom: 1.2",
          "rotation: 90",
          "crop: 0.1,0.1,0.8,0.8",
          "centrage: 0.4,0.6",
        ].join("\n")
      )
    );
    let cur = await loadGuidedPost();
    expect(withLegacyImages(cur.post!).images[0].titleFr).toBe("Photo A FR");
    expect(withLegacyImages(cur.post!).images[0].descriptionFr).toBe("Légende A du couple");
    expect(withLegacyImages(cur.post!).images[0].zoom).toBe(1.2);
    expect(withLegacyImages(cur.post!).images[0].rotation).toBe(90);

    await run(cb("photofr:approve"));
    await run(textMsg("titre: Photo B FR\ndescription: Légende B"));
    await run(cb("photofr:approve"));
    await run(textMsg("titre: Photo C FR\ndescription: Légende C"));
    await run(cb("photofr:approve"));

    expect((await activeSession())?.step).toBe("REVIEW_PHOTO_META_EN");
    // Image EN should be filled by Cursor when titles/descriptions FR exist
    cur = await loadGuidedPost();
    expect(withLegacyImages(cur.post!).images[0].titleEn.trim().length).toBeGreaterThan(0);

    await run(cb("photoen:approve"));
    await run(cb("photoen:approve"));
    await run(cb("photoen:approve"));

    expect((await activeSession())?.step).toBe("READY");
    expect(outbound.at(-1)?.text).toMatch(/Brouillon prêt|Publier/i);

    await run(cb("session:cancel"));
    cur = await prisma.post.findUniqueOrThrow({
      where: { id: before.post.id },
      include: { mediaLinks: { orderBy: { sortOrder: "asc" }, include: { media: true } } },
    });
    expect(cur.status).toBe("DRAFT");
    expect(withLegacyImages(cur).images[0].titleFr).toBe("Photo A FR");
    expect(withLegacyImages(cur).images[1].titleFr).toBe("Photo B FR");
    expect(withLegacyImages(cur).images[2].titleFr).toBe("Photo C FR");
  }, 300_000);

  it("full path with Cursor trad publishes the post", async () => {
    const run = await loadProcessor();
    await startDraft({
      title: `Publication chantier ${PREFIX}`,
      body: "Article à publier après traduction automatique.",
      photos: 1,
    });

    await run(cb("fr:approve"));
    expect(outbound.at(-1)?.text || "").not.toMatch(/CURSOR_API_KEY manquant/);
    const translated = await loadGuidedPost();
    expect(translated.post.titleEn.trim().length).toBeGreaterThan(0);

    await run(cb("en:approve"));
    await run(cb("preview:approve"));
    await run(cb("order:approve"));
    await run(textMsg("titre: Cover FR\ndescription: Description FR cover"));
    await run(cb("photofr:approve"));

    const afterImgTrad = await loadGuidedPost();
    expect(withLegacyImages(afterImgTrad.post!).images[0].titleEn.trim().length).toBeGreaterThan(0);

    await run(cb("photoen:approve"));

    expect((await activeSession())?.step).toBe("READY");
    const { post } = await loadGuidedPost();

    await run(cb("ready:approve"));
    const published = await prisma.post.findUniqueOrThrow({
      where: { id: post.id },
    });
    expect(published.status).toBe("PUBLISHED");
    expect(published.publishedAt).toBeTruthy();
    expect(published.titleEn.trim().length).toBeGreaterThan(0);
    expect(outbound.at(-1)?.text).toMatch(/Publié/i);

    const done = await prisma.telegramPublishSession.findFirst({
      where: { postId: post.id },
      orderBy: { updatedAt: "desc" },
    });
    expect(done?.step).toBe("COMPLETED");
  }, 300_000);

  it("attaches jalon later via edit on REVIEW_FR", async () => {
    const run = await loadProcessor();
    const mileSlug = uniqueSlug(PREFIX);
    const mile = await prisma.milestone.create({
      data: {
        slug: mileSlug,
        titleFr: `Jalon Late ${mileSlug}`,
        titleEn: "Late milestone",
        milestoneDate: new Date("2026-05-01"),
      },
    });

    await startDraft({
      title: `Late jalon ${PREFIX}`,
      body: "Sans jalon au départ.",
      photos: 1,
    });

    // AI parse may guess a milestone; human overrides with explicit jalon
    await run(textMsg(`jalon: ${mile.titleFr}`));
    const { post } = await loadGuidedPost();
    expect(post.milestones.some((m) => m.milestone.id === mile.id)).toBe(true);
  });

  it("/statut and /annuler work during guided flow", async () => {
    const run = await loadProcessor();
    await startDraft({
      title: `Statut ${PREFIX}`,
      body: "Test commandes.",
      photos: 1,
    });

    await run(textMsg("/statut"));
    expect(outbound.at(-1)?.text).toMatch(/REVIEW_FR|étape/i);

    await run(textMsg("/annuler"));
    expect(outbound.at(-1)?.text).toMatch(/annul/i);
    expect(await activeSession()).toBeNull();
  });
});
