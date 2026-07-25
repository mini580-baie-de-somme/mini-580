-- CreateTable
CREATE TABLE "AgentMemoryItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AgentMemoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentMemoryItem_deletedAt_idx" ON "AgentMemoryItem"("deletedAt");

-- CreateIndex
CREATE INDEX "AgentMemoryItem_updatedAt_idx" ON "AgentMemoryItem"("updatedAt");
