ALTER TABLE "generation_topics"
ADD COLUMN IF NOT EXISTS "type" varchar(16) NOT NULL DEFAULT 'image';

ALTER TABLE "generation_batches"
ADD COLUMN IF NOT EXISTS "type" varchar(16) NOT NULL DEFAULT 'image';

UPDATE "generation_topics"
SET "type" = 'image'
WHERE "type" IS NULL;

UPDATE "generation_batches"
SET "type" = 'image'
WHERE "type" IS NULL;
