CREATE TABLE IF NOT EXISTS "invite_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text UNIQUE NOT NULL,
  "creator_id" text NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "organization_id" uuid REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "expires_at" timestamptz NOT NULL,
  "used_at" timestamptz,
  "used_by" text REFERENCES "users" ("id") ON DELETE SET NULL,
  "accessed_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "invite_codes_code_idx" ON "invite_codes" ("code");
CREATE INDEX IF NOT EXISTS "invite_codes_creator_id_idx" ON "invite_codes" ("creator_id");
CREATE INDEX IF NOT EXISTS "invite_codes_organization_id_idx" ON "invite_codes" ("organization_id");
