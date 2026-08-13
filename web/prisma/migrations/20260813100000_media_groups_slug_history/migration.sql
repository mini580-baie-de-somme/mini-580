-- Phase 1d-a: MediaGroup + members, Media.slug, slug history tables (SEO redirects)

CREATE TYPE "MediaGroupLayout" AS ENUM ('GRID', 'ROW', 'SINGLE');

ALTER TABLE "Media" ADD COLUMN "slug" TEXT;

CREATE TABLE "MediaGroup" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titleFr" TEXT NOT NULL DEFAULT '',
    "titleEn" TEXT NOT NULL DEFAULT '',
    "layout" "MediaGroupLayout" NOT NULL DEFAULT 'GRID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MediaGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MediaGroupMember" (
    "groupId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "MediaGroupMember_pkey" PRIMARY KEY ("groupId","mediaId")
);

CREATE TABLE "PostSlugHistory" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "oldSlug" TEXT NOT NULL,
    "newSlug" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostSlugHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MediaSlugHistory" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "oldSlug" TEXT NOT NULL,
    "newSlug" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MediaSlugHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MediaGroupSlugHistory" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "oldSlug" TEXT NOT NULL,
    "newSlug" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MediaGroupSlugHistory_pkey" PRIMARY KEY ("id")
);

-- Backfill Media.slug with stable short id (unique; title-based slugs set via API later)
UPDATE "Media" SET "slug" = 'media-' || SUBSTRING("id" FROM 1 FOR 12);

CREATE UNIQUE INDEX "Media_slug_key" ON "Media"("slug");

CREATE UNIQUE INDEX "MediaGroup_slug_key" ON "MediaGroup"("slug");
CREATE INDEX "MediaGroup_updatedAt_idx" ON "MediaGroup"("updatedAt");

CREATE INDEX "MediaGroupMember_groupId_sortOrder_idx" ON "MediaGroupMember"("groupId", "sortOrder");
CREATE INDEX "MediaGroupMember_mediaId_idx" ON "MediaGroupMember"("mediaId");

CREATE INDEX "PostSlugHistory_oldSlug_idx" ON "PostSlugHistory"("oldSlug");
CREATE INDEX "PostSlugHistory_postId_changedAt_idx" ON "PostSlugHistory"("postId", "changedAt");

CREATE INDEX "MediaSlugHistory_oldSlug_idx" ON "MediaSlugHistory"("oldSlug");
CREATE INDEX "MediaSlugHistory_mediaId_changedAt_idx" ON "MediaSlugHistory"("mediaId", "changedAt");

CREATE INDEX "MediaGroupSlugHistory_oldSlug_idx" ON "MediaGroupSlugHistory"("oldSlug");
CREATE INDEX "MediaGroupSlugHistory_groupId_changedAt_idx" ON "MediaGroupSlugHistory"("groupId", "changedAt");

ALTER TABLE "MediaGroupMember" ADD CONSTRAINT "MediaGroupMember_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "MediaGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MediaGroupMember" ADD CONSTRAINT "MediaGroupMember_mediaId_fkey"
  FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostSlugHistory" ADD CONSTRAINT "PostSlugHistory_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MediaSlugHistory" ADD CONSTRAINT "MediaSlugHistory_mediaId_fkey"
  FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MediaGroupSlugHistory" ADD CONSTRAINT "MediaGroupSlugHistory_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "MediaGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
