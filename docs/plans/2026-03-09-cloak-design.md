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

采用 Electron 双进程模型：Main Process 负责业务逻辑和子进程管理，Renderer Process 负责 UI 渲染。两者通过 contextBridge + IPC 通信。

```
┌──────────────────────────────────────────────────────┐
│                 Electron Main Process                 │
│                (Electron 40.8.0 / Node 24)           │
│                                                       │
│  ┌───────────────┐  ┌─────────────────────────────┐  │
│  │SessionManager │  │   ClaudeService             │  │
│  │  sessions[]   │──│   child_process.spawn       │  │
│  │  activeId     │  │   per-turn --print procs    │  │
│  └───────────────┘  └─────────────────────────────┘  │
│  ┌───────────────┐  ┌─────────────────────────────┐  │
│  │ProjectManager │  │   PermissionHandler         │  │
│  │  projects[]   │  │   stdin JSON 写入           │  │
│  └───────────────┘  └─────────────────────────────┘  │
│  ┌───────────────┐  ┌─────────────────────────────┐  │
│  │ AuthChecker   │  │   UpdateService             │  │
│  │ claude auth   │  │   electron-updater          │  │
│  └───────────────┘  └─────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────┐  │
│  │          contextBridge (IPC API)                │  │
│  └─────────────────────────────────────────────────┘  │
└────────────────────────┬─────────────────────────────┘
                         │ IPC (async only)
┌────────────────────────▼─────────────────────────────┐
│              Electron Renderer Process                │
│  React 19 + Zustand + Tailwind v4 + shadcn/ui       │
│  ┌──────────┐ ┌─────────────────┐ ┌───────────────┐ │
│  │ Sidebar  │ │   ChatArea      │ │  Settings     │ │
│  │ Virtuoso │ │  react-markdown │ │  Overlay      │ │
│  └──────────┘ └─────────────────┘ └───────────────┘ │
└──────────────────────────────────────────────────────┘
```

### 1.2 技术栈

| 层级 | 技术 | 版本 | 职责 |
|------|------|------|------|
| 运行时 | Electron | 40.8.0 (Chromium 144, Node 24) | 桌面容器 |
| CLI 集成 | child_process.spawn | Node 原生 | 调用 Claude Code CLI |
| 渲染层 | React + TypeScript | 19.x | UI 渲染 |
| 样式 | Tailwind CSS | v4 (CSS-native) | 原子化样式 |
| 组件库 | shadcn/ui (Radix UI) | latest | UI 组件 |
| 状态管理 | Zustand | latest | 客户端状态 |
| Markdown | react-markdown + remark-gfm + rehype-highlight | latest | Markdown 渲染 |
| 代码高亮 | Shiki | latest | 语法高亮 |
| 虚拟列表 | React Virtuoso | latest | 消息列表/会话列表 |
| Diff | react-diff-viewer-continued | latest | 文件变更展示 |
| 终端 | @xterm/xterm + node-pty | latest | 认证流程终端 |
| 图标 | lucide-react | latest | UI 图标 |
| 本地存储 | electron-store | v9.x (ESM) | 配置持久化 |
| 构建 | electron-vite | latest | 开发服务器 + HMR + 构建 |
| 打包 | electron-builder | latest | dmg / nsis / AppImage |
| 自动更新 | electron-updater | latest | 版本检测与增量更新 |

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
- 从 stdout 逐行读取 NDJSON 事件
- 通过 IPC 转发到 Renderer
- 对话完成后进程自然退出

### 2.2 设计理由

- `--input-format stream-json` + `--output-format stream-json` 是 Claude Code 为程序集成提供的官方接口
- 每轮 1-2 秒的进程启动开销在 GUI 场景下用户几乎无感知
- 进程生命周期清晰，避免内存泄漏
- 结构化 JSON 输入输出，解析可靠
- 无额外 SDK 依赖，直接使用 Node 原生 child_process

### 2.3 权限处理：stdin 交互

通过 stdin 向 Claude Code 进程写入权限确认响应：

