import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PostStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getEditorOrService } from "@/lib/service-auth";
import { parseListPagination } from "@/lib/editor-list";
import {
  milestoneOrderBy,
  parseMilestoneLocale,
  uniqueMilestoneSlug,
} from "@/lib/milestones";
import { postsInMilestoneWindow, type TimelinePost } from "@/lib/timeline-data";
import { requiredDateTime, optionalNullableDateTime } from "@/lib/date-schema";

const postSelect = {
  id: true,
  slug: true,
  titleFr: true,
  titleEn: true,
  status: true,
  publishedAt: true,
  workDays: true,
} as const;

function milestoneWhere(q?: string): Prisma.MilestoneWhereInput {
  if (!q) return {};
  return {
    OR: [
      { slug: { contains: q, mode: "insensitive" } },
      { titleFr: { contains: q, mode: "insensitive" } },
      { titleEn: { contains: q, mode: "insensitive" } },
      { descriptionFr: { contains: q, mode: "insensitive" } },
      { descriptionEn: { contains: q, mode: "insensitive" } },
    ],
  };
}

function serializeMilestoneWithPosts<
  T extends {
    id: string;
    slug: string;
    titleFr: string;
    titleEn: string;
    descriptionFr: string;
    descriptionEn: string;
    milestoneDate: Date;
    endDate: Date | null;
    workloadForecast: number | null;
    createdAt: Date;
  },
>(milestone: T, allPosts: TimelinePost[]) {
  const steps = postsInMilestoneWindow(
    {
      id: milestone.id,
      titleFr: milestone.titleFr,
      titleEn: milestone.titleEn,
      descriptionFr: milestone.descriptionFr,
      descriptionEn: milestone.descriptionEn,
      milestoneDate: milestone.milestoneDate,
      endDate: milestone.endDate,
      workloadForecast: milestone.workloadForecast,
    },
    allPosts
  );
  return {
    ...milestone,
    posts: steps.map(({ post }) => ({ post })),
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const { limit, offset, q, paginated } = parseListPagination(searchParams);
  const where = milestoneWhere(q);
  const orderBy = milestoneOrderBy(parseMilestoneLocale(searchParams.get("locale")));

  const allPosts = await prisma.post.findMany({
    where: {
      status: PostStatus.PUBLISHED,
      publishedAt: { not: null },
    },
    select: postSelect,
  });

  if (!paginated) {
    const milestones = await prisma.milestone.findMany({ where, orderBy });
    return NextResponse.json(
      milestones.map((m) => serializeMilestoneWithPosts(m, allPosts))
    );
  }

  const [items, total, totalAll] = await Promise.all([
    prisma.milestone.findMany({ where, orderBy, take: limit, skip: offset }),
    prisma.milestone.count({ where }),
    prisma.milestone.count(),
  ]);

  return NextResponse.json({
    items: items.map((m) => serializeMilestoneWithPosts(m, allPosts)),
    total,
    totalAll,
    limit,
    offset,
  });
}

const createSchema = z
  .object({
    titleFr: z.string().min(1),
    titleEn: z.string().min(1),
    descriptionFr: z.string().optional(),
    descriptionEn: z.string().optional(),
    milestoneDate: requiredDateTime,
    endDate: optionalNullableDateTime,
    workloadForecast: z.union([z.number().int().min(0), z.null()]).optional(),
    slug: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.endDate) {
      const start = new Date(data.milestoneDate);
      const end = new Date(data.endDate);
      if (end < start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "endDate must be >= milestoneDate",
          path: ["endDate"],
        });
      }
    }
  });

export async function POST(request: NextRequest) {
  const editor = await getEditorOrService(request);
  if (!editor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = createSchema.parse(body);
    const slug = await uniqueMilestoneSlug(data.titleEn);

    const milestone = await prisma.milestone.create({
      data: {
        slug,
        titleFr: data.titleFr,
        titleEn: data.titleEn,
        descriptionFr: data.descriptionFr ?? "",
        descriptionEn: data.descriptionEn ?? "",
        milestoneDate: new Date(data.milestoneDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        workloadForecast: data.workloadForecast ?? null,
      },
    });

    return NextResponse.json(milestone, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create milestone" }, { status: 500 });
  }
}
