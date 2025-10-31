# RBAC 与组织 / 用户管理开发说明

本文档介绍 LobeChat 中角色权限体系（RBAC）以及组织 / 用户管理功能的代码位置和实现要点，帮助开发者快速定位相关逻辑并进行扩展。

## 1. 数据库层

### 1.1 迁移脚本

- `packages/database/migrations/0040_seed_rbac_roles.sql`
  - 初始化 `root`、`admin`、`user` 三个系统角色，以及 `system.manage`、`admin.manage`、`app.basic` 三项权限。
  - 建立角色与权限之间的映射关系，作为后续 RBAC 的基础数据。

- `packages/database/migrations/0041_add_organizations.sql`
  - 新增 `organizations` 表（支持 `parent_id` 自关联），以及 `users.organization_id` 外键。
  - 创建 `users_organization_id_idx` 索引以加速查询。

### 1.2 Schema & Model

- `packages/database/src/schemas/organization.ts`
  - 定义组织表结构，对外导出 `organizations`、`NewOrganization`、`OrganizationItem`。

- `packages/database/src/schemas/user.ts`
  - 增加 `organizationId` 字段引用 `organizations.id`，并留存偏好设置 `preference`。

- `packages/database/src/models/organization.ts`
  - 封装 `list`、`findById`、`create`、`update`、`delete`、`hasUsers` 等数据库操作，返回 `OrganizationItem` 实体。

## 2. 服务层

### 2.1 角色体系

- 核心常量：`src/const/rbac.ts`
  - 定义角色常量 `ROOT_ROLE` / `ADMIN_ROLE` / `USER_ROLE`，组织类型常量 `ORGANIZATION_TYPE_MANAGEMENT` / `ORGANIZATION_TYPE_SCHOOL`，以及对应的字面量类型。

- 角色服务：`src/server/services/role/index.ts`
  - 提供角色分配、撤销、查询等能力。

- NextAuth 会话扩展：
  - `src/libs/next-auth/auth.config.ts` 仅透传 `user.roles`。
  - `src/server/services/nextAuthUser/index.ts` 在登录过程中从数据库读取用户角色，填充 `session.user.roles`。

- tRPC 中间件：`src/libs/trpc/lambda/middleware/roleGuard.ts`
  - 通过 `requireRoles([...])` 对接口做硬编码权限校验，失败时返回 `401/403`。

### 2.2 组织服务

- `src/server/services/organization/index.ts`
  - 对外暴露组织管理方法（列表、创建、更新、删除），并限制组织类型仅为 `management` 或 `school`。

- `src/server/routers/lambda/organization.ts`
  - `list`：`root` 返回全部组织，`admin` 仅返回自身学校。
  - `create/update/delete`：仅 `root` 允许调用，创建管理层组织时保证唯一，删除前需确认组织下无用户。

### 2.3 用户管理服务

- `src/server/routers/lambda/adminUser.ts`
  - `list`：`root` 可查看全体用户；`admin` 只能查看本校且角色为学生 (`user`) 的用户。
  - `setOrganization`：`root` 可将任意用户移动到指定组织；`admin` 仅能管理本校学生，且不得跨校移动。
  - `setRole`：`root` 可分配任意角色；`admin` 仅能设置学生角色。
  - 内部依赖 `RoleService`、`OrganizationModel`、`UserModel` 进行数据操作。

## 3. 前端实现

- 页面位置：`src/app/[variants]/(main)/settings/management/index.tsx`
  - 设置页新增 “组织与用户” Tab（`SettingsTabs.Management`）。
  - **组织管理（仅 root 可见）**：通过表单创建学校组织、列表展示全部组织、支持重命名或删除（管理层类型锁定不可删）。
  - **用户管理（root/admin 可见）**：表格展示姓名 / 邮箱 / 角色 / 组织；可调整学生归属学校，root 可修改角色，admin 仅限学生角色。
  - 通过 `lambdaQuery.organization.*` 与 `lambdaQuery.adminUser.*` 调用后端接口，类型由 `inferRouterOutputs<LambdaRouter>` 推导。
  - 角色与组织类型文案映射在 `roleLabelMap` / `organizationTypeLabelMap`，并绑定多语言资源 `locales/en-US/setting.json`、`locales/zh-CN/setting.json`。

- 导航入口
  - 用户头像菜单：`src/features/User/UserPanel/useMenu.tsx` 指向 `/settings?tab=management`。
  - 设置侧边栏：`src/app/[variants]/(main)/settings/hooks/useCategory.tsx` 在用户拥有 `root/admin` 角色时展示该 Tab。

## 4. 验证要点

1. 确认数据库执行 `0040` 与 `0041` 迁移，确保角色 / 组织表存在且数据完整。
2. 登录用户需重新获取会话，以便 `session.user.roles` 包含最新角色信息。
3. 验证以下权限流程：
   - root：创建 / 重命名 / 删除组织，调整任意用户的组织与角色。
   - admin：仅能查看本校学生，占用 `setOrganization` / `setRole` 接口时不得越权。
   - user：无法访问 “组织与用户” Tab。

如需扩展角色或组织类型，请同步更新：
`packages/database/migrations` → `src/const/rbac.ts` → `src/server/routers` → `src/app/[variants]/(main)/settings/management/index.tsx`，以保持前后端逻辑一致。
