# LobeChat Development Guidelines

This document serves as a comprehensive guide for all team members when developing LobeChat.

## 🛠️ 工具使用指南

- 优先通过 MCP 工具完成查询、检索与分析任务，并记录关键决策依据。

### 🔍 代码分析

- **首选**：`Serena` 符号工具（`get_symbols_overview` → `find_symbol`）
- **备选**：`read` + `rg` + `serena__find_file` 组合
- **降级**：直接文件读取（须说明原因与依据）

### 📚 知识查询

- **技术文档**：`Context7`（先 `resolve-library-id` 后 `get-library-docs`）
- **GitHub 项目**：`mcp-deepwiki__deepwiki_fetch`

### 💭 分析规划

- **深度思考**：`sequential-thinking__sequentialthinking`

### 🔧 命令执行标准

**路径处理：**

- 始终使用双引号包裹文件路径
- 优先使用正斜杠 `/` 作为路径分隔符
- 注意跨平台兼容性

**工具优先级：**

1. `rg` (ripgrep) > `grep` 用于内容搜索
2. 专用工具（Read/Write/Edit）> 系统命令
3. 批量调用工具以提升效率

**重构与记录：**

- 优先使用 `Serena` 的 `rename_symbol`、`replace_regex` 完成批量重构与代码修改。
- 任务结束后总结经验、关键约束或最佳实践，调用 `Serena` 的 `write_memory` 写入记录。

### 🧰 常用 MCP 能力

- `context7__resolve-library-id` / `context7__get-library-docs`：获取库文档
- `mcp-deepwiki__deepwiki_fetch`：检索 DeepWiki 资料
- `serena__list_dir`、`serena__find_symbol`：定位文件、符号与上下文
- `sequential-thinking__sequentialthinking`：分步骤推理与复盘

## 🗣️ 沟通规范

- 与团队成员及用户沟通时统一使用中文，保证表述清晰、专业。

## 🔄 交付与记录规范

- **提交提示**：所有 Git 提交由用户手动执行（建议仍遵循 gitmoji 前缀规范）。
- **开发流水**：功能确认通过后更新 `devlog.md` 等流水文件，记录内容需包含：
  - 功能摘要（简要描述本次开发内容）
  - `commit` 字段先写 `pending`，待用户提供上一轮提交哈希后再回填
- **操作流程**：
  1. 代码完成后先向用户同步改动并等待确认；未获确认前不得执行任何 Git 操作
  2. 用户确认功能完成后，助手提供开发总结及建议的提交信息
  3. 用户手动完成 Git 提交并返回提交哈希，助手再更新上一条流水记录
  4. 确认文档与流水信息与最新手动提交保持一致。

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
