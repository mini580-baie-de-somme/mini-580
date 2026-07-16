-- Persist active post/photo context for Telegram free-form agent
ALTER TABLE "TelegramAgentThread" ADD COLUMN IF NOT EXISTS "activePostId" TEXT;
ALTER TABLE "TelegramAgentThread" ADD COLUMN IF NOT EXISTS "activeImageId" TEXT;
