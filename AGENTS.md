# AGENTS.md

## 1. 基础约定

### 1.1 编码规范

- 统一使用 UTF-8 编码（无 BOM）
- 代码注释与文档使用中文
- Python 遵循 PEP 8，JavaScript/TypeScript 遵循 ESLint 配置

### 1.2 执行优先级

1. **用户明确指令** > 本规范 > 默认约定
2. **Serena 工具链优先**：代码检索、编辑、知识管理优先使用 Serena
3. **降级策略**：Serena 不可用时，可使用 Codex CLI 的 `apply_patch` 或安全 `shell` 命令
4. **本地优先**：禁用远端 CI/CD 自动化，构建、测试在本地执行

### 1.3 核心原则

- ✅ 优先使用成熟的第三方库（FastAPI、SQLAlchemy、Pydantic、Ant Design 等）
- ✅ 出现错误立即修复，不遗留问题
- ✅ 关键决策和变更记录到 Serena 知识库
- ❌ 禁止占位代码、TODO 或 `NotImplemented`
- ❌ 禁止破坏性命令（如 `rm -rf`）

## 2. MCP 工具链

### 2.1 Serena MCP（主工具）

**核心职责**：代码检索、结构化编辑、知识管理

#### 会话初始化

```
每次会话开始时调用：
- serena__activate_project / serena__check_onboarding_performed
- 在回复开头简要说明 Serena 状态
```

#### 标准检索流程

```
1. serena__find_symbol           # 查找函数/类/接口定义
2. serena__search_for_pattern    # 搜索代码模式
3. serena__find_referencing_symbols  # 评估影响范围（可选）
4. 编辑工具（若文件类型支持）
```

#### 知识管理

- 使用 `serena__create_knowledge_memory_entry` 记录关键决策
- 使用 `serena__update_knowledge_memory_entry` 更新记录
- 使用 `serena__search_knowledge_memory` 查询历史决策

#### 降级规则

当出现以下情况时，降级到 Codex CLI：

- Serena 不支持的文件类型（如纯 Markdown、配置文件）
- 报错：`File not found` / `Symbol not found` / `Not supported`
- 新建文件或跨目录操作失败

**降级后必须**：

1. 在回复中说明降级原因
2. 将变更摘要写入 Serena 知识库

### 2.2 Sequential Thinking MCP

**用途**：复杂问题的结构化思考

```
适用场景：
- 架构设计决策
- 复杂业务逻辑梳理
- 性能优化方案

输出要求：
- 思考链条清晰可追溯
- 关键结论回写 Serena 知识库
```

### 2.3 Context7 MCP（首选外部检索）

**用途**：官方文档和权威资料查询

```
优先级：Context7 > DeepWiki > web_search

记录要求：
- 查询关键词
- 文档版本
- 访问日期
```

### 2.4 DeepWiki MCP（补充检索）

**用途**：社区实践和框架经验

```
使用场景：
- Context7 无结果时
- 需要社区最佳实践
- 框架使用案例

记录降级原因和检索摘要
```

## 3. 项目开发规范与指南

参考：LobeChat Development Guidelines

## 4. 快速开发流程

### 4.1 标准工作流

```
1. Research（研究）
   - 使用 Serena 检索现有代码
   - Sequential Thinking 梳理思路（复杂场景）
   - Context7/DeepWiki 查阅文档（需要时）

2. Plan（计划）
   - 使用 serena__update_plan 维护任务步骤
   - 明确验收标准

3. Implement（实现）
   - Serena 优先编辑
   - 小步提交，及时验证
   - 补齐必要注释

4. Verify（验证）
   - 本地运行测试
   - 手动冒烟测试关键路径

5. Deliver（交付）
   - 总结变更点
   - 记录到 Serena 知识库
```

### 4.2 降级编辑矩阵

| 场景                   | 工具选择                         | 留痕要求               |
| ---------------------- | -------------------------------- | ---------------------- |
| Python/TS 代码符号编辑 | Serena 优先                      | -                      |
| Markdown / 配置文件    | apply_patch                      | 说明原因               |
| 新建文件               | Serena，失败时 apply_patch       | 说明原因               |
| 批量修改               | Serena，失败时 shell（安全命令） | 说明原因 + Serena 记录 |

### 5.1 知识库条目模板

```markdown
标题：[简短描述决策或变更]
日期：YYYY-MM-DD
类型：决策 / 实现 / 问题修复

## 背景

简述问题或需求

## 方案

选择的技术方案或实现方式

## 关键代码位置

- 文件路径1
- 文件路径2

## 注意事项

需要特别注意的点

## 参考资料

- 文档链接
- 相关 issue
```

