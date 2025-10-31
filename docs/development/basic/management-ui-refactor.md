# 用户域组织管理 UI 重构总结

## 完成的工作

### 1. 左侧底部导航新增 "管理" 导航项

**修改的文件：**

- `src/app/[variants]/(main)/_layout/Desktop/SideBar/BottomActions.tsx`
  - 引入 `ShieldCheck` 图标
  - 引入 `useHasRole` hook
  - 添加权限检查逻辑（仅 admin 和 root 角色可见）
  - 添加指向 `/management` 的导航项

**修改的文件：**

- `src/locales/default/common.ts`
  - 在 `tab` 对象中添加 `management: '管理'` 字段

### 2. 创建管理页面架构（参考 settings 页面）

**创建的目录结构：**

```
src/app/[variants]/(main)/management/
├── _layout/
│   ├── CategoryContent.tsx        # 侧边栏菜单（用户管理/组织管理）
│   ├── ManagementContent.tsx      # 内容路由器
│   ├── type.ts                    # 类型定义
│   ├── Desktop/
│   │   ├── index.tsx              # 桌面布局
│   │   ├── SideBar.tsx            # 侧边栏容器
│   │   └── Header.tsx             # 移动端抽屉头部
│   └── Mobile/
│       ├── index.tsx              # 移动端布局
│       └── Header.tsx             # 移动端导航头部
├── users/
│   └── index.tsx                  # 用户管理页面
├── organizations/
│   └── index.tsx                  # 组织管理页面
├── layout.tsx                     # 布局入口
└── page.tsx                       # 页面入口
```

### 3. 用户管理和组织管理功能分离

**用户管理页面** (`management/users/index.tsx`)：

- 显示用户列表（姓名、邮箱、角色、所属组织）
- Root 角色可以：
  - 修改用户角色（root/admin/user）
  - 分配用户到任意组织或设为无组织
- Admin 角色可以：
  - 仅查看和管理本校学生
  - 分配学生到本校或其他学校

**组织管理页面** (`management/organizations/index.tsx`)：

- 仅 Root 角色可访问
- 创建新组织（学校类型）
- 组织列表展示
- 重命名组织
- 删除组织（管理层类型不可删除）

### 4. 国际化文本完善

**修改的文件：**

- `src/locales/default/setting.ts`
  - 在 `management` 对象中新增：
    - `header.title`: ' 管理'
    - `header.desc`: ' 组织与用户管理'
    - `tabs.users`: ' 用户管理'
    - `tabs.organizations`: ' 组织管理'

## 技术实现细节

### 架构设计

1. **布局系统**：完全复用 settings 页面的架构模式
   - Desktop 和 Mobile 分离
   - 响应式布局自适应
   - 侧边栏菜单 + 内容区域

2. **权限控制**：
   - 底部导航：使用 `useHasRole({ anyOf: ['admin', 'root'] })` 控制可见性
   - 组织管理：仅 Root 角色可访问（在 CategoryContent 中过滤）
   - 用户管理：Admin 和 Root 都可访问，但功能权限不同

3. **路由结构**：
   - 主路由：`/management`
   - Tab 切换：通过 `?tab=users` 或 `?tab=organizations` 查询参数控制
   - 使用 `nuqs` 管理 URL 查询参数状态

4. **数据管理**：
   - 使用现有的 tRPC 接口（`lambdaQuery.organization.*` 和 `lambdaQuery.adminUser.*`）
   - 保持与原 settings/management 相同的功能逻辑

## 与原系统的关系

### 保留的内容

- `src/app/[variants]/(main)/settings/management/index.tsx` 依然存在
- Settings 页面中的 "组织与用户"Tab 依然可用
- 所有后端接口和服务保持不变

### 新增的内容

- 独立的管理入口：从左侧底部导航直接访问
- 分离的 UI 结构：用户管理和组织管理是两个独立的 Tab
- 更清晰的导航层级：管理功能从设置页面独立出来

## 使用方式

1. **访问入口**：
   - 点击左侧底部的 "管理" 图标（需要 admin 或 root 权限）
   - 或直接访问 `/management` 路由

2. **功能分布**：
   - **用户管理 Tab**：所有有权限的角色（admin/root）都能看到
   - **组织管理 Tab**：仅 root 角色可见

3. **权限说明**：
   - Root：完全权限，可管理所有组织和用户
   - Admin：仅能管理本校学生
   - User：无法访问管理页面

## 下一步建议

1. **考虑是否移除 Settings 中的 Management Tab**：
   - 现在有了独立的管理入口
   - 可以考虑从 Settings 中移除该 Tab，避免功能重复
   - 或者保留作为快速入口

2. **增强组织管理功能**：
   - 支持组织层级关系（parent_id）
   - 批量操作用户

3. **添加统计信息**：
   - 每个组织的用户数量
   - 角色分布统计

4. **优化移动端体验**：
   - 考虑添加搜索和筛选功能
   - 优化表格在小屏幕上的显示
