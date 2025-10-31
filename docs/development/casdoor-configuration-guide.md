# Casdoor 配置指南

## 📋 当前 .env 配置检查

### ✅ 已配置的项目

你的 `.env` 文件已经包含以下 Casdoor 配置：

```env
AUTH_CASDOOR_ISSUER=https://casdoor.frp2.rundev.run
AUTH_CASDOOR_ID=14fe9e46439df5255e01
AUTH_CASDOOR_SECRET=1b0309c42dc9cfafe292f14caa2ff935e385f103
NEXT_AUTH_SSO_PROVIDERS=casdoor
```

### ⚠️ 需要添加的配置

根据 Casdoor SDK 的要求，你还需要添加以下配置：

#### 1. **组织名称** (必需)

```env
# Casdoor 组织名称 (默认为 built-in)
AUTH_CASDOOR_ORGANIZATION=built-in
```

如果你在 Casdoor 中创建了自定义组织，需要填写实际的组织名称。

#### 2. **证书** (可选但推荐)

```env
# Casdoor 应用程序证书 (用于 JWT 验证)
AUTH_CASDOOR_CERTIFICATE="-----BEGIN CERTIFICATE-----
MIIEVTCCAj2gAwIBAgIDAeJAMA0GCSqGSIb3DQEBCwUAMEMxCzAJBgNVBAYTAlVT
... (你的证书内容) ...
-----END CERTIFICATE-----"
```

**如何获取证书**：

1. 登录 Casdoor 管理后台
2. 进入 **Applications** (应用程序)
3. 找到你的应用（client ID 为 `14fe9e46439df5255e01`）
4. 点击 **Cert** 标签
5. 复制完整的证书内容

**注意**：

- 证书用于验证 Casdoor 返回的 JWT token
- 如果只使用 OIDC 登录功能，可以暂时不配置
- 如果需要使用 SDK 的用户管理功能（创建、更新、删除用户），建议配置证书

## 📝 完整的 .env 配置示例

将以下内容添加到你的 `.env` 文件中：

```env
# ==========================================
# Casdoor 完整配置
# ==========================================

# Casdoor OIDC issuer URL (Casdoor 服务器地址)
AUTH_CASDOOR_ISSUER=https://casdoor.frp2.rundev.run

# Casdoor application client ID (应用程序 Client ID)
AUTH_CASDOOR_ID=14fe9e46439df5255e01

# Casdoor application client secret (应用程序 Client Secret)
AUTH_CASDOOR_SECRET=1b0309c42dc9cfafe292f14caa2ff935e385f103

# Casdoor organization name (组织名称，默认为 built-in)
AUTH_CASDOOR_ORGANIZATION=built-in

# Casdoor certificate (证书，用于 JWT 验证)
# 从 Casdoor 管理后台获取: Applications -> Your App -> Cert
# 如果只使用 OIDC 登录，可以留空
AUTH_CASDOOR_CERTIFICATE=""

# SSO providers (已配置)
NEXT_AUTH_SSO_PROVIDERS=casdoor
```

## 🔧 更新代码以使用新配置

更新 `src/server/services/casdoor.ts` 文件：

```typescript
import { SDK } from 'casdoor-nodejs-sdk';

// Casdoor 配置
const casdoorConfig = {
  appName: process.env.AUTH_CASDOOR_ID || '',
  certificate: process.env.AUTH_CASDOOR_CERTIFICATE || '', // 从环境变量读取
  clientId: process.env.AUTH_CASDOOR_ID || '',
  clientSecret: process.env.AUTH_CASDOOR_SECRET || '',
  endpoint: process.env.AUTH_CASDOOR_ISSUER || '',
  orgName: process.env.AUTH_CASDOOR_ORGANIZATION || 'built-in', // 从环境变量读取
};
```

## 📖 配置参数说明

| 参数                        | 必需    | 说明                   | 示例                                       |
| --------------------------- | ------- | ---------------------- | ------------------------------------------ |
| `AUTH_CASDOOR_ISSUER`       | ✅ 是   | Casdoor 服务器 URL     | `https://casdoor.frp2.rundev.run`          |
| `AUTH_CASDOOR_ID`           | ✅ 是   | 应用程序 Client ID     | `14fe9e46439df5255e01`                     |
| `AUTH_CASDOOR_SECRET`       | ✅ 是   | 应用程序 Client Secret | `1b0309c42dc9cfafe292f14caa2ff935e385f103` |
| `AUTH_CASDOOR_ORGANIZATION` | ✅ 是   | Casdoor 组织名称       | `built-in` 或自定义组织名                  |
| `AUTH_CASDOOR_CERTIFICATE`  | ⚠️ 推荐 | x509 证书内容          | 完整的证书字符串                           |
| `NEXT_AUTH_SSO_PROVIDERS`   | ✅ 是   | 启用的 SSO 提供商      | `casdoor`                                  |

## 🔍 如何在 Casdoor 中查找配置信息

### 1. 登录 Casdoor 管理后台

访问：`https://casdoor.frp2.rundev.run`

### 2. 查看应用信息

1. 进入 **Applications** (应用程序) 菜单
2. 找到你的应用程序
3. 记录以下信息：
   - **Name**: 应用名称
   - **Organization**: 所属组织（重要！）
   - **Client ID**: 对应 `AUTH_CASDOOR_ID`
   - **Client Secret**: 对应 `AUTH_CASDOOR_SECRET`
   - **Cert**: 证书内容

### 3. 获取证书

在应用详情页面：

