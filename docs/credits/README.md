# 额度管理开发与配置指南

## 概述

新的额度体系围绕 “组织 + 成员” 双层积分控制：组织充值积分，成员按个人额度消费。以下内容梳理当前实现、重点代码路径以及后续工作。

## 1. 已完成的开发内容

### 1.1 数据结构与迁移

- Schema 文件：`packages/database/src/schemas/modelCredit.ts`
  - `modelCredits`：组织积分余额（`organization_id: uuid`）
  - `memberQuotas`：成员额度记录（`limit/used/period`）
  - `modelUsages`：一次调用的真实用量与积分成本
  - `modelCreditTransactions`：积分流水（充值 / 扣减）
- 数据模型：`packages/database/src/models/modelCredit.ts`
  - 提供在事务内的余额调整、额度更新、流水写入等方法。
- 迁移脚本：`packages/database/migrations/0044_add_model_credits.sql`
  - 创建上述四张表及索引；注意 `organization_id` 类型为 `uuid`。
  - 执行命令：`pnpm db:migrate`（需确保 `DATABASE_URL` 指向目标数据库）。

### 1.2 积分服务层

- 主服务：`src/server/services/modelCredit/index.ts`
  - `ModelCreditService` 提供 `ensureAllowance`、`charge`、`rechargeOrganization`、`setOrganizationBalance`、`setMemberQuotaLimit`、`resetMemberUsage` 等方法。
  - 自定义错误 `ModelCreditError`（`USER_ORGANIZATION_REQUIRED`、`ORGANIZATION_CREDIT_INSUFFICIENT`、`MEMBER_QUOTA_EXCEEDED`）。
- 积分估算：`src/server/services/modelCredit/creditCalculator.ts`
  - 文本：`estimateTextCredits` / `calculateTextCreditsFromUsage`
  - 图片：`calculateImageCredits`
  - 3D：`calculateThreeDCredits`
- 定价解析：`src/server/services/modelCredit/pricing.ts`
  - `createAiInfraRepos`、`resolveModelPricing` 根据默认配置 + 用户数据获取模型定价。

### 1.3 调用链接入

- 文本聊天：`src/app/(backend)/webapi/chat/[provider]/route.ts`
  - 请求 -> 估算积分 -> `ensureAllowance` -> 调用模型 -> `charge`（根据真实 usage 扣费）。
- 文本转图：`src/app/(backend)/webapi/text-to-image/[provider]/route.ts`
  - 同上，但按生成张数计费。
- 3D 生成：`src/server/routers/lambda/threeD.ts`
  - `convertModel`、`createModel` 内校验额度并扣减积分。
- 错误码扩展：
  - `packages/types/src/fetch.ts`：新增 `OrganizationCreditInsufficient`、`MemberQuotaExceeded`、`UserOrganizationRequired`。
  - `src/utils/errorResponse.ts`：映射到 HTTP 状态码（402/403/429）。

### 1.4 管理端接口

- 组织管理：`src/server/routers/lambda/organization.ts`
  - 新增 `setCredit`（Root 专用）调用 `ModelCreditService.setOrganizationBalance`。
- 成员管理：`src/server/routers/lambda/adminUser.ts`
  - 新增 `setQuota`（Root/Admin），限制只能调整本组织成员。

### 1.5 定价配置来源

- 全局模型卡：`packages/model-bank/src/aiModels/*`
  - 定义模型能力、参数 schema、默认定价，供生态共用。
- 应用默认配置：`src/config/modelProviders/*`
  - 控制默认启用的供应商 / 模型、展示文案、定价等。
- 合并逻辑：`packages/database/src/repositories/aiInfra/index.ts`
  - 默认列表与用户自定义模型按 ID 合并，用户调整优先。

## 2. 未完成 / 后续工作

1. **前端管理页**
   - 设置页展示组织余额、成员额度，提供调整入口。
   - 处理新错误码在前端的提示（余额不足、额度用尽、需要绑定组织等）。

2. **失败返还与运维脚本（可选）**
   - 提供失败后返还积分的逻辑和运维手册。
   - 记录和监控积分流水，以便审计。

## 3. 定价与默认启用说明

- 修改默认启用的供应商 / 模型：更新 `src/config/modelProviders/<provider>.ts` 中的 `enabled` 字段及排序。
- 调整默认定价：
  - 修改 `modelProviders` 中的 `pricing` 字段或直接更新数据库 `ai_models.pricing`。
  - 若模型没有定价，积分估算会 fallback 到默认值（文本 1 积分 / 图片 5 / 3D 10，可在 `creditCalculator` 调整）。
- 用户自建模型与系统默认：用户调整优先，不会被默认配置覆盖；默认用于初始化和补全缺失项。

## 4. 常见错误排查

- `USER_ORGANIZATION_REQUIRED`：用户未绑定组织 → 给 `users.organization_id` 设置值。
- `OrganizationCreditInsufficient`：组织余额不足 → `setCredit` 或 `rechargeOrganization` 充值。
- `MemberQuotaExceeded`：个人额度耗尽 → `setQuota` 提高限额或将 `limit` 改为 `null`。
- 外键类型不匹配：确保 `organization_id` 字段使用 `uuid`，与 `organizations.id` 一致。

## 5. 运行命令汇总

- 执行迁移：`pnpm db:migrate`
- 启动开发服：`pnpm dev`
- 迁移期间出错（如已有测试表冲突）：在数据库里 `DROP TABLE model_credits, member_quotas, model_usage, model_credit_transactions;` 后重新迁移。

## 6. 代码索引一览

- 数据表结构：`packages/database/src/schemas/modelCredit.ts`
- 数据模型：`packages/database/src/models/modelCredit.ts`
- 迁移脚本：`packages/database/migrations/0044_add_model_credits.sql`
- 积分服务：`src/server/services/modelCredit/index.ts`
- 积分估算：`src/server/services/modelCredit/creditCalculator.ts`
- 定价获取：`src/server/services/modelCredit/pricing.ts`
- 调用链路更新：
  - Chat：`src/app/(backend)/webapi/chat/[provider]/route.ts`
  - Text-to-Image：`src/app/(backend)/webapi/text-to-image/[provider]/route.ts`
  - 3D：`src/server/routers/lambda/threeD.ts`
- 错误码扩展：
  - 类型：`packages/types/src/fetch.ts`
  - 映射：`src/utils/errorResponse.ts`
- 管理接口：
  - `src/server/routers/lambda/organization.ts`
  - `src/server/routers/lambda/adminUser.ts`
- 默认模型配置：
  - `packages/model-bank/src/aiModels/*`
  - `src/config/modelProviders/*`
  - `packages/database/src/repositories/aiInfra/index.ts`

---
