# 用户管理功能增强文档

## 功能概述

本次更新为 LobeChat 的用户管理模块添加了以下功能：

1. **超级管理员组织筛选**：超级管理员可以通过下拉框筛选不同组织的用户
2. **学校管理员权限控制**：学校管理员只能查看和管理本组织的用户（后端已实现）
3. **新增用户功能**：支持创建新用户并同步到 Casdoor
4. **禁用 / 启用用户功能**：支持禁用和启用用户账号（对接 Casdoor API）

## 技术实现

### 1. 后端实现

#### 1.1 Casdoor 服务层

**文件**: `src/server/services/casdoor.ts`

创建了 `CasdoorService` 类，封装了与 Casdoor 的交互：

- `createUser()`: 在 Casdoor 创建用户
- `updateUser()`: 更新用户信息
- `disableUser()`: 禁用用户
- `enableUser()`: 启用用户
- `deleteUser()`: 删除用户
- `getUser()`: 获取用户信息

**依赖**: 安装了 `casdoor-nodejs-sdk@1.31.0`

#### 1.2 tRPC API 端点

**文件**: `src/server/routers/lambda/adminUser.ts`

新增了两个 mutation：

##### `createUser`

```typescript
lambdaQuery.adminUser.createUser.useMutation({
  email: string,
  name: string,
  password: string,
  displayName?: string,
  organizationId?: string | null
})
```

**权限控制**:

- 超级管理员：可以为任意组织创建用户
- 学校管理员：只能为自己所在的组织创建用户

**流程**:

1. 验证权限和组织
2. 在 Casdoor 创建用户
3. 在本地数据库创建用户记录
4. 分配默认角色（学生）
5. 返回用户摘要

##### `toggleUserStatus`

```typescript
lambdaQuery.adminUser.toggleUserStatus.useMutation({
  userId: string,
  isForbidden: boolean,
});
```

**权限控制**:

- 超级管理员：可以禁用 / 启用任意用户
- 学校管理员：只能禁用 / 启用本组织的学生用户

**流程**:

1. 验证权限
2. 检查目标用户
3. 调用 Casdoor API 更新状态
4. 返回更新后的用户摘要

### 2. 前端实现

#### 2.1 用户管理界面

**文件**: `src/app/[variants]/(main)/management/users/index.tsx`

**新增功能**:

1. **组织筛选器（仅超级管理员可见）**
   - 位置：页面标题栏右侧
   - 组件：`<Select>` 下拉框
   - 功能：筛选显示特定组织的用户

2. **新增用户按钮**
   - 位置：页面标题栏右侧
   - 点击：打开新增用户弹窗

3. **新增用户弹窗**
   - 表单字段：
     - 用户名（必填）
     - 邮箱（必填，需验证格式）
     - 密码（必填，至少 6 位）
     - 显示名称（可选）
     - 所属组织（超级管理员可选，学校管理员自动设置）

4. **用户操作列**
   - 每行显示 "禁用用户"/"启用用户" 按钮
   - 点击时弹出确认对话框
   - 操作完成后刷新列表

**状态管理**:

```typescript
const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
const [filterOrganizationId, setFilterOrganizationId] = useState<string | null>(null);
const [form] = Form.useForm();
```

**数据筛选**:

```typescript
const filteredUsers = useMemo(() => {
  if (!users) return [];
  if (!isRoot || !filterOrganizationId) return users;
  return users.filter((user) => user.organization?.id === filterOrganizationId);
}, [users, filterOrganizationId, isRoot]);
```

#### 2.2 国际化翻译

**文件**: `src/locales/default/setting.ts`

新增的翻译键：

```typescript
management: {
  actions: {
    createUser: '新增用户',
    disableUser: '禁用用户',
    enableUser: '启用用户',
  },
  columns: {
    status: '状态',
  },
  dialogs: {
    createUser: {
      title: '新增用户',
    },
    disableUser: {
      content: '确认禁用用户「{{name}}」？禁用后用户将无法登录。',
      title: '禁用用户',
    },
    enableUser: {
      content: '确认启用用户「{{name}}」？',
      title: '启用用户',
    },
  },
  fields: {
    organization: {
      all: '全部组织',
    },
    user: {
      displayName: '显示名称',
      email: '邮箱',
      name: '用户名',
      password: '密码',
    },
  },
  filters: {
    organizationLabel: '筛选组织',
  },
  messages: {
    userCreated: '用户创建成功',
    userDisabled: '用户已禁用',
    userEnabled: '用户已启用',
  },
  placeholders: {
    userDisplayName: '请输入显示名称',
    userEmail: '请输入邮箱',
    userName: '请输入用户名',
    userPassword: '请输入密码（至少6位）',
  },
  status: {
    active: '正常',
    disabled: '已禁用',
  },
  validation: {
    userEmail: '请输入有效的邮箱地址',
    userName: '请输入用户名',
    userPassword: '密码至少需要6位',
  },
}
```