## 6. 安全与合规（精简）

### 6.1 基础安全

- ✅ 敏感信息存环境变量（`.env` 文件，不提交到 Git）
- ✅ 密码使用 bcrypt 哈希
- ✅ JWT Token 设置合理过期时间
- ✅ SQL 使用 ORM 防注入
- ✅ CORS 配置符合实际需求

## 7. 快速自检清单

### 启动新功能前

- [ ] Serena 已激活
- [ ] 现有代码已检索
- [ ] 技术选型已明确（优先成熟库）

### 提交代码前

- [ ] 本地运行通过
- [ ] 关键路径手动测试通过
- [ ] 无 TODO 或占位代码
- [ ] Commit 信息清晰

### 任务完成后

- [ ] 关键决策记录到 Serena
- [ ] 遗留问题（如有）已登记
- [ ] 下一步行动明确

---

# LobeChat Development Guidelines

This document serves as a comprehensive guide for all team members when developing LobeChat.

## Tech Stack

Built with modern technologies:

- **Frontend**: Next.js 15, React 19, TypeScript
- **UI Components**: Ant Design, @lobehub/ui, antd-style
- **State Management**: Zustand, SWR
- **Database**: PostgreSQL, PGLite, Drizzle ORM
- **Testing**: Vitest, Testing Library
- **Package Manager**: pnpm (monorepo structure)
- **Build Tools**: Next.js (Turbopack in dev, Webpack in prod)

## Directory Structure

The project follows a well-organized monorepo structure:

- `apps/` - Main applications
- `packages/` - Shared packages and libraries
- `src/` - Main source code
- `docs/` - Documentation
- `.cursor/rules/` - Development rules and guidelines

## Development Workflow

### Git Workflow

- Use rebase for git pull
- Git commit messages should prefix with gitmoji
- Git branch name format: `username/feat/feature-name`
- Use `.github/PULL_REQUEST_TEMPLATE.md` for PR descriptions

### Package Management

- Use `pnpm` as the primary package manager
- Use `bun` to run npm scripts
- Use `bunx` to run executable npm packages
- Navigate to specific packages using `cd packages/<package-name>`

### Code Style Guidelines

#### TypeScript

- Prefer interfaces over types for object shapes

### Testing Strategy

**Required Rule**: `testing-guide/testing-guide.mdc`

**Commands**:

- Web: `bunx vitest run --silent='passed-only' '[file-path-pattern]'`
- Packages: `cd packages/[package-name] && bunx vitest run --silent='passed-only' '[file-path-pattern]'` (each subpackage contains its own vitest.config.mts)

**Important Notes**:

- Wrap file paths in single quotes to avoid shell expansion
- Never run `bun run test` - this runs all tests and takes \~10 minutes

### Type Checking

- Use `bun run type-check` to check for type errors

### i18n

- **Keys**: Add to `src/locales/default/namespace.ts`
- **Dev**: Translate `locales/zh-CN/namespace.json` locale file only for preview
- DON'T run `pnpm i18n`, let CI auto handle it

## Project Rules Index

All following rules are saved under `.cursor/rules/` directory:

### Backend

- `drizzle-schema-style-guide.mdc` – Style guide for defining Drizzle ORM schemas

### Frontend

- `react-component.mdc` – React component style guide and conventions
- `i18n.mdc` – Internationalization guide using react-i18next
- `typescript.mdc` – TypeScript code style guide
- `packages/react-layout-kit.mdc` – Usage guide for react-layout-kit

### State Management

- `zustand-action-patterns.mdc` – Recommended patterns for organizing Zustand actions
- `zustand-slice-organization.mdc` – Best practices for structuring Zustand slices

### Desktop (Electron)

- `desktop-feature-implementation.mdc` – Implementing new Electron desktop features
- `desktop-controller-tests.mdc` – Desktop controller unit testing guide
- `desktop-local-tools-implement.mdc` – Workflow to add new desktop local tools
- `desktop-menu-configuration.mdc` – Desktop menu configuration guide
- `desktop-window-management.mdc` – Desktop window management guide

### Debugging

- `debug-usage.mdc` – Using the debug package and namespace conventions

### Testing

- `testing-guide/testing-guide.mdc` – Comprehensive testing guide for Vitest
- `testing-guide/electron-ipc-test.mdc` – Electron IPC interface testing strategy
- `testing-guide/db-model-test.mdc` – Database Model testing guide