```
Claude CLI stdout → 解析 tool_use 事件 → IPC → Renderer PermissionBar
                                                    │
用户点击 [允许] / [拒绝]                              │
                                                    ▼
Renderer → IPC → Main Process → stdin 写入确认 JSON → Claude CLI
```

**权限模式映射：**

| PRD 概念 | CLI 实现 |
|----------|----------|
| 默认模式 | stdin 逐次写入确认/拒绝响应 |
| 自动接受 | `--allowedTools "Bash,Read,Edit,Write,Glob,Grep"` — 全部预批准 |
| 只读模式 | `--permission-mode plan` — 仅允许读操作 |

### 2.4 多会话并发

- 每个活跃对话（正在响应中）维护独立子进程
- 切换会话时不 kill 正在响应的旧进程
- 非活跃会话没有常驻进程
- 对话完成后进程自动退出

---

## 3. stream-json 事件解析

### 3.1 实时流式事件（stdout NDJSON）

stream-json 输出采用与 Anthropic Messages API 一致的事件流：

| 事件 type | 说明 | UI 渲染 |
|-----------|------|---------|
| `message_start` | 消息开始 | 创建新消息卡片，进入 loading 状态 |
| `content_block_start` | 内容块开始（text / tool_use / thinking） | 初始化对应渲染组件 |
| `content_block_delta` | 增量内容（text_delta / input_json_delta） | 流式追加文本 / 工具参数 |
| `content_block_stop` | 内容块结束 | 完成渲染，触发代码高亮等后处理 |
| `message_delta` | 消息级更新（stop_reason, usage） | 更新状态指示器 |
| `message_stop` | 消息结束 | 解除 loading 状态 |
| `result` | 本轮完成，含 duration / usage / cost | 展示 token 用量统计 |

### 3.2 JSONL 会话文件事件（持久化记录）

每个会话 JSONL 文件中，每行 JSON 对象的顶层 type 如下：

| 顶层 type | 包含的 content block types | UI 渲染 |
|---|---|---|
| `assistant` | `text`, `tool_use`, `thinking` | Markdown 消息卡片 / 工具调用卡片 / 思考区域 |
| `user` | `tool_result` | 工具执行结果，嵌入工具卡片 |
| `progress` | `hook_progress` | 状态指示器（轻量展示或忽略） |
| `result` | — | 本轮 token 用量和耗时 |
| `system` | — | 系统初始化消息，不渲染 |
| `summary` | — | 会话摘要，不渲染 |
| `custom-title` | — | 用户自定义会话标题，不渲染 |
| `file-history-snapshot` | — | 内部状态，不渲染 |

**注意：** 工具调用（tool_use）和工具结果（tool_result）嵌套在 assistant/user 消息的 content blocks 数组中，不是独立的顶层事件。

### 3.3 通用字段

```typescript
interface BaseEvent {
  type: string;
  sessionId: string;           // UUID
  uuid: string;                // 事件唯一标识
  timestamp: string;           // ISO-8601
  cwd: string;
  version: string;             // CLI 版本
  parentUuid: string | null;
  turn?: number;
  cost?: { inputTokens: number; outputTokens: number; usdCost: number };
  model?: string;
}
```

### 3.4 风险等级推断

适配器层根据工具名推断风险等级：

```typescript
function getRiskLevel(toolName: string, input: Record<string, unknown>): RiskLevel {
  const LOW = ['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch'];
  const MEDIUM = ['Write', 'Edit', 'NotebookEdit'];
  if (toolName === 'Bash') {
    const cmd = String(input.command ?? '');
    if (/\b(rm|delete|drop|kill|force)\b/i.test(cmd)) return 'high';
    return 'high'; // Bash 默认高风险
  }
  if (LOW.includes(toolName)) return 'low';
  if (MEDIUM.includes(toolName)) return 'medium';
  return 'high'; // 未知工具默认高风险
}
```

---

## 4. Renderer 消息模型

### 4.1 数据类型

