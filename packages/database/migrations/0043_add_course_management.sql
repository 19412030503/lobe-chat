-- 创建课程分类表
CREATE TABLE IF NOT EXISTS "course_categories" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "sort_order" integer DEFAULT 0,
  "user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "organization_id" uuid REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "is_public" boolean DEFAULT false,
  "client_id" text,
  "metadata" jsonb,
  "accessed_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- 创建课程文件表
CREATE TABLE IF NOT EXISTS "course_files" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "file_type" varchar(255) NOT NULL,
  "size" integer NOT NULL,
  "url" text NOT NULL,
  "category_id" text NOT NULL REFERENCES "course_categories" ("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "organization_id" uuid REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "is_public" boolean DEFAULT false,
  "description" text,
  "download_count" integer DEFAULT 0,
  "client_id" text,
  "metadata" jsonb,
  "accessed_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- 创建索引
CREATE UNIQUE INDEX IF NOT EXISTS "course_categories_client_id_user_id_unique" ON "course_categories" ("client_id", "user_id");
CREATE INDEX IF NOT EXISTS "course_categories_organization_idx" ON "course_categories" ("organization_id");

CREATE INDEX IF NOT EXISTS "course_files_category_idx" ON "course_files" ("category_id");
CREATE INDEX IF NOT EXISTS "course_files_organization_idx" ON "course_files" ("organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "course_files_client_id_user_id_unique" ON "course_files" ("client_id", "user_id");
