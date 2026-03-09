# Cloak 技术设计文档

**Claude Code Desktop GUI — 详细设计**

| 项目 | 内容 |
|------|------|
| 基于 PRD | Cloak-PRD-v1.0 |
| 创建日期 | 2026-03-09 |
| 状态 | Approved |

---

## 1. 架构概述

### 1.1 进程模型

采用 Electron 双进程模型：

- **Main Process：** 业务逻辑、子进程管理、IPC 网关
- **Renderer Process：** React 19 UI 渲染

```
┌─────────────────────────────────────────────────┐
│                  Electron Main Process           │
│                                                  │
│  ┌──────────────┐  ┌──────────────────────────┐  │
│  │SessionManager│  │    ClaudeService(s)      │  │
│  │  sessions[]  │──│  per-turn --print procs  │  │
│  │  activeId    │  └──────────────────────────┘  │
│  └──────────────┘                                │
│  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ProjectManager│  │     AuthChecker          │  │
│  └──────────────┘  └──────────────────────────┘  │
│  ┌──────────────────────────────────────────┐    │
│  │        contextBridge (IPC API)           │    │
│  └──────────────────────────────────────────┘    │
└────────────────────┬────────────────────────────┘
                     │ IPC
┌────────────────────▼────────────────────────────┐
│              Electron Renderer Process           │
│  React 19 + Zustand + Tailwind + shadcn/ui      │
│  ┌─────────┐ ┌────────────────┐ ┌─────────────┐ │
│  │ Sidebar │ │  Chat Area     │ │  Settings   │ │
│  └─────────┘ └────────────────┘ └─────────────┘ │
└──────────────────────────────────────────────────┘
```

### 1.2 技术栈

| 层级 | 技术 |
|------|------|
| Renderer | React 19 + TypeScript |
| 样式 | Tailwind CSS + shadcn/ui |
| 状态管理 | Zustand |
| 构建 | electron-vite + Vite |
| 打包 | electron-builder |
| 自动更新 | electron-updater |
| 本地存储 | electron-store |

---

## 2. ClaudeService — 核心通信设计

### 2.1 通信方案：双向 stream-json

每轮对话启动一个独立进程：

```bash
claude --print \
  --output-format stream-json \
  --input-format stream-json \
  --resume <sessionId> \
  --cwd <projectDir>
```

- 通过 stdin 写入用户消息（stream-json 格式）
- 从 stdout 逐行读取 JSON 事件
- 通过 IPC 转发到 Renderer
- 对话完成后进程自然退出

### 2.2 为什么选择这个方案

- `--input-format stream-json` + `--output-format stream-json` 是 Claude Code 为程序集成提供的官方接口
- 每轮 1-2 秒的进程启动开销在 GUI 场景下用户几乎无感知
- 进程生命周期清晰，避免内存泄漏
- 结构化 JSON 输入输出，解析可靠

### 2.3 多会话并发

- 每个活跃对话（正在响应中）维护独立子进程
- 切换会话时不 kill 正在响应的旧进程
- 非活跃会话没有常驻进程
- 对话完成后进程自动退出

---

## 3. stream-json 事件解析

### 3.1 实际事件类型

基于对 Claude Code CLI 的实际测试，stream-json 输出的事件类型如下：

| 实际事件 type | 包含的 content block types | UI 渲染 |
|---|---|---|
| `assistant` | `text` | Markdown 消息卡片，流式显示 |
| `assistant` | `tool_use` | 工具调用折叠卡片 |
| `assistant` | `thinking` | 可折叠"思考过程"区域 |
| `user` | `tool_result` | 工具执行结果，嵌入工具卡片 |
| `progress` | `hook_progress` | 状态指示器（轻量展示或忽略） |
| `file-history-snapshot` | — | 内部状态，不渲染 |

**注意：** 工具调用（tool_use）和工具结果（tool_result）嵌套在 assistant/user 消息的 content blocks 数组中，不是独立的顶层事件。

### 3.2 每条 JSONL 记录的通用字段