```typescript
interface ChatMessage {
  id: string;               // uuid
  role: 'user' | 'assistant';
  timestamp: string;        // ISO-8601
  blocks: ContentBlock[];
  cost?: { inputTokens: number; outputTokens: number; usdCost: number };
  model?: string;
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
| `useChatStore` | 当前会话消息流、流式状态、权限请求队列 |
| `useSessionStore` | 所有会话列表、活跃会话 ID、切换逻辑 |
| `useProjectStore` | 项目列表、当前项目、项目配置 |
| `useSettingsStore` | 全局设置（主题、字体、快捷键） |

---

## 5. UI 组件架构

### 5.1 组件树

```
App
├── AuthGate
│   ├── InstallGuide              # Claude Code 未安装
│   └── LoginGuide                # xterm.js + node-pty 终端
│
├── MainLayout
│   ├── Sidebar (240px, 可折叠)
│   │   ├── ProjectSelector
│   │   ├── NewSessionButton
│   │   ├── SessionSearch
│   │   └── SessionList           # React Virtuoso
│   │       └── SessionItem
│   │
│   └── ChatArea
│       ├── ProjectInfoBar
│       ├── MessageList            # React Virtuoso (底部对齐)
│       │   ├── UserMessage
│       │   ├── AssistantMessage
│       │   │   ├── MarkdownRenderer  # react-markdown + Shiki
│       │   │   └── ThinkingBlock     # 可折叠
│       │   └── ToolCard
│       │       ├── ToolHeader    # 图标 + 名称 + 风险标识
│       │       ├── ToolInput     # 参数展示
│       │       ├── ToolResult    # 执行结果
│       │       └── DiffView      # react-diff-viewer-continued
│       ├── AutoAcceptBanner       # 黄色警告条
│       ├── PermissionBar          # 底部固定操作栏
│       └── InputArea
│           ├── TextInput          # 2-10 行自适应
│           └── SendButton / StopButton
│
└── SettingsOverlay
    ├── AppearanceSettings
    ├── ClaudePathSettings
    ├── AutoAcceptSettings
    └── ShortcutSettings
