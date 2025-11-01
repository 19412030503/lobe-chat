ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "max_users" integer;