```typescript
interface BaseEvent {
  type: 'assistant' | 'user' | 'progress' | 'file-history-snapshot';
  sessionId: string;    // UUID
  uuid: string;         // 事件唯一标识
  timestamp: string;    // ISO-8601
  cwd: string;
  version: string;      // CLI 版本
  parentUuid: string | null;
}
```

### 3.3 风险等级推断

由于 stream-json 不直接标注风险等级，在适配器层根据工具名推断：

- **低风险（蓝/灰）：** `Read`, `Glob`, `Grep`, `WebSearch`, `WebFetch`
- **中风险（橙色）：** `Write`, `Edit`, `NotebookEdit`
- **高风险（红色）：** `Bash`, 以及包含 `rm`/`delete`/`drop` 等危险关键词的命令

---

## 4. Renderer 消息模型

### 4.1 数据类型

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  timestamp: string;
  blocks: ContentBlock[];
}

type ContentBlock =
  | { type: 'text'; content: string }
  | { type: 'tool_use'; toolId: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; toolId: string; output: string; error?: string }
  | { type: 'thinking'; content: string };

interface PermissionRequest {
  toolUseId: string;
  toolName: string;
  input: Record<string, unknown>;
  riskLevel: 'low' | 'medium' | 'high';
}
```

### 4.2 Zustand Store 架构

四个独立 store，关注点分离：

| Store | 职责 |
|---|---|
| `useChatStore` | 当前会话消息流、流式状态、权限请求 |
| `useSessionStore` | 所有会话列表、活跃会话 ID、切换 |
| `useProjectStore` | 项目列表、当前项目、项目配置 |
| `useSettingsStore` | 全局设置（主题、字体、快捷键） |

---

## 5. UI 组件架构

### 5.1 组件树

```
App
├── AuthGate
│   ├── InstallGuide
│   └── LoginGuide (xterm.js 终端)
│
├── MainLayout
│   ├── Sidebar (240px, 可折叠)
│   │   ├── ProjectSelector
│   │   ├── NewSessionButton
│   │   ├── SessionSearch
│   │   └── SessionList (虚拟滚动)
│   │       └── SessionItem
│   │
│   └── ChatArea
│       ├── ProjectInfoBar
│       ├── MessageList (虚拟滚动)
│       │   ├── UserMessage
│       │   ├── AssistantMessage
│       │   │   ├── MarkdownRenderer (Shiki)
│       │   │   └── ThinkingBlock
│       │   └── ToolCard
│       │       ├── ToolHeader (图标+名称+摘要)
│       │       ├── ToolInput
│       │       ├── ToolResult
│       │       └── DiffView
│       ├── AutoAcceptBanner
│       ├── PermissionBar
│       └── InputArea
│           ├── TextInput (2-10行自适应)
│           └── SendButton / StopButton
│
└── SettingsOverlay
    ├── AppearanceSettings
    ├── ClaudePathSettings
    ├── AutoAcceptSettings
    └── ShortcutSettings