1. 点击 **Cert** 标签
2. 如果还没有证书，点击 **Generate** 生成
3. 复制完整的证书内容（包括 `-----BEGIN CERTIFICATE-----` 和 `-----END CERTIFICATE-----`）
4. 粘贴到 `.env` 文件的 `AUTH_CASDOOR_CERTIFICATE` 变量中

**证书格式示例**：

```
-----BEGIN CERTIFICATE-----
MIIEVTCCAj2gAwIBAgIDAeJAMA0GCSqGSIb3DQEBCwUAMEMxCzAJBgNVBAYTAlVT
MRMwEQYDVQQKDApDYXNkb29yLCBJbmMuMR8wHQYDVQQDDBZDYXNkb29yIEFwcGxp
Y2F0aW9uIENBMB4XDTIzMDEwMTAwMDAwMFoXDTMzMDEwMTAwMDAwMFowQzELMAkG
... (中间省略) ...
A1UEAwwWQ2FzZG9vciBBcHBsaWNhdGlvbiBDQTCCASIwDQYJKoZIhvcNAQEBBQAD
ggEPADCCAQoCggEBAL5Q...
-----END CERTIFICATE-----
```

### 4. 确认组织名称

在应用详情中，查看 **Organization** 字段的值，将其设置为 `AUTH_CASDOOR_ORGANIZATION`。

## ⚙️ 环境变量类型定义

建议更新 `src/envs/auth.ts`（如果有此文件）以包含新的环境变量：

```typescript
export const authEnv = z
  .object({
    // ... 其他配置 ...

    // Casdoor
    AUTH_CASDOOR_ISSUER: z.string().optional(),
    AUTH_CASDOOR_ID: z.string().optional(),
    AUTH_CASDOOR_SECRET: z.string().optional(),
    AUTH_CASDOOR_ORGANIZATION: z.string().default('built-in'),
    AUTH_CASDOOR_CERTIFICATE: z.string().optional(),
  })
  .parse(process.env);
```

## 🧪 测试配置

### 1. 启动开发服务器

```bash
bun run dev
```

### 2. 测试 OIDC 登录

访问：`http://localhost:3010`

点击登录按钮，应该会跳转到 Casdoor 登录页面。

### 3. 测试用户管理 API

在管理页面尝试创建用户：

- 访问 `http://localhost:3010/management`
- 点击 "用户管理"
- 点击 "新增用户"
- 填写表单并提交

如果配置正确，应该能够成功创建用户。

## ❗ 常见问题

### Q1: 没有证书可以使用吗？

**A**: 可以，但功能会受限：

- ✅ OIDC 登录功能可以正常使用
- ❌ 用户管理功能（创建、更新、删除）可能会报错
- ❌ JWT token 验证功能无法使用

建议：**如果需要使用用户管理功能，必须配置证书**。

### Q2: 组织名称错误会怎样？

**A**: 如果组织名称配置错误：

- 创建用户时会失败
- 用户会被创建到错误的组织中
- 可能导致权限问题

### Q3: 证书格式不正确怎么办？

**A**: 确保：

1. 包含完整的 `-----BEGIN CERTIFICATE-----` 和 `-----END CERTIFICATE-----`
2. 证书内容中的换行符正确（可以使用 `\n` 或保持原格式）
3. 没有多余的空格或字符

**在 .env 文件中的格式**：

```env
# 单行格式（使用 \n）
AUTH_CASDOOR_CERTIFICATE="-----BEGIN CERTIFICATE-----\nMIIE...\n-----END CERTIFICATE-----"

# 或多行格式（推荐）
AUTH_CASDOOR_CERTIFICATE="-----BEGIN CERTIFICATE-----
MIIEVTCCAj2gAwIBAgIDAeJAMA0GCSqGSIb3DQEBCwUAMEMxCzAJBgNVBAYTAlVT
...
-----END CERTIFICATE-----"
```

### Q4: 如何验证配置是否正确？

**A**: 在代码中添加日志：

```typescript
// src/server/services/casdoor.ts
console.log('Casdoor Config:', {
  endpoint: casdoorConfig.endpoint,
  clientId: casdoorConfig.clientId,
  orgName: casdoorConfig.orgName,
  hasCertificate: !!casdoorConfig.certificate,
  certificateLength: casdoorConfig.certificate?.length || 0,
});
```

## 📚 参考资料

- [Casdoor 官方文档](https://casdoor.org/docs/overview)
- [Casdoor Node.js SDK](https://github.com/casdoor/casdoor-nodejs-sdk)
- [Casdoor Application 配置](https://casdoor.org/docs/application/overview)

## ✅ 配置清单

完成以下步骤以确保 Casdoor 配置正确：

- [ ] 已添加 `AUTH_CASDOOR_ORGANIZATION` 环境变量
- [ ] 已获取并添加 `AUTH_CASDOOR_CERTIFICATE` 证书
- [ ] 已更新 `casdoor.ts` 从环境变量读取配置
- [ ] 已在 Casdoor 后台确认组织名称
- [ ] 已在 Casdoor 后台确认应用配置
- [ ] 已测试 OIDC 登录功能
- [ ] 已测试用户管理功能（创建用户）
- [ ] 已在生产环境更换为真实的 Client ID 和 Secret

## 🔐 安全提醒

⚠️ **生产环境注意事项**：

1. 不要在版本控制中提交真实的 credentials
2. 使用环境变量管理敏感信息
3. 定期更换 Client Secret
4. 使用 HTTPS 连接 Casdoor
5. 证书应该妥善保管，不要泄露

---

**更新时间**: 2025-10-31
