CREATE TABLE IF NOT EXISTS "model_credits" (
    "id" text PRIMARY KEY,
    "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
    "balance" integer NOT NULL DEFAULT 0,
    "metadata" jsonb,
    "accessed_at" timestamp with time zone NOT NULL DEFAULT now(),
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "model_credits_organization_unique"
    ON "model_credits" ("organization_id");

CREATE TABLE IF NOT EXISTS "member_quotas" (
    "id" text PRIMARY KEY,
    "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
    "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
    "limit" integer,
    "used" integer NOT NULL DEFAULT 0,
    "period" varchar(32) NOT NULL DEFAULT 'total',
    "metadata" jsonb,
    "accessed_at" timestamp with time zone NOT NULL DEFAULT now(),
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "member_quotas_org_user_unique"
    ON "member_quotas" ("organization_id", "user_id");

CREATE INDEX IF NOT EXISTS "member_quotas_organization_idx"
    ON "member_quotas" ("organization_id");

CREATE INDEX IF NOT EXISTS "member_quotas_user_idx"
    ON "member_quotas" ("user_id");

CREATE TABLE IF NOT EXISTS "model_usage" (
    "id" text PRIMARY KEY,
    "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
    "user_id" text REFERENCES "users"("id") ON DELETE set null,
    "usage_type" varchar(32) NOT NULL,
    "model" text,
    "provider" text,
    "input_tokens" integer,
    "output_tokens" integer,
    "total_tokens" integer,
    "count_used" integer,
    "credit_cost" integer NOT NULL,
    "metadata" jsonb,
    "accessed_at" timestamp with time zone NOT NULL DEFAULT now(),
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "model_usage_organization_idx"
    ON "model_usage" ("organization_id");

CREATE INDEX IF NOT EXISTS "model_usage_user_idx"
    ON "model_usage" ("user_id");

CREATE INDEX IF NOT EXISTS "model_usage_type_idx"
    ON "model_usage" ("usage_type");

CREATE TABLE IF NOT EXISTS "model_credit_transactions" (
    "id" text PRIMARY KEY,
    "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
    "user_id" text REFERENCES "users"("id") ON DELETE set null,
    "usage_id" text REFERENCES "model_usage"("id") ON DELETE set null,
    "delta" integer NOT NULL,
    "balance_after" integer,
    "reason" varchar(64),
    "metadata" jsonb,
    "accessed_at" timestamp with time zone NOT NULL DEFAULT now(),
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "model_credit_transactions_org_idx"
    ON "model_credit_transactions" ("organization_id");

CREATE INDEX IF NOT EXISTS "model_credit_transactions_user_idx"
    ON "model_credit_transactions" ("user_id");

CREATE INDEX IF NOT EXISTS "model_credit_transactions_usage_idx"
    ON "model_credit_transactions" ("usage_id");
