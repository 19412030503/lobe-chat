# 管理模块业务异常处理优化文档

## 优化概述

本次优化针对管理模块（用户、组织、额度管理）中的异常处理进行了全面改进，确保业务异常以友好的中文提示而非技术错误的形式返回给用户。

## 核心改进

### 1. 统一的业务错误工具 (`src/server/utils/businessError.ts`)

创建了一个集中化的业务错误处理工具，提供以下功能：

#### 业务错误类型枚举 (`BusinessErrorType`)

定义了 26 种常见的业务错误类型，涵盖：

- **用户相关**：用户已存在、用户名已存在、邮箱已存在等
- **组织相关**：组织不存在、组织有用户无法删除、达到最大用户数等
- **额度相关**：额度超限、余额不足等
- **权限相关**：权限不足、无权管理用户、只能管理学生等

#### 工具函数

- `createBusinessError(type, customMessage?)`: 创建业务错误（BAD_REQUEST）
- `createPermissionError(customMessage?)`: 创建权限错误（FORBIDDEN）
- `createNotFoundError(resourceName)`: 创建资源未找到错误（NOT_FOUND）
- `createInternalError(customMessage?)`: 创建内部服务器错误（INTERNAL_SERVER_ERROR）

### 2. 服务层优化

#### OrganizationService (`src/server/services/organization/index.ts`)

**优化前**：

```typescript
throw new TRPCError({ code: 'BAD_REQUEST', message: 'Organization name is required' });
```

**优化后**：

```typescript
throw createBusinessError(BusinessErrorType.ORGANIZATION_NAME_REQUIRED);
```

**改进点**：

- 统一错误消息为中文
- 错误类型集中管理
- 消息更加用户友好

优化的场景：

- ✅ 组织名称为空 → "组织名称不能为空"
- ✅ 组织类型不支持 → "不支持的组织类型"
- ✅ 组织不存在 → "组织不存在"
- ✅ 管理组织类型不可修改 → "管理组织类型不能修改"
- ✅ 组织有用户无法删除 → "组织内还有用户，无法删除"
- ✅ 管理组织不能删除 → "管理组织不能删除"

### 3. 路由层优化

#### adminUser 路由 (`src/server/routers/lambda/adminUser.ts`)

优化了以下接口的错误处理：

##### createUser - 创建用户

- ✅ 用户名已存在 → "用户名已存在"
- ✅ 邮箱已存在 → "邮箱已存在"
- ✅ 用户名在认证系统中已存在 → "用户名在认证系统中已存在"
- ✅ 组织不存在 → "组织不存在"
- ✅ 组织已达用户数上限 → "组织已达到最大用户数量限制（N 人）"
- ✅ 管理员必须属于组织 → "管理员必须属于某个组织"
- ✅ 权限不足 → "权限不足"

##### setOrganization - 设置用户组织

- ✅ 用户不存在 → "用户不存在"
- ✅ 组织不存在 → "组织不存在"
- ✅ 无权管理其他组织 → "无权管理其他组织"
- ✅ 只能管理学生 → "只能管理学生用户"
- ✅ 不能将学生移到其他组织 → "不能将学生移动到本组织之外"
- ✅ 组织已达用户数上限 → "组织已达到最大用户数量限制（N 人）"

##### setQuota - 设置用户额度

- ✅ 用户不存在 → "用户不存在"
- ✅ 无权修改其他组织额度 → "无权修改其他组织的额度"
- ✅ 用户不属于指定组织 → "用户不属于指定组织"

##### setRole - 设置用户角色

- ✅ 用户不存在 → "用户不存在"
- ✅ 学校管理员只能分配学生角色 → "学校管理员只能分配学生角色"
- ✅ 只有超级管理员可以分配超级管理员角色 → "只有超级管理员可以分配超级管理员角色"
- ✅ 无权管理该用户 → "无权管理该用户"

##### toggleUserStatus - 启用 / 禁用用户

- ✅ 用户不存在 → "用户不存在"
- ✅ 无权管理该用户 → "无权管理该用户"
- ✅ 只能管理学生 → "只能管理学生用户"

#### organization 路由 (`src/server/routers/lambda/organization.ts`)

优化的场景：

- ✅ 管理组织已存在 → "管理组织已存在"

## 前端体验

前端已经实现了统一的错误处理机制：

