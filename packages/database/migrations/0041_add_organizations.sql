CREATE TABLE IF NOT EXISTS "organizations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL UNIQUE,
  "type" text NOT NULL,
  "parent_id" uuid REFERENCES "organizations" ("id") ON DELETE SET NULL,
  "accessed_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "organization_id" uuid REFERENCES "organizations" ("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "users_organization_id_idx" ON "users" ("organization_id");
