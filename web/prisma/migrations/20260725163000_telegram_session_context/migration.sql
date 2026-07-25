-- Session compaction + token tracking for Telegram Cursor agent
ALTER TABLE "TelegramAgentThread" ADD COLUMN IF NOT EXISTS "sessionSummary" TEXT;
ALTER TABLE "TelegramAgentThread" ADD COLUMN IF NOT EXISTS "lastTurnInputTokens" INTEGER;
ALTER TABLE "TelegramAgentThread" ADD COLUMN IF NOT EXISTS "memoryBriefHash" TEXT;
ALTER TABLE "TelegramAgentThread" ADD COLUMN IF NOT EXISTS "sessionCompactedAt" TIMESTAMP(3);