```typescript
try {
  await createUserMutation.mutateAsync(...);
  messageApi.success(t('management.messages.userCreated'));
} catch (error: any) {
  messageApi.error(error?.message ?? t('management.messages.operationFailed'));
}
```

由于后端已经返回友好的中文错误消息，前端会直接显示这些消息，用户体验得到显著提升。

## 错误分类与 HTTP 状态码映射

| 错误类型                    | HTTP 状态码  | 用途                       | 示例                               |
| --------------------------- | ------------ | -------------------------- | ---------------------------------- |
| BAD_REQUEST (400)           | 业务逻辑错误 | 用户输入错误、业务规则违反 | 用户已存在、组织有用户无法删除     |
| UNAUTHORIZED (401)          | 未认证       | 用户未登录                 | -                                  |
| FORBIDDEN (403)             | 权限不足     | 用户无权执行操作           | 无权管理其他组织、只能管理学生     |
| NOT_FOUND (404)             | 资源不存在   | 请求的资源未找到           | 用户不存在、组织不存在             |
| INTERNAL_SERVER_ERROR (500) | 服务器错误   | 系统内部错误               | 数据库操作失败、第三方服务调用失败 |

## 设计原则

1. **用户友好**：所有错误消息使用中文，避免技术术语
2. **语义清晰**：错误消息准确描述问题，帮助用户理解并解决
3. **集中管理**：错误类型和消息统一定义，便于维护
4. **类型安全**：使用 TypeScript 枚举，编译时检查错误类型
5. **可扩展性**：易于添加新的业务错误类型

## 测试覆盖

创建了完整的单元测试 (`src/server/utils/__tests__/businessError.test.ts`)：

- ✅ 测试所有工具函数
- ✅ 验证错误码和消息
- ✅ 确保消息为中文且用户友好
- ✅ 检查消息中不包含技术术语

## 使用示例

### 创建业务错误

```typescript
// 使用默认消息
throw createBusinessError(BusinessErrorType.USER_ALREADY_EXISTS);
// 输出: "用户已存在"

// 使用自定义消息（带动态参数）
throw createBusinessError(
  BusinessErrorType.ORGANIZATION_MAX_USERS_REACHED,
  `组织已达到最大用户数量限制（${maxUsers}人）`,
);
```

### 创建权限错误

```typescript
// 使用默认消息
throw createPermissionError();
// 输出: "权限不足"

// 使用自定义消息
throw createPermissionError('无权访问此资源');
```

### 创建资源未找到错误

```typescript
throw createNotFoundError('用户');
// 输出: "用户不存在"

throw createNotFoundError('组织');
// 输出: "组织不存在"
```

### 创建内部错误

```typescript
// 使用默认消息
throw createInternalError();
// 输出: "操作失败，请稍后重试"

// 使用自定义消息
throw createInternalError('创建用户失败');
```

## 迁移指南

如果需要在其他模块中使用统一的错误处理：

1. 导入错误工具：

```typescript
import {
  BusinessErrorType,
  createBusinessError,
  createInternalError,
  createNotFoundError,
  createPermissionError,
} from '@/server/utils/businessError';
```

2. 替换原有的 `TRPCError`：

```typescript
// 替换前
throw new TRPCError({ code: 'BAD_REQUEST', message: 'User already exists' });

// 替换后
throw createBusinessError(BusinessErrorType.USER_ALREADY_EXISTS);
```

3. 如需新增错误类型，在 `BusinessErrorType` 枚举中添加，并在 `businessErrorMessages` 中提供对应的中文消息。

## 影响范围

本次优化影响的文件：

- ✅ `src/server/utils/businessError.ts` - 新增
- ✅ `src/server/utils/__tests__/businessError.test.ts` - 新增
- ✅ `src/server/services/organization/index.ts` - 优化
- ✅ `src/server/routers/lambda/organization.ts` - 优化
- ✅ `src/server/routers/lambda/adminUser.ts` - 优化

## 后续建议

1. **扩展到其他模块**：将统一的错误处理机制推广到其他业务模块
2. **国际化支持**：考虑将错误消息接入 i18n 系统，支持多语言
3. **错误码标准化**：可以考虑为每个业务错误分配唯一的错误码，便于问题追踪
4. **监控与日志**：在关键错误点添加日志，便于问题排查

## 总结

通过本次优化，管理模块的所有业务异常都已转换为用户友好的中文提示，不再出现技术性的报错信息。用户在操作过程中能够清楚地了解问题所在，大大提升了系统的可用性和用户体验。
