-- Idempotent: ensure bootstrap platform admins keep isAdmin=true after migrations/deploy.
-- Safe to run on every container start (docker-entrypoint after migrate deploy).
UPDATE "User"
SET "isAdmin" = true
WHERE "status" = 'ACTIVE'
  AND (
    "email" IN ('admin@classmini580.blog', 'lpatrouix@gmail.com')
    OR "telegramUserId" IN ('7257839706', '8137936505')
  );
