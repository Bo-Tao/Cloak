# CLOAK

**Claude Code Desktop GUI**

Product Requirements Document

| 项目     | 内容                           |
| -------- | ------------------------------ |
| 产品名称 | Cloak                          |
| 文档版本 | v1.0                           |
| 创建日期 | 2026-03-09                     |
| 作者     | 薄涛                           |
| 状态     | Draft                          |
| 目标平台 | macOS（优先）→ Windows / Linux |

---

## 目录

1. [产品概述](#1-产品概述)
2. [技术架构](#2-技术架构)
3. [功能需求详述](#3-功能需求详述)
4. [UI/UX 设计规范](#4-uiux-设计规范)
5. [数据模型](#5-数据模型)
6. [非功能需求](#6-非功能需求)
7. [发布与更新策略](#7-发布与更新策略)
8. [里程碑规划](#8-里程碑规划)
9. [风险与应对](#9-风险与应对)
10. [开放问题](#10-开放问题)

---

## 1. 产品概述

### 1.1 产品定位

Cloak 是一款基于 Electron 的桌面应用，为 Claude Code CLI 提供图形化操作界面。它通过调用用户本地已安装的 Claude Code 命令行工具，将终端交互转化为可视化的对话式体验，降低非命令行用户使用 Claude Code 的门槛。

### 1.2 目标用户

- **主要用户：** 有一定开发经验但不习惯或不喜欢纯命令行交互的开发者
- **次要用户：** 团队中需要使用 Claude Code 完成文档处理、脚本生成、代码审查等轻量任务的技术相关人员（如测试、产品、技术写作）
- **排除用户：** 完全无技术背景的非技术人员（Claude Code 的底层能力决定了用户需要理解文件系统和基本开发概念）

### 1.3 核心价值主张

1. **可视化对话体验：** 将 Claude Code 的流式文本输出转化为结构化的消息卡片，包含 Markdown 渲染、代码高亮、Diff 视图等富媒体展示
2. **直觉式权限管理：** 将 CLI 的文本确认提示转化为可视化操作栏，让用户一眼看清 Claude 要执行什么操作，一键决定是否允许
3. **多项目工作区：** 支持在多个项目目录之间快速切换，每个项目独立维护对话上下文和配置
4. **零额外依赖：** 不引入独立后端服务，不需要额外的 API Key 配置，完全复用本地 Claude Code 的认证和能力

### 1.4 产品边界（不做什么）

- 不替代 Claude Code CLI 的任何能力，仅做 UI 层封装
- 不直接调用 Anthropic API，所有 AI 能力通过 Claude Code CLI 中转
- 不实现 Web 版，仅做桌面端
- 不实现远程协作或多人共享功能
- MVP 阶段不实现插件/扩展系统

---

## 2. 技术架构

### 2.1 整体架构

采用 Electron 的标准双进程模型，Main Process 负责业务逻辑和子进程管理，Renderer Process 负责 UI 渲染。两者通过 contextBridge + IPC 通信。

| 层级     | 技术选型                 | 职责                          |
| -------- | ------------------------ | ----------------------------- |
| Renderer | React 19 + TypeScript    | UI 渲染、消息流展示、用户交互 |
| 样式     | Tailwind CSS + shadcn/ui | 组件库与原子化样式            |
| 状态管理 | Zustand                  | 全局状态：会话、项目、配置    |
| 构建     | electron-vite + Vite     | 开发服务器、HMR、产物构建     |
| 打包     | electron-builder         | dmg / nsis / AppImage 输出    |
| 自动更新 | electron-updater         | 应用版本检测与增量更新        |
| 本地存储 | electron-store           | 轻量应用配置持久化            |

### 2.2 进程模型与 IPC 设计

#### 2.2.1 Main Process 核心模块

**ClaudeService：** 核心服务，封装 Claude Code CLI 子进程的全生命周期管理。通过 `child_process.spawn` 启动 `claude` 命令（附带 `--output-format stream-json` 参数），持续从 stdout 读取 JSON 流并解析为结构化消息事件。负责向 stdin 写入用户输入和权限确认响应。维护子进程的健康检查和异常恢复（进程崩溃时自动重启并恢复会话上下文）。

**SessionManager：** 会话管理器，维护当前活跃会话和历史会话列表。每个会话绑定一个项目目录（cwd）和一个 ClaudeService 实例。负责会话的创建、切换、归档。会话数据直接读取 Claude Code 的本地存储文件（位于 `~/.claude/projects/<project-hash>/*.jsonl`），无需额外维护数据库。会话标题从 JSONL 文件中解析：优先读取 `custom-title` 类型记录的 `customTitle` 字段，若不存在则取首条用户消息前 30 字符。

**ProjectManager：** 项目管理器，维护已注册的项目目录列表。检测目录下的 CLAUDE.md 配置文件并解析展示。提供项目级的默认配置（如自动接受模式的开关状态）。

**AuthChecker：** 认证检测模块，启动时调用 `claude auth status` 检查登录状态。未登录时引导用户通过应用内的嵌入式终端完成 `claude auth login` 流程。

**UpdateService：** 自动更新服务，基于 electron-updater 实现。支持 GitHub Releases 作为更新源。检测到新版本时在 UI 层展示更新提示，用户确认后后台下载并在下次启动时安装。

#### 2.2.2 IPC 通信协议

通过 contextBridge 向 Renderer 暴露类型安全的 API 接口，所有方法均为 Promise 或 EventEmitter 模式：

| API | 类型 | 说明 |
| --- | --- | --- |
| `claude.send(msg)` | Promise | 发送用户消息到 Claude Code 子进程的 stdin |
| `claude.onChunk(cb)` | Event | 订阅流式输出事件，每个 chunk 是一个解析后的 JSON 对象 |
| `claude.abort()` | Promise | 中断当前正在执行的 Claude Code 操作 |
| `claude.confirm(id, bool)` | Promise | 响应权限确认请求（accept/reject） |
| `session.create(cwd)` | Promise | 在指定目录创建新会话 |
| `session.switch(id)` | Promise | 切换到指定会话 |
| `session.list()` | Promise | 获取所有会话列表 |
| `project.list()` | Promise | 获取已注册项目列表 |
| `project.add(path)` | Promise | 注册新项目目录 |
| `config.get(key)` | Promise | 读取配置项 |
| `config.set(key, val)` | Promise | 写入配置项 |

### 2.3 stream-json 输出解析

Claude Code 的 `--output-format stream-json` 模式会在 stdout 中逐行输出 JSON 对象。每个对象包含一个 `type` 字段标识消息类型。Cloak 需要处理以下核心类型：

| type | 含义 | UI 渲染方式 |
| --- | --- | --- |
| `assistant` | Claude 的文本回复 | Markdown 渲染为消息卡片，支持流式逐字显示 |
| `tool_use` | Claude 请求使用工具 | 展示工具名称和参数，触发权限确认 UI |
| `tool_result` | 工具执行结果 | 根据工具类型差异化渲染（代码/文件/终端输出） |
| `result` | 本轮对话完成 | 解除 loading 状态，展示 token 用量统计 |
| `error` | 错误信息 | 错误提示卡片，提供重试按钮 |

---

## 3. 功能需求详述

### 3.1 认证与启动

#### 3.1.1 启动流程

1. 应用启动后，Main Process 执行 `claude --version` 检测本地 Claude Code 是否已安装
2. 若未安装，展示引导页面，提供安装说明和官方链接
3. 若已安装，执行 `claude auth status` 检测认证状态
4. 若未认证，展示登录引导页面，用户点击后在嵌入式终端中执行 `claude auth login`
5. 认证通过后进入主界面，自动加载上次打开的项目

#### 3.1.2 异常处理

- Claude Code 二进制路径不在 PATH 中：提示用户手动指定路径或修复 PATH 环境变量
- 认证过期：在对话过程中检测到 401 错误时自动弹出重新认证引导
- 网络不可用：展示离线提示，但保留已有会话的浏览能力

### 3.2 核心对话界面

#### 3.2.1 消息流

对话界面采用经典的聊天气泡布局，上方为消息流区域，下方为输入区域。

**用户消息：** 右对齐气泡，展示纯文本输入内容。支持多行文本，Shift+Enter 换行，Enter 发送。

**Claude 回复：** 左对齐卡片，内容经过 Markdown 渲染。支持流式逐字显示（打字机效果），渲染过程中底部自动滚动跟随。包含代码块高亮（Shiki 引擎）、表格、链接等富文本元素。

**工具调用卡片：** 特殊样式的折叠卡片，默认折叠展示工具名称和操作摘要，展开后显示完整参数和执行结果。不同工具类型使用不同图标和色彩标识：文件读取（蓝色）、文件写入（橙色）、命令执行（绿色）、搜索（紫色）。

**Diff 视图：** 当工具类型为文件编辑时，以 side-by-side 或 unified diff 的形式展示变更内容，红绿色标识删增行。

#### 3.2.2 输入区域

- 多行文本输入框，高度自适应（最小 2 行，最大 10 行，超出滚动）
- 发送按钮：Enter 发送，Shift+Enter 换行
- 停止按钮：Claude 正在响应时，发送按钮变为停止按钮，点击后调用 `claude.abort()`
- 附件能力：MVP 暂不支持文件附件，输入框仅支持纯文本

#### 3.2.3 对话管理

- 左侧面板展示历史会话列表，按时间倒序排列
- 每个会话项展示：会话标题、关联项目名称、最后活跃时间。标题取值逻辑——优先读取 session JSONL 文件中 `type: "custom-title"` 记录的 `customTitle` 字段（如 `{"type":"custom-title","customTitle":"SessionName-测试","sessionId":"..."}`），若不存在则取首条用户消息前 30 字符
- 支持新建会话、删除会话、搜索历史会话
- 切换会话时保留当前会话的子进程状态（后台挂起），切换回来时恢复

### 3.3 权限确认系统

这是 Cloak 相对于 CLI 体验提升最大的模块。Claude Code 在执行敏感操作前需要用户确认，Cloak 将这些确认转化为可视化交互。

#### 3.3.1 底部固定操作栏

当 Claude Code 请求执行需要确认的操作时，消息流底部弹出一个固定操作栏，包含以下信息：

- **操作描述：** 可读化的操作摘要，例如「写入文件 src/components/Header.tsx」「执行命令 npm install lodash」
- **风险等级标识：** 低风险（文件读取、搜索）使用灰色/蓝色，中风险（文件写入、创建）使用橙色，高风险（删除文件、执行 shell 命令）使用红色
- **操作按钮：** 「允许」（绿色主按钮）和「拒绝」（灰色次按钮），支持键盘快捷键 Y/N
- 操作栏在用户做出选择前保持固定展示，阻断新消息的输入（但不阻断消息流的展示）

#### 3.3.2 自动接受模式

提供全局和项目级的「自动接受」开关，开启后自动批准所有权限请求。

- 全局开关位于设置页面，项目级开关位于项目配置中（项目级覆盖全局）
- 开启自动接受时，在输入区域上方展示持久的黄色警告条：「自动接受模式已开启 — Claude 将自动执行所有操作」
- 自动接受模式仍然会在消息流中展示操作卡片（标记为「已自动接受」），用户可回溯查看
- 首次开启自动接受模式时弹出二次确认对话框，说明风险

### 3.4 多项目管理

#### 3.4.1 项目注册与切换

- 顶部栏展示当前项目名称和路径，点击展开项目下拉列表
- 下拉列表展示所有已注册项目，支持搜索过滤
- 「添加项目」按钮打开系统文件夹选择器（`dialog.showOpenDialog`），选择后注册为新项目
- 切换项目时自动切换关联的会话，若该项目无活跃会话则新建一个

#### 3.4.2 项目配置

- 每个项目独立维护：默认工作目录、自动接受模式开关、自定义 claude 启动参数
- 检测并展示项目目录下的 CLAUDE.md 文件内容（只读展示，点击可在默认编辑器中打开）
- 项目配置通过 electron-store 持久化，以项目路径为 key 存储配置对象

### 3.5 设置页面

#### 3.5.1 通用设置

- 外观：主题切换（浅色 / 深色 / 跟随系统），字体大小调节（12-20px）
- Claude Code 路径：自动检测或手动指定 claude 二进制路径
- 默认启动参数：全局的 claude 命令附加参数
- 自动接受模式：全局开关（可被项目级覆盖）

#### 3.5.2 快捷键设置

支持自定义以下快捷键（展示默认值，可由用户修改）：

| 操作         | macOS 默认       | Windows 默认      |
| ------------ | ---------------- | ----------------- |
| 新建会话     | Cmd+N            | Ctrl+N            |
| 切换项目     | Cmd+K            | Ctrl+K            |
| 允许操作     | Y                | Y                 |
| 拒绝操作     | N                | N                 |
| 中断当前操作 | Cmd+C (输入框外) | Ctrl+C (输入框外) |
| 打开设置     | Cmd+,            | Ctrl+,            |
| 搜索会话     | Cmd+F            | Ctrl+F            |

---

## 4. UI/UX 设计规范

### 4.1 布局结构

应用采用经典的三栏布局，但 MVP 阶段简化为双栏：

- **左侧边栏（240px 固定宽度，可折叠）：** 项目选择器 + 会话历史列表。折叠后仅显示图标。
- **主内容区（自适应宽度）：** 顶部为项目信息栏，中部为消息流，底部为输入区域和权限操作栏。

设置页面以全屏覆盖层（overlay）形式展示，不破坏主布局结构。

### 4.2 设计语言

- **视觉风格：** 参考 Claude Desktop 的设计语言，温暖、人文、克制。整体调性避免冰冷的科技感，追求「与智能体对话」的亲和力。浅色主题以奶油色/暖灰为基底（`#F4F3EE` Pampas），深色主题以温暖的深灰为基底而非纯黑。
- **色彩体系：** 主交互色采用 Claude 标志性的暖赭橙色（Terracotta `#C15F3C` / `#AE5630`），用于主按钮、链接、活跃状态等核心交互元素。辅助色以暖灰（`#B1ADA1` Cloudy）为基底。警告使用琥珀色，危险操作使用红色，成功/确认操作使用柔和绿色。整体色板保持温暖统一的调性。
- **字体：** UI 正文使用衬线体（`Georgia, serif`）营造 Claude 特有的典雅阅读体验，UI 控件标签使用系统默认字体栈（`-apple-system, BlinkMacSystemFont, Segoe UI`），代码使用等宽字体（`JetBrains Mono / Fira Code / 系统等宽字体`）。
- **阴影与层次：** 采用多层柔和阴影营造深度感，避免生硬的边框分割。卡片和面板使用细微的 `border: rgba(0,0,0,0.08)` 配合柔和投影。
- **动效：** 消息出现使用淡入+微小上移（150ms ease-out），侧边栏折叠/展开使用 200ms 宽度过渡，权限操作栏使用从底部滑入动画（200ms）。所有动效可在设置中全局关闭。

### 4.3 响应式与窗口管理

- 最小窗口尺寸：800 × 600 px
- 记住窗口尺寸和位置，下次启动时恢复
- 窗口宽度小于 900px 时自动折叠左侧边栏
- 支持 macOS 原生的窗口管理手势（全屏、分屏）

---

## 5. 数据模型

### 5.1 数据存储策略

Cloak 不维护独立的数据库，会话和消息数据直接复用 Claude Code CLI 的本地文件系统存储，应用配置通过 electron-store 持久化。

| 数据类型 | 存储方式 | 位置 |
| --- | --- | --- |
| 会话历史与消息 | Claude Code 原生 JSONL 文件 | `~/.claude/projects/<project-hash>/*.jsonl` |
| 项目配置 | electron-store | 应用数据目录 `config.json` |
| 全局配置 | electron-store | 应用数据目录 `config.json` |

### 5.2 Claude Code JSONL 文件结构

每个会话对应一个 JSONL 文件，每行是一个独立的 JSON 对象。Cloak 需要解析以下关键记录类型：

| type 字段      | 说明                 | 关键字段                   |
| -------------- | -------------------- | -------------------------- |
| `custom-title` | 用户自定义的会话标题 | `customTitle`, `sessionId` |
| `user`         | 用户发送的消息       | `message`, `timestamp`     |
| `assistant`    | Claude 的回复内容    | `message`, `timestamp`     |
| `tool_use`     | 工具调用请求         | `tool`, `input`            |
| `tool_result`  | 工具执行结果         | `output`, `error`          |

会话标题解析示例：

```json
{
  "type": "custom-title",
  "customTitle": "SessionName-测试",
  "sessionId": "cf70db2f-1ce2-41e1-a098-84a893fcbcc1"
}
```

Cloak 读取 JSONL 文件时，优先查找 `type: "custom-title"` 记录作为会话标题；若不存在，则取首条 `type: "user"` 记录的消息内容前 30 字符。

### 5.3 electron-store 配置项

| Key | 类型 | 说明 |
| --- | --- | --- |
| theme | string | light / dark / system |
| fontSize | number | 全局字体大小（12-20） |
| claudeBinaryPath | string | Claude Code 二进制路径（空则自动检测） |
| globalAutoAccept | boolean | 全局自动接受模式 |
| globalClaudeArgs | string[] | 全局附加启动参数 |
| window.bounds | object | 窗口尺寸与位置 { x, y, width, height } |
| sidebarCollapsed | boolean | 侧边栏是否折叠 |
| lastProjectId | string | 上次打开的项目 ID |
| shortcuts | object | 自定义快捷键映射 |
| reduceMotion | boolean | 减少动效（无障碍） |
| projects | object | 项目配置映射，以项目路径为 key，值为 `{ name, autoAccept, claudeArgs }` |

---

## 6. 非功能需求

### 6.1 性能指标

- **首屏渲染：** 冷启动到可交互状态 < 3 秒
- **消息渲染延迟：** 接收到 stream-json chunk 到 UI 更新 < 50ms
- **长对话性能：** 1000+ 条消息的会话仍保持流畅滚动（虚拟列表）
- **内存占用：** 空闲状态 < 200MB，活跃对话状态 < 400MB

### 6.2 稳定性

- Claude Code 子进程崩溃不影响应用主进程，自动展示错误提示并提供重启按钮
- 网络中断不导致应用崩溃，断线后自动重连
- 所有会话数据由 Claude Code CLI 原生管理并持久化到本地 JSONL 文件，应用崩溃不丢失数据

### 6.3 安全性

- 使用 contextBridge 隔离 Main/Renderer 进程，Renderer 无法直接访问 Node API
- 不存储任何 API Key 或认证凭据（完全依赖 Claude Code 自身的认证机制）
- 子进程的 spawn 严格限制为 claude 命令，不执行任意命令
- 自动更新使用签名校验，防止中间人攻击

### 6.4 可访问性

- 所有交互元素支持键盘导航
- 关键操作区域支持 ARIA 标签
- 提供减少动效选项（prefers-reduced-motion 适配）
- 色彩对比度符合 WCAG AA 标准

---

## 7. 发布与更新策略

### 7.1 MVP 发布计划

- **平台：** macOS（Apple Silicon + Intel 通用二进制）
- **分发格式：** .dmg 安装包
- **更新源：** GitHub Releases（electron-updater 原生支持）
- **代码签名：** Apple Developer ID 签名 + 公证（Notarization），否则 macOS Gatekeeper 会阻止安装

### 7.2 后续平台扩展

- **Windows：** NSIS 安装包，支持自动更新。需注意 PATH 环境变量检测逻辑差异（`where claude` vs `which claude`）。
- **Linux：** AppImage + .deb。自动更新在 Linux 上支持有限，考虑降级为检测提示 + 手动下载。

### 7.3 自动更新流程

1. 应用启动时自动调用 `autoUpdater.checkForUpdates()`
2. 检测到新版本后在 UI 右上角展示小红点提示
3. 用户点击后展示更新说明（Release Notes）和「立即更新」按钮
4. 后台下载更新包，下载完成后提示用户重启应用以完成安装
5. 用户可选择「稍后提醒」延迟更新

---

## 8. 里程碑规划

| 阶段 | 预估周期 | 交付内容 |
| --- | --- | --- |
| **M0** | 第 1-2 周 | 项目脚手架搭建、ClaudeService 核心模块开发、stream-json 解析验证 |
| **M1** | 第 3-4 周 | 对话界面 UI、Markdown/代码渲染、基础消息流交互 |
| **M2** | 第 5-6 周 | 权限确认系统（操作栏 + 自动接受）、Diff 视图 |
| **M3** | 第 7-8 周 | 多项目管理、JSONL 会话历史读取与展示、设置页面 |
| **M4** | 第 9-10 周 | 自动更新、macOS 签名公证、打包测试、Bug 修复 |
| **MVP** | 第 10 周末 | macOS 版本公开发布 |

---

## 9. 风险与应对

| 等级 | 风险描述 | 概率 | 应对策略 |
| --- | --- | --- | --- |
| 🔴 高 | Claude Code CLI 输出格式在后续版本中发生 breaking change | 中 | 将解析层独立为适配器模式，版本变更时只需修改适配器 |
| 🔴 高 | Anthropic 官方发布 Claude Code 桌面版导致 Cloak 价值降低 | 中 | 保持轻量快速迭代，聚焦差异化功能（如场景模板、团队协作） |
| 🟡 中 | 多轮对话的持久子进程长时间运行后内存泄漏 | 中 | 设定子进程最大存活时间，超时后重启并通过 --resume 恢复会话 |
| 🟡 中 | macOS 代码签名和公证流程复杂导致发布延迟 | 高 | M0 阶段即开始配置 CI/CD 签名流程，不留到最后 |
| 🟢 低 | Claude Code 的 JSONL 文件格式在后续版本中结构调整 | 低 | JSONL 解析层做版本兼容适配，对未知字段做容错处理 |

---

## 10. 开放问题

以下问题需在开发过程中进一步确认和决策：

1. **Claude Code 的 --resume 参数是否支持跨进程恢复会话？** 这决定了切换会话时是否可以杀死旧子进程并通过 --resume 在新子进程中恢复。需要实际测试验证。

2. **权限确认的粒度是否可配置？** 当前设计为全局的自动接受开关。后续是否需要更细粒度的控制（如「自动接受文件读取，但文件写入需确认」），需要根据用户反馈决定。

3. **是否需要在 Cloak 内嵌入完整终端？** 当前 MVP 不包含 xterm.js 终端模拟。如果用户频繁需要查看 Claude Code 执行的 shell 命令的完整输出（包括 ANSI 颜色），可能需要在 M3 之后追加此功能。

4. **开源策略？** Cloak 是否开源、选择什么许可证、是否接受社区贡献，需要在 MVP 发布前确定。

---

_— End of Document —_
