-- Optional IMAGE poster/thumbnail for VIDEO or DOCUMENT media

ALTER TABLE "Media" ADD COLUMN "posterMediaId" TEXT;

CREATE INDEX "Media_posterMediaId_idx" ON "Media"("posterMediaId");

ALTER TABLE "Media" ADD CONSTRAINT "Media_posterMediaId_fkey"
  FOREIGN KEY ("posterMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
