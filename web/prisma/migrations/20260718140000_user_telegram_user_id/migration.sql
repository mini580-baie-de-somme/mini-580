-- AlterTable
ALTER TABLE "User" ADD COLUMN "telegramUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramUserId_key" ON "User"("telegramUserId");
