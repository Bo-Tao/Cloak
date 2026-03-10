# 侧边栏重构设计

## 概述

将侧边栏从"单项目下拉 + 平铺会话列表"重构为"多项目树形列表 + 可折叠会话"，采用方案 A（原地重构 Sidebar.tsx，抽取子组件）。

## 整体布局

从上到下三个固定区域：

1. **标题栏**（固定顶部）：左侧"项目"文字，右侧新增项目 icon（`FolderPlus`）
2. **项目树形列表**（可滚动中间区域）：多个项目，每个项目下可折叠的会话列表
3. **设置按钮**（固定底部）：`Settings` icon + "设置" 文字，点击打开 SettingsOverlay

### 保留不变

- 拖拽调整宽度（240-520px）
- Cmd+B 折叠/展开侧边栏
- 窗口 < 900px 自动折叠
- 圆角、背景色、暗色模式支持
- 会话加载 IPC 通道
- 右键删除会话

### 移除

- 顶部项目选择下拉菜单（改为树形列表直接展示所有项目）
- 会话搜索过滤（暂时移除，后续按需加回）
- 右上角筛选 icon

## 项目项（ProjectItem）

### 三种状态

**默认状态：**
- 左侧文件夹图标：展开时 `FolderOpen`，折叠时 `Folder`
- 项目名称，超宽时 `text-ellipsis` 截断
- 点击 → 切换折叠/展开

**Hover 状态：**
- 整行背景变灰（`bg-black/5`，暗色 `bg-white/5`）
- 文件夹图标变为 `ChevronDown`（展开）/ `ChevronRight`（折叠）
- 右侧浮现两个 icon 按钮：
  - `Ellipsis`（更多）→ 弹出菜单
  - `SquarePen`（新建会话）

**展开状态：**
- 下方缩进显示会话列表
- 无会话时灰色文字"无线程"

### 更多菜单

绝对定位弹出菜单，点击外部关闭，三个选项：
- `FolderOpen` 打开文件夹 → `shell.openPath(project.path)`
- `Pencil` 重命名 → inline 编辑项目显示名
- `Trash2` 删除项目 → 确认对话框后移除

## 会话项（SessionItem）

- 相对项目缩进（`pl-8`）
- 显示：会话标题（截断）+ 右侧相对时间（"2 天"、"1 周"）
- 单击直接加载会话到聊天区
- 当前激活会话 terracotta 色高亮
- Hover 时背景微灰

## Store 变更

`settings-store` 新增：
```typescript
collapsedProjects: Record<string, boolean>  // key 为 project.path
```
持久化到 electron-store config。

## 组件结构

```
Sidebar.tsx
├── 标题栏（"项目" + FolderPlus 按钮）
├── 项目列表（可滚动）
│   ├── ProjectItem（内联子组件）
│   │   ├── 项目行（icon + 名称 + hover 操作）
│   │   ├── ContextMenu（更多菜单）
│   │   └── SessionItem[]（内联子组件）
│   └── ...
└── 底部设置按钮
```

## 技术决策

- **不引入新依赖**：菜单用绝对定位实现，不用 Radix Popover
- **子组件内联**：ProjectItem 和 SessionItem 定义在 Sidebar.tsx 同文件中
- **图标统一**：全部使用 lucide-react
- **动画**：折叠/展开使用 CSS transition（height auto → 0）
