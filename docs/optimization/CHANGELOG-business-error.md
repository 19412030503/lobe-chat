# 管理模块业务异常处理优化

## 变更日期

2025-11-01

## 问题描述

管理模块在创建用户、组织、设置额度等操作中，遇到业务问题时会抛出技术性错误，而非用户友好的提示。例如：

- 用户已存在时报错而非提示
- 删除有用户的组织时报错而非提示
- 组织达到用户数上限时报错而非提示

## 解决方案

### 1. 新增统一的业务错误处理工具

- 文件：`src/server/utils/businessError.ts`
- 功能：提供标准化的业务错误创建函数
- 错误类型：26 种常见业务错误场景
- 错误消息：全部使用用户友好的中文

### 2. 优化服务层

- `OrganizationService`: 所有业务异常使用友好提示
  - 组织名称为空 → "组织名称不能为空"
  - 组织有用户 → "组织内还有用户，无法删除"
  - 等...

### 3. 优化路由层

- `adminUser` 路由：优化所有用户管理相关接口
  - createUser: 用户名 / 邮箱已存在 → 友好提示
  - setOrganization: 权限 / 组织限制 → 友好提示
  - setQuota: 额度管理错误 → 友好提示
  - setRole: 角色管理错误 → 友好提示
  - toggleUserStatus: 状态管理错误 → 友好提示

- `organization` 路由：优化组织管理相关接口
  - create: 管理组织已存在 → "管理组织已存在"

### 4. 新增测试

- 文件：`src/server/utils/__tests__/businessError.test.ts`
- 覆盖所有错误工具函数
- 验证消息为中文且用户友好

## 影响文件

- ✅ `src/server/utils/businessError.ts` (新增)
- ✅ `src/server/utils/__tests__/businessError.test.ts` (新增)
- ✅ `src/server/services/organization/index.ts` (优化)
- ✅ `src/server/routers/lambda/organization.ts` (优化)
- ✅ `src/server/routers/lambda/adminUser.ts` (优化)
- ✅ `docs/optimization/business-error-handling.md` (文档)

## 效果对比

### 优化前

```
TRPCError: Organization has users and cannot be deleted
```

### 优化后

```
组织内还有用户，无法删除
```

## 技术细节

- 使用 TypeScript 枚举管理错误类型
- 统一错误消息映射表
- 支持自定义错误消息（动态参数）
- HTTP 状态码正确映射（400/403/404/500）

## 测试验证

- ✅ 类型检查通过
- ✅ 单元测试覆盖
- ✅ 前端正常显示友好错误消息

## 后续改进建议

1. 将错误处理机制推广到其他业务模块
2. 考虑接入 i18n 支持多语言
3. 为关键错误添加日志追踪