```

### 5.2 关键组件技术选型

| 组件 | 技术方案 | 说明 |
|------|----------|------|
| MessageList | React Virtuoso | 内置底部对齐、动态高度、反向加载历史 |
| SessionList | React Virtuoso | 虚拟滚动长列表 |
| Markdown 渲染 | react-markdown + remark-gfm | GFM 支持（表格、任务列表、脚注） |
| 代码高亮 | Shiki | VS Code 级高亮质量，rehype-highlight 集成 |
| Diff 视图 | react-diff-viewer-continued | unified/split 切换，GitHub 风格 |
| 嵌入终端 | @xterm/xterm + node-pty | 仅用于 AuthGate 登录流程 |
| 图标 | lucide-react | 轻量一致 |

---

## 6. 会话管理

### 6.1 Claude Code 会话存储结构

```
~/.claude/
├── projects/
│   └── <encoded-cwd>/           # 路径编码：非字母数字字符 → '-'
│       └── <session-uuid>.jsonl  # 例: /Users/me/proj → -Users-me-proj
├── history.jsonl                 # 全局会话索引
└── .credentials.json             # OAuth 凭证（macOS 存 Keychain）
```

**JSONL 记录结构：**

```json
{
  "type": "user|assistant|system|result|summary|file-history-snapshot|custom-title",
  "message": {
    "role": "user|assistant",
    "content": [
      {"type": "text", "text": "..."},
      {"type": "tool_use", "id": "...", "name": "...", "input": {}},
      {"type": "tool_result", "tool_use_id": "...", "content": "..."}
    ]
  },
  "timestamp": "2026-03-09T10:00:00.000Z",
  "parentUuid": "...",
  "uuid": "...",
  "turn": 1,
  "cost": {"inputTokens": 100, "outputTokens": 50, "usdCost": 0.001},
  "model": "claude-opus-4-6"
}
```

**全局索引（history.jsonl）：**

```json
{
  "prompt": "用户输入文本",
  "timestamp": "2026-03-09T10:00:00.000Z",
  "projectPath": "/Users/me/proj",
  "sessionId": "cf70db2f-..."
}
```

### 6.2 会话生命周期

**新建会话：**
1. 生成新 sessionId（UUID）
2. 首次发消息时 spawn claude 进程（`--session-id <newId>`）
3. Claude Code 自动创建 JSONL 文件

**加载历史会话：**
1. 扫描 `~/.claude/projects/<encoded-cwd>/*.jsonl`
2. 解析元数据：title（优先 `custom-title` 记录，否则首条 user 消息前 30 字）、lastActive、messageCount
3. 辅助参考 `~/.claude/history.jsonl` 获取全局索引
4. 按 lastActive 倒序排列

**恢复会话：**
1. 读取 JSONL 文件 → 解析为 ChatMessage[] 展示
2. 用户发消息时 spawn claude 进程（`--resume <sessionId>`）

### 6.3 JSONL 解析适配器

```typescript
class JsonlParser {
  parseSessionFile(filePath: string): ChatMessage[]
  getSessionTitle(filePath: string): string  // custom-title 优先
  parseStreamEvent(line: string): StreamEvent
}
```

独立适配器模式，CLI 格式变更时只需修改此层。对未知字段做容错处理。

---

## 7. IPC 通信协议

所有 IPC 通信**仅使用异步模式**（禁止 `ipcRenderer.sendSync`）。

| API | 方向 | 说明 |
|---|---|---|
| `claude.sendMessage(sessionId, text)` | R→M | 发送用户消息 |
| `claude.onStreamEvent(cb)` | M→R | 订阅实时 stream-json 事件 |
| `claude.abort(sessionId)` | R→M | SIGINT 终止当前进程 |
| `claude.onPermissionRequest(cb)` | M→R | 权限确认请求推送 |
| `claude.confirmPermission(toolUseId, allow)` | R→M | 响应权限确认（通过 stdin 写入） |
| `session.list(projectPath)` | R→M | 扫描 JSONL 获取会话列表 |
| `session.load(sessionId)` | R→M | 读取解析 JSONL 文件 |
| `session.create(projectPath)` | R→M | 创建新会话（仅生成 ID） |
| `session.delete(sessionId)` | R→M | 删除 JSONL 文件 |
| `project.list()` | R→M | 获取已注册项目 |
| `project.add(path)` | R→M | 注册项目目录 |
| `project.getClaudeMd(path)` | R→M | 读取 CLAUDE.md |
| `config.get/set` | R→M | electron-store 读写 |
| `app.checkCli()` | R→M | 检测 CLI 安装和认证状态 |
| `app.getAuthStatus()` | R→M | 调用 `claude auth status` 返回 JSON |

---

## 8. 认证流程

### 8.1 `claude auth status` 返回结构

```json
{
  "email": "user@example.com",
  "plan": "pro|max|team|enterprise",
  "tokenExpiresAt": 1748658860401,
  "scopes": ["user:inference", "user:profile"],
  "authenticated": true
}
```

- 退出码 `0` = 已登录，`1` = 未登录
- OAuth token 有效期 8-12 小时
- macOS 凭证加密存储在 Keychain

### 8.2 启动检测流程

```
应用启动
  │
  ├─ `claude --version` → 失败 → InstallGuide
  │
  ├─ `claude auth status` → exit 1 → LoginGuide (xterm.js)
  │
  └─ authenticated: true → MainLayout
```

---

## 9. 视觉设计

| 属性 | 值 |
|------|---|
| 浅色基底 | `#F4F3EE` (Pampas) |
| 深色基底 | 暖灰（非纯黑） |
| 主交互色 | `#C15F3C` (Terracotta) |
| 辅助色 | `#B1ADA1` (Cloudy) |
| 正文字体 | Georgia, serif |
| UI 控件 | -apple-system, BlinkMacSystemFont, Segoe UI |
| 代码字体 | JetBrains Mono / Fira Code |
| 动效 | 150-200ms 过渡，可全局关闭 |
| 最小窗口 | 800 × 600 px |
| 侧边栏折叠 | 窗口宽度 < 900px |

---

## 10. 构建与打包

### 10.1 项目结构

```
├── electron.vite.config.ts       # 构建配置
├── src/
│   ├── main/                     # Main Process
│   ├── preload/                  # Preload Scripts
│   └── renderer/                 # React App
├── electron-builder.yml          # 打包配置
└── package.json
```

开发时 electron-vite 提供 HMR，生产构建输出到 `out/` 目录，再由 electron-builder 打包。

### 10.2 Tailwind CSS v4 配置

v4 使用 CSS-native 配置（非 JS）：

```css
/* src/renderer/styles/global.css */
@import "tailwindcss";