## 环境配置

确保 `.env` 文件包含以下 Casdoor 配置：

```env
# Casdoor Configuration
AUTH_CASDOOR_ISSUER=https://casdoor.frp2.rundev.run
AUTH_CASDOOR_ID=your-client-id
AUTH_CASDOOR_SECRET=your-client-secret
```

## 使用说明

### 超级管理员

1. 访问 `/management` 页面
2. 点击 "用户管理" 标签
3. 使用组织筛选器查看特定组织的用户
4. 点击 "新增用户" 按钮创建新用户
5. 在任意用户行点击 "禁用用户" 或 "启用用户"

### 学校管理员

1. 访问 `/management` 页面
2. 点击 "用户管理" 标签
3. 自动显示本组织的学生用户
4. 点击 "新增用户" 按钮为本组织创建新学生
5. 在学生行点击 "禁用用户" 或 "启用用户"

## 权限矩阵

| 功能                  | 超级管理员 | 学校管理员 | 普通用户 |
| --------------------- | ---------- | ---------- | -------- |
| 查看所有组织用户      | ✅         | ❌         | ❌       |
| 查看本组织用户        | ✅         | ✅         | ❌       |
| 筛选组织              | ✅         | ❌         | ❌       |
| 创建任意组织用户      | ✅         | ❌         | ❌       |
| 创建本组织学生        | ✅         | ✅         | ❌       |
| 禁用 / 启用任意用户   | ✅         | ❌         | ❌       |
| 禁用 / 启用本组织学生 | ✅         | ✅         | ❌       |

## 注意事项

1. **用户状态同步**: 当前用户禁用状态的显示需要从 Casdoor 实时获取，目前代码中是硬编码的 `isForbidden = false`。后续可以通过调用 `casdoorService.getUser()` 获取实际状态。

2. **错误处理**: 所有 Casdoor API 调用都包含错误捕获，会显示友好的中文错误信息。

3. **密码安全**: 用户创建时的密码会直接传递给 Casdoor，不会在本地数据库存储明文密码。

4. **UUID 生成**: 使用 Node.js 的 `randomUUID()` 生成用户 ID，确保唯一性。

5. **角色分配**: 新创建的用户默认分配 "学生" 角色，管理员可以后续通过 "角色" 下拉框修改。

## 测试建议

1. **超级管理员测试**:
   - 创建不同组织的用户
   - 使用组织筛选器切换查看
   - 禁用和启用用户
   - 验证权限边界

2. **学校管理员测试**:
   - 确认只能看到本组织用户
   - 创建本组织学生
   - 尝试操作其他组织用户（应该被拒绝）
   - 禁用和启用本组织学生

3. **错误场景测试**:
   - 创建重复邮箱用户
   - 密码少于 6 位
   - Casdoor 服务不可用时的错误提示
   - 网络错误处理

## 未来优化方向

1. 实现用户状态的实时显示（从 Casdoor 获取）
2. 添加批量操作功能（批量禁用 / 启用）
3. 添加用户搜索功能（按姓名、邮箱搜索）
4. 添加用户详情查看和编辑弹窗
5. 添加用户删除功能
6. 添加用户导入 / 导出功能
7. 优化移动端体验

## 更新日志

**日期**: 2025-10-31

**变更**:

- ✅ 安装 `casdoor-nodejs-sdk`
- ✅ 创建 `CasdoorService` 服务层
- ✅ 添加 `adminUser.createUser` API
- ✅ 添加 `adminUser.toggleUserStatus` API
- ✅ 前端添加组织筛选器
- ✅ 前端添加新增用户功能
- ✅ 前端添加禁用 / 启用用户功能
- ✅ 添加完整的国际化翻译
- ✅ 更新权限控制逻辑
