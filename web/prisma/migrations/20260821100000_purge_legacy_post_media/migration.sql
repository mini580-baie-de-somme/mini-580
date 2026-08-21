-- Purge legacy PostMedia rows (isCover=false) from pre-chantier-1 standalone gallery.
-- Valid media→article links: cover only (isCover=true). Body links go via MediaGroupMember.
DELETE FROM "PostMedia" WHERE "isCover" = false;
