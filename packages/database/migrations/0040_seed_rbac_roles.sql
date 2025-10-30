-- Seed default RBAC roles and permissions

INSERT INTO "rbac_roles" (
  "name",
  "display_name",
  "description",
  "is_system",
  "is_active",
  "metadata"
)
VALUES
  (
    'root',
    '系统超级管理员',
    '拥有全部系统权限的顶级角色',
    TRUE,
    TRUE,
    jsonb_build_object('inherits', ARRAY['admin', 'user'])
  ),
  (
    'admin',
    '系统管理员',
    '可访问后台管理能力的角色',
    TRUE,
    TRUE,
    jsonb_build_object('inherits', ARRAY['user'])
  ),
  (
    'user',
    '基础用户',
    '拥有基础产品功能访问权限的角色',
    TRUE,
    TRUE,
    '{}'::jsonb
  )
ON CONFLICT ("name") DO UPDATE
SET
  "display_name" = EXCLUDED."display_name",
  "description" = EXCLUDED."description",
  "is_system" = EXCLUDED."is_system",
  "is_active" = EXCLUDED."is_active",
  "metadata" = EXCLUDED."metadata",
  "updated_at" = NOW();

INSERT INTO "rbac_permissions" (
  "code",
  "name",
  "description",
  "category",
  "is_active"
)
VALUES
  (
    'system.manage',
    '系统管理',
    '访问系统级配置与运维能力',
    'system',
    TRUE
  ),
  (
    'admin.manage',
    '后台管理',
    '访问后台管理控制台功能',
    'admin',
    TRUE
  ),
  (
    'app.basic',
    '基础功能',
    '访问产品基础功能',
    'application',
    TRUE
  )
ON CONFLICT ("code") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "is_active" = EXCLUDED."is_active",
  "updated_at" = NOW();

-- Map roles to permissions (idempotent)
INSERT INTO "rbac_role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "rbac_roles" AS r
CROSS JOIN "rbac_permissions" AS p
WHERE r."name" = 'root' AND p."code" IN ('system.manage', 'admin.manage', 'app.basic')
ON CONFLICT DO NOTHING;

INSERT INTO "rbac_role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "rbac_roles" AS r
CROSS JOIN "rbac_permissions" AS p
WHERE r."name" = 'admin' AND p."code" IN ('admin.manage', 'app.basic')
ON CONFLICT DO NOTHING;

INSERT INTO "rbac_role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "rbac_roles" AS r
CROSS JOIN "rbac_permissions" AS p
WHERE r."name" = 'user' AND p."code" = 'app.basic'
ON CONFLICT DO NOTHING;
