import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PostStatus, Hull } from "@/generated/prisma/client";
import { requireSyncAuth } from "@/lib/sync-crypto";
import { upsertCatalog, upsertPostFromSync, type SyncPostPayload } from "@/lib/sync";

const postSchema = z.object({
  id: z.string(),
  slug: z.string(),
  titleFr: z.string(),
  titleEn: z.string(),
  excerptFr: z.string(),
  excerptEn: z.string(),
  bodyFr: z.string(),
  bodyEn: z.string(),
  status: z.nativeEnum(PostStatus),
  coverImageUrl: z.string().nullable(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  authorEmail: z.string(),
  hulls: z.array(z.nativeEnum(Hull)),
  tags: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      labelFr: z.string(),
      labelEn: z.string(),
    })
  ),
  themes: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      labelFr: z.string(),
      labelEn: z.string(),
    })
  ),
  milestones: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      titleFr: z.string(),
      titleEn: z.string(),
      descriptionFr: z.string(),
      descriptionEn: z.string(),
      milestoneDate: z.string(),
      sortOrder: z.number().optional(),
    })
  ),
  images: z.array(
    z.object({
      id: z.string(),
      urlOrigin: z.string().optional(),
      url: z.string().optional(),
      urlPicto: z.string().nullable().optional(),
      urlPetite: z.string().nullable().optional(),
      urlMoyenne: z.string().nullable().optional(),
      urlGrande: z.string().nullable().optional(),
      titleFr: z.string().optional().default(""),
      titleEn: z.string().optional().default(""),
      descriptionFr: z.string().optional(),
      descriptionEn: z.string().optional(),
      captionFr: z.string().optional(),
      captionEn: z.string().optional(),
      takenAt: z.string().nullable().optional(),
      sortOrder: z.number(),
      focusX: z.number().optional(),
      focusY: z.number().optional(),
      zoom: z.number().optional(),
      rotation: z.number().optional(),
      cropX: z.number().optional(),
      cropY: z.number().optional(),
      cropW: z.number().optional(),
      cropH: z.number().optional(),
    }).transform((img) => {
      const urlOrigin = img.urlOrigin ?? img.url ?? "";
      return {
        ...img,
        urlOrigin,
        urlPicto: img.urlPicto ?? null,
        urlPetite: img.urlPetite ?? null,
        urlMoyenne: img.urlMoyenne ?? urlOrigin,
        urlGrande: img.urlGrande ?? null,
        descriptionFr: img.descriptionFr ?? img.captionFr ?? "",
        descriptionEn: img.descriptionEn ?? img.captionEn ?? "",
      };
    })
  ),
});

const catalogSchema = z.object({
  tags: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      labelFr: z.string(),
      labelEn: z.string(),
      createdAt: z.string(),
    })
  ),
  themes: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      labelFr: z.string(),
      labelEn: z.string(),
    })
  ),
  milestones: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      titleFr: z.string(),
      titleEn: z.string(),
      descriptionFr: z.string(),
      descriptionEn: z.string(),
      milestoneDate: z.string(),
      sortOrder: z.number().optional(),
      createdAt: z.string(),
    })
  ),
});

/**
 * Peer-facing import API (OTP required).
 * PUT body: { type: "post"|"catalog", payload }
 */
export async function PUT(request: NextRequest) {
  try {
    await requireSyncAuth(request, "import");
    const body = await request.json();
    const type = body?.type;

    if (type === "post") {
      const payload = postSchema.parse(body.payload) as SyncPostPayload;
      const post = await upsertPostFromSync(payload);
      return NextResponse.json({ ok: true, id: post?.id });
    }

    if (type === "catalog") {
      const payload = catalogSchema.parse(body.payload);
      await upsertCatalog(payload);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown type" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unauthorized";
    const status = message.includes("OTP") || message.includes("Bearer") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