@theme {
  --color-pampas: #F4F3EE;
  --color-terracotta: #C15F3C;
  --color-cloudy: #B1ADA1;
  --font-serif: Georgia, serif;
  --font-mono: "JetBrains Mono", "Fira Code", monospace;
}
```

Vite 集成使用 `@tailwindcss/postcss` 替代旧版 PostCSS 插件。

---

## 11. 里程碑

| 阶段 | 交付内容 |
|---|---|
| **M0** | electron-vite 脚手架 + ClaudeService（CLI spawn + stream-json）+ JSONL 解析器 + IPC 骨架 + AuthChecker |
| **M1** | ChatArea UI + react-markdown/Shiki 渲染 + React Virtuoso 消息列表 + InputArea |
| **M2** | PermissionBar（stdin 权限确认）+ 工具卡片（含风险标识）+ DiffView + 自动接受模式 |
| **M3** | Sidebar + SessionList + ProjectSelector + JSONL 会话历史加载 + SettingsOverlay |
| **M4** | electron-builder 打包（dmg，无签名）+ electron-updater + 窗口状态记忆 + Bug 修复 |

---

## 12. 依赖清单

### Renderer

```json
{
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "zustand": "latest",
  "react-markdown": "latest",
  "remark-gfm": "^4.0.0",
  "rehype-highlight": "latest",
  "shiki": "latest",
  "react-virtuoso": "latest",
  "react-diff-viewer-continued": "latest",
  "@xterm/xterm": "latest",
  "lucide-react": "latest"
}
```

shadcn/ui 组件通过 CLI 按需安装（不是 npm 依赖）。

### Main Process

```json
{
  "electron-store": "^9.0.0",
  "electron-updater": "latest",
  "node-pty": "latest"
}
```

### 构建

```json
{
  "electron-vite": "latest",
  "electron-builder": "latest",
  "@tailwindcss/postcss": "latest",
  "tailwindcss": "^4.0.0"
}
```

---

## 13. 决策与风险

### 已决策

| 决策 | 选择 | 理由 |
|---|---|---|
| CLI 集成方式 | child_process.spawn + stream-json | 官方程序集成接口，无额外依赖，最稳定 |
| 构建工具 | electron-vite + electron-builder | 成熟的 Vite 集成 + 灵活的打包控制 |
| Markdown | react-markdown + rehype-highlight | 生态成熟，插件丰富，Shiki 集成 |
| 虚拟列表 | React Virtuoso | 聊天场景专用，内置底部对齐和动态高度 |
| 代码签名 | MVP 阶段不签名 | 无 Apple Developer ID |
| 权限处理 | stdin 写入确认/拒绝 | 直接利用 CLI 的交互机制 |
| 会话模型 | 多进程（活跃对话各自独立进程） | 进程隔离，避免内存泄漏 |

### 待验证

1. **`--resume` 跨进程恢复会话** — 需实际测试在新进程中恢复完整上下文的行为
2. **stdin 权限确认的 JSON 格式** — 需抓包确认 `--input-format stream-json` 模式下权限响应的具体格式
3. **Electron 40.8.0 + Node 24 兼容性** — 需测试 node-pty、electron-store v9 等原生模块兼容性

### 风险

| 等级 | 风险 | 应对 |
|---|---|---|
| 🔴 高 | Claude Code CLI 输出格式 breaking change | 解析层独立为适配器模式，版本变更只需修改适配器 |
| 🟡 中 | stdin 权限确认机制文档不完整 | 降级为 `--allowedTools` 预批准 + UI 提示 |
| 🟡 中 | Electron 40 原生模块兼容问题 | 降级到 Electron 39（Node 22，更成熟） |
| 🟢 低 | Tailwind v4 配置差异 | 新项目直接使用 v4，无迁移成本 |

---

*— End of Document —*
