# LobeChat 认证与 API Key 配置梳理

## 1. 身份验证实现概览

- LobeChat 采用 Auth.js v5（NextAuth）作为核心身份验证方案，具体接入流程可参考 `docs/development/basic/add-new-authentication-providers.zh-CN.mdx`。文档中详述了新增 OAuth 提供商所需的前后端改动及回调数据处理顺序 `authorize → jwt → session`。
- 身份验证的运行配置集中在 `src/libs/next-auth/auth.config.ts`：
  - `initSSOProviders()` 会依据 `NEXT_AUTH_SSO_PROVIDERS` （逗号或顿号分隔）过滤合法的 SSO 提供商。
  - `callbacks.jwt` / `callbacks.session` 负责把用户 ID 同步到 JWT 与 session；在未启用数据库会话时默认写入 `token.userId`。
  - `adapter` 在启用服务端数据库（`NEXT_PUBLIC_ENABLED_SERVER_SERVICE=1`）时加载自定义的 `LobeNextAuthDbAdapter()`，通过 HTTP 调用将数据库操作委托给 `/api/auth/adapter`。
- Next.js 路由层通过 `src/app/(backend)/api/auth/[...nextauth]/route.ts` 暴露 `GET/POST` handler，直接复用 `NextAuth(authConfig)` 的输出。
- 相关环境变量汇总于 `src/envs/auth.ts`，支持 Auth0、Azure、Okta 等多家 SSO 服务，并提供迁移旧变量的警告逻辑。
- 自托管文档 `docs/self-hosting/advanced/auth.zh-CN.mdx` 指明 `NEXT_PUBLIC_ENABLE_NEXT_AUTH`、`NEXT_AUTH_SECRET`、`NEXTAUTH_URL`、`NEXT_AUTH_SSO_PROVIDERS` 等关键参数的含义及多提供商启用方式。

## 2. 会话持久化策略与表结构

- 默认情况下（`NEXT_PUBLIC_ENABLED_SERVER_SERVICE` 关闭或 `NEXT_AUTH_SSO_SESSION_STRATEGY` 维持 `jwt`），Auth.js 只在浏览器侧写入签名 Cookie（`next-auth.session-token` / `__Secure-*`），不会落库。
- 当开启服务端数据库并将 `NEXT_AUTH_SSO_SESSION_STRATEGY` 设为 `database` 时，`LobeNextAuthDbAdapter` 会调用 `/api/auth/adapter`，由 `src/server/services/nextAuthUser` 完成 CRUD 操作：
  - `nextauthSessions`：存储 `sessionToken`、`expires`、`userId`，用于远程登出等场景。
  - `nextauthAccounts`：以 `(provider, providerAccountId)` 为主键，维系外部账号与 LobeChat 用户的映射。
  - `nextauthAuthenticators`：保存 WebAuthn/Passkey 凭证信息（计数器、设备类型、公共密钥等）。
  - `nextauthVerificationTokens`：一次性验证令牌表，记录 `identifier` 与 `token`。
    以上表结构可在 `packages/database/src/schemas/nextauth.ts` 与 `docs/development/database-schema.dbml` 中查阅，均设置了 `userId` 外键并启用级联删除。
- 新用户首登时，`NextAuthUserService.createUser()` 会尝试复用 `providerAccountId` 作为本地 `users.id`，若不存在则创建用户并初始化 Inbox 会话。

## 3. API Key 配置与存储模式

- 项目级（全局）API Key 通过环境变量注入，`docs/self-hosting/environment-variables/model-provider.zh-CN.mdx` 对各提供商的变量进行枚举。`src/envs/llm.ts` 利用 `createEnv` 统一解析这些变量，并在服务端生成默认的 Provider 配置。
- 用户级（个性化）API Key 与 endpoint 保存于 `settings.keyVaults`：
  - `docs/self-hosting/advanced/settings-url-share.zh-CN.mdx` 说明了 `keyVaults` 的结构与导入导出格式，支持多家云厂商（OpenAI、Azure、Bedrock 等）。
  - 服务端在写入数据库前通过 `KEY_VAULTS_SECRET` 加密敏感字段（`docs/self-hosting/server-database.zh-CN.mdx`）。
  - 数据库层的 `AiProviderModel` / `AiInfraRepos` 负责持久化与解密操作，合并默认配置与用户配置。

## 4. API Key 优先级策略

- 服务端生成运行时配置时，会按以下顺序合并：
  1. **项目级默认值**：`genServerAiProvidersConfig` 将环境变量解析为 `providerConfigs`，包括 `enabled`、`serverModelLists`、`enabledModels` 等字段。
  2. **用户配置**：`packages/database/src/repositories/aiInfra/index.ts` 在加载 `aiProviders` 表数据后，与上述 `providerConfigs` 进行深度合并（`merge(this.providerConfigs[key] || {}, value)`）。若用户在 `keyVaults` 中提供了 `apiKey`/`baseURL`，将覆盖项目级设置。
  3. **客户端请求**：`src/services/_auth.ts` 与 `clientApiKeyManager` 会优先读取用户配置（支持多 Key 轮询），若为空则回退到项目级设置，再构造 TRPC 头部或 XOR payload。
- 综上，用户自填的 API Key 拥有最高优先级；当用户未提供时，系统才会使用环境变量中的项目级凭证；两者均为空时会提示缺少密钥。

## 5. 参考路径汇总

- 文档：
  - `docs/development/basic/add-new-authentication-providers.zh-CN.mdx`
  - `docs/self-hosting/advanced/auth.zh-CN.mdx`
  - `docs/self-hosting/environment-variables/auth.zh-CN.mdx`
  - `docs/self-hosting/environment-variables/model-provider.zh-CN.mdx`
  - `docs/self-hosting/advanced/settings-url-share.zh-CN.mdx`
- 源码：
  - `src/libs/next-auth/auth.config.ts`
  - `src/app/(backend)/api/auth/[...nextauth]/route.ts`
  - `src/server/services/nextAuthUser/index.ts`
  - `packages/database/src/schemas/nextauth.ts`
  - `packages/database/src/repositories/aiInfra/index.ts`
  - `src/services/_auth.ts`
  - `packages/utils/src/client/apiKeyManager.ts`