```

### 5.2 关键技术选型

- **虚拟列表：** `@tanstack/react-virtual` — MessageList 和 SessionList
- **Markdown 渲染：** `react-markdown` + `remark-gfm` + `rehype-highlight` (Shiki)
- **Diff 视图：** `react-diff-viewer-continued` — 支持 unified/split 切换
- **嵌入终端：** `@xterm/xterm` — 仅用于 AuthGate 登录流程
- **图标：** `lucide-react`

---

## 6. 会话管理

### 6.1 会话生命周期

**新建会话：**
1. 生成新 sessionId (UUID)
2. 首次发消息时 spawn claude 进程（`--session-id <newId>`）
3. Claude Code 自动创建 JSONL 文件

**加载历史会话：**
1. 扫描 `~/.claude/projects/<project-hash>/*.jsonl`
2. 解析元数据：title（优先 `custom-title` 记录，否则首条 user 消息前 30 字）、lastActive、messageCount
3. 按 lastActive 倒序排列

**恢复会话：**
1. 读取 JSONL 文件 → 解析为 ChatMessage[] 展示
2. 用户发消息时 spawn claude 进程（`--resume <sessionId>`）

### 6.2 JSONL 解析适配器

```typescript
class JsonlParser {
  parseSessionFile(filePath: string): ChatMessage[]
  parseStreamEvent(line: string): StreamEvent
}
```

- 独立适配器模式，CLI 格式变更时只需修改此层
- 对未知字段做容错处理（ignore unknown types）

---

## 7. IPC 通信协议

| API | 方向 | 说明 |
|---|---|---|
| `claude.sendMessage(sessionId, text)` | R→M | 发送用户消息 |
| `claude.onStreamEvent(cb)` | M→R | 订阅实时 stream-json 事件 |
| `claude.abort(sessionId)` | R→M | SIGINT 终止当前进程 |
| `claude.confirmTool(toolUseId, allow)` | R→M | 响应权限确认 |
| `session.list(projectPath)` | R→M | 扫描 JSONL 获取会话列表 |
| `session.load(sessionId)` | R→M | 读取解析 JSONL 文件 |
| `session.create(projectPath)` | R→M | 创建新会话（仅生成 ID） |
| `session.delete(sessionId)` | R→M | 删除 JSONL 文件 |
| `project.list()` | R→M | 获取已注册项目 |
| `project.add(path)` | R→M | 注册项目目录 |
| `project.getClaudeMd(path)` | R→M | 读取 CLAUDE.md |
| `config.get/set` | R→M | electron-store 读写 |
| `app.checkCli()` | R→M | 检测 CLI 安装和认证状态 |

---

## 8. 视觉设计

- **浅色基底：** `#F4F3EE` (Pampas)
- **深色基底：** 暖灰（非纯黑）
- **主交互色：** `#C15F3C` (Terracotta)
- **辅助色：** `#B1ADA1` (Cloudy)
- **正文字体：** Georgia, serif
- **UI 控件：** -apple-system, BlinkMacSystemFont, Segoe UI
- **代码字体：** JetBrains Mono / Fira Code
- **动效：** 150-200ms 过渡，可全局关闭
- **最小窗口：** 800 x 600 px
- **侧边栏自动折叠：** 窗口宽度 < 900px

---

## 9. 里程碑

| 阶段 | 交付内容 |
|---|---|
| **M0** | electron-vite 脚手架 + ClaudeService（stream-json 双向通信）+ JSONL 解析器 + IPC 骨架 + AuthChecker |
| **M1** | ChatArea UI + Markdown/Shiki 渲染 + 流式消息展示 + InputArea + 虚拟列表 |
| **M2** | PermissionBar + 工具卡片（含风险标识）+ DiffView + 自动接受模式 |
| **M3** | Sidebar + SessionList + ProjectSelector + JSONL 会话历史加载 + 设置页面 |
| **M4** | electron-builder 打包（dmg，无签名）+ UpdateService + 窗口状态记忆 + Bug 修复 |

---

## 10. 依赖清单

### Renderer
- `react`, `react-dom` (v19)
- `tailwindcss`, shadcn/ui 组件
- `zustand`
- `react-markdown`, `remark-gfm`, `rehype-highlight`
- `shiki`
- `@tanstack/react-virtual`
- `react-diff-viewer-continued`
- `@xterm/xterm`
- `lucide-react`

### Main Process
- `electron-store`
- `electron-updater`

### 构建
- `electron-vite`
- `electron-builder`

---

## 11. 开放决策记录

| 决策 | 选择 | 理由 |
|---|---|---|
| CLI 通信方式 | 双向 stream-json（--print 模式） | 官方程序集成接口，最稳定 |
| 会话模型 | 多进程（活跃对话各自独立进程） | 用户体验最佳 |
| 代码签名 | MVP 阶段不签名 | 无 Apple Developer ID |
| 权限确认粒度 | 全局自动接受开关 | MVP 简化，后续按需扩展 |

---

*— End of Design Document —*
