-- Rename legacy columns and add derived format URLs
ALTER TABLE "PostImage" RENAME COLUMN "url" TO "urlOrigin";
ALTER TABLE "PostImage" RENAME COLUMN "captionFr" TO "descriptionFr";
ALTER TABLE "PostImage" RENAME COLUMN "captionEn" TO "descriptionEn";

ALTER TABLE "PostImage" ADD COLUMN "urlPicto" TEXT;
ALTER TABLE "PostImage" ADD COLUMN "urlPetite" TEXT;
ALTER TABLE "PostImage" ADD COLUMN "urlMoyenne" TEXT;
ALTER TABLE "PostImage" ADD COLUMN "urlGrande" TEXT;

-- Backfill: use origin as moyenne until variants are regenerated
UPDATE "PostImage" SET "urlMoyenne" = "urlOrigin" WHERE "urlMoyenne" IS NULL;
