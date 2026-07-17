-- Media library: independent Media + PostMedia M:N (from PostImage)

CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'DOCUMENT', 'VIDEO');

CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL DEFAULT 'IMAGE',
    "mimeType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "byteSize" INTEGER,
    "urlOrigin" TEXT NOT NULL,
    "urlPicto" TEXT,
    "urlPetite" TEXT,
    "urlMoyenne" TEXT,
    "urlGrande" TEXT,
    "titleFr" TEXT NOT NULL DEFAULT '',
    "titleEn" TEXT NOT NULL DEFAULT '',
    "descriptionFr" TEXT NOT NULL DEFAULT '',
    "descriptionEn" TEXT NOT NULL DEFAULT '',
    "takenAt" TIMESTAMP(3),
    "focusX" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "focusY" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "zoom" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "rotation" INTEGER NOT NULL DEFAULT 0,
    "cropX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cropY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cropW" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "cropH" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PostMedia" (
    "postId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "PostMedia_pkey" PRIMARY KEY ("postId","mediaId")
);

INSERT INTO "Media" (
  "id", "kind", "mimeType", "urlOrigin", "urlPicto", "urlPetite", "urlMoyenne", "urlGrande",
  "titleFr", "titleEn", "descriptionFr", "descriptionEn", "takenAt",
  "focusX", "focusY", "zoom", "rotation", "cropX", "cropY", "cropW", "cropH",
  "createdAt", "updatedAt"
)
SELECT
  "id",
  'IMAGE'::"MediaKind",
  'image/jpeg',
  "urlOrigin",
  "urlPicto",
  "urlPetite",
  "urlMoyenne",
  "urlGrande",
  "titleFr",
  "titleEn",
  "descriptionFr",
  "descriptionEn",
  "takenAt",
  "focusX",
  "focusY",
  "zoom",
  "rotation",
  "cropX",
  "cropY",
  "cropW",
  "cropH",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "PostImage";

INSERT INTO "PostMedia" ("postId", "mediaId", "sortOrder", "isCover")
SELECT
  pi."postId",
  pi."id",
  pi."sortOrder",
  CASE
    WHEN p."coverImageUrl" IS NOT NULL AND (
      p."coverImageUrl" = pi."urlOrigin"
      OR p."coverImageUrl" = COALESCE(pi."urlPicto", '')
      OR p."coverImageUrl" = COALESCE(pi."urlPetite", '')
      OR p."coverImageUrl" = COALESCE(pi."urlMoyenne", '')
      OR p."coverImageUrl" = COALESCE(pi."urlGrande", '')
    ) THEN true
    ELSE false
  END
FROM "PostImage" pi
JOIN "Post" p ON p."id" = pi."postId";

-- If a post has images but no cover match, mark lowest sortOrder as cover
UPDATE "PostMedia" pm
SET "isCover" = true
WHERE pm."sortOrder" = (
  SELECT MIN(pm2."sortOrder") FROM "PostMedia" pm2 WHERE pm2."postId" = pm."postId"
)
AND NOT EXISTS (
  SELECT 1 FROM "PostMedia" pm3 WHERE pm3."postId" = pm."postId" AND pm3."isCover" = true
);

CREATE INDEX "Media_kind_idx" ON "Media"("kind");
CREATE INDEX "Media_createdAt_idx" ON "Media"("createdAt");
CREATE INDEX "PostMedia_mediaId_idx" ON "PostMedia"("mediaId");

ALTER TABLE "PostMedia" ADD CONSTRAINT "PostMedia_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostMedia" ADD CONSTRAINT "PostMedia_mediaId_fkey"
  FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP TABLE "PostImage";

ALTER TABLE "TelegramAgentThread" RENAME COLUMN "activeImageId" TO "activeMediaId";
