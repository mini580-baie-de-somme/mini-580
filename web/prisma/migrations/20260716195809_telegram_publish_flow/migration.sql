-- AlterTable
ALTER TABLE "PostImage" ADD COLUMN     "titleFr" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "titleEn" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "takenAt" TIMESTAMP(3),
ADD COLUMN     "focusX" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
ADD COLUMN     "focusY" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
ADD COLUMN     "zoom" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN     "rotation" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cropX" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "cropY" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "cropW" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN     "cropH" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- CreateEnum
CREATE TYPE "TelegramSessionStep" AS ENUM (
  'AWAITING_CONTENT',
  'REVIEW_FR',
  'REVIEW_EN',
  'REVIEW_PREVIEW',
  'REVIEW_PHOTO_ORDER',
  'REVIEW_PHOTO_META_FR',
  'REVIEW_PHOTO_META_EN',
  'READY',
  'CANCELLED',
  'COMPLETED'
);

-- CreateTable
CREATE TABLE "TelegramPublishSession" (
    "id" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "telegramChatId" TEXT NOT NULL,
    "step" "TelegramSessionStep" NOT NULL DEFAULT 'AWAITING_CONTENT',
    "postId" TEXT,
    "photoIndex" INTEGER NOT NULL DEFAULT 0,
    "draftPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramPublishSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreviewToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreviewToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TelegramPublishSession_telegramUserId_telegramChatId_idx" ON "TelegramPublishSession"("telegramUserId", "telegramChatId");

-- CreateIndex
CREATE INDEX "TelegramPublishSession_step_idx" ON "TelegramPublishSession"("step");

-- CreateIndex
CREATE UNIQUE INDEX "PreviewToken_token_key" ON "PreviewToken"("token");

-- CreateIndex
CREATE INDEX "PreviewToken_postId_idx" ON "PreviewToken"("postId");

-- AddForeignKey
ALTER TABLE "TelegramPublishSession" ADD CONSTRAINT "TelegramPublishSession_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreviewToken" ADD CONSTRAINT "PreviewToken_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
