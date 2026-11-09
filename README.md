# LangChain.js 学习笔记

这是一个以 LangChain.js 为主线的渐进式学习仓库，从最基础的消息调用一路走到工具调用、Agent 与 MCP（Model Context Protocol）。每个目录都是一个可独立运行的小项目，按编号顺序学习即可。

## 目录结构

```
LangChainjs/
├── 1.basic/                  # 基础：消息、多模态、结构化输出
│   ├── src/
│   │   ├── 1.message.ts      # 纯文本消息
│   │   ├── 2.multi.ts        # 多模态消息（文本 + 图片）
│   │   ├── 3.struct.ts       # 结构化输出（zod schema）
│   │   └── index.ts          # 多模态综合示例
│   ├── static/png1.png       # 示例图片
│   └── agent_output/         # 示例输出目录
├── 2.tools/                  # 工具调用：手写 ReAct 循环
│   ├── src/
│   │   ├── 1.tool.ts         # 最基础的工具调用
│   │   ├── 2.file-tool.ts    # 文件操作工具
│   │   ├── 3.loop.ts         # 双层 while 的 ReAct 循环
│   │   └── 4.loop_stream.ts  # 流式输出版本的 ReAct 循环
│   ├── files/                # 文件工具的读写工作目录
│   └── .dev-log/             # 运行日志（JSONL）
├── 3.agent/                  # Agent：createAgent + Ollama + MCP
│   ├── src/
│   │   ├── agent.ts          # 用 createAgent 替代手写循环
│   │   ├── ollama-agent.ts   # 本地 Ollama 模型调用
│   │   ├── mcp-server.ts     # 计算器 MCP Server（stdio）
│   │   ├── mcp-client.ts     # 原生 SDK MCP Client
│   │   └── mcp-agent.ts      # MCP 工具接入 Agent
│   └── *.txt                 # 示例运行产物
├── 4.mcp/                    # MCP 专项练习（server / client / agent）
│   └── src/
│       ├── mcp-server.ts
│       ├── mcp-client.ts
│       └── mcp-agent.ts
├── mcp-agent-explained/      # mcp-agent.ts 的图文详解（HTML）
├── notes.md                  # 学习笔记：ReAct 循环核心逻辑
└── README.md
```

## 环境要求

- Node.js >= 20（LangChain.js 1.x 需要较新的运行时）
- pnpm（各子项目都带有 `pnpm-lock.yaml`）
- 一个 OpenAI 兼容的模型服务，默认示例使用 DeepSeek
- 可选：本地 [Ollama](https://ollama.com/)，用于 `ollama-agent.ts` 与 `LLM_PROVIDER=ollama` 模式

## 环境变量

每个子项目目录下都有独立的 `.env`（已被 `.gitignore` 忽略）。参考模板：

```dotenv
# OpenAI 兼容接口
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-flash
LLM_API_KEY=sk-xxxxxxxxxxxxxxxx

# Anthropic 兼容接口（备用）
LLM_ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic

# 可选：切换到本地 Ollama
# LLM_PROVIDER=ollama
# OLLAMA_MODEL=qwen3.5:0.8b

# 本地日志
NODE_ENV=development
NINJA_LOGGER_FORCE=true
```

> 仓库中的 `.env` 仅用于本地演示，请勿把真实 API Key 提交到远程仓库。

## 快速开始

每个子项目都是独立的 TypeScript 工程，`tsc` 会把 `src/` 编译到 `dist/`。

```bash
cd 1.basic
pnpm install
pnpm build          # 等价于 tsc
node dist/index.js  # 运行对应入口
```

开发时可以开一个监听终端：

```bash
pnpm dev            # tsc --watch
```

然后在另一个终端运行编译产物，例如 `node dist/1.message.js`。

## 模块说明

### 1.basic —— 基础调用

| 文件 | 内容 |
| --- | --- |
| `src/1.message.ts` | 最基础的 `HumanMessage` 文本调用，返回 `AIMessage` |
| `src/2.multi.ts` | 多模态输入：`SystemMessage` + 图片（本地文件转 base64 data URL） |
| `src/3.struct.ts` | `withStructuredOutput` + `zod`，把回答约束成结构化 JSON；示例中关闭了 DeepSeek 的思考过程以启用 function calling |
| `src/index.ts` | 综合示例：让模型识别图片并输出美化后的 HTML |

要点：

- 模型通过 `ChatOpenAI` 接入任意 OpenAI 兼容服务，只需改 `LLM_BASE_URL` / `LLM_MODEL`。
- 图片以 `data:image/png;base64,...` 的形式塞进消息，无需先上传。

### 2.tools —— 工具调用与 ReAct 循环

| 文件 | 内容 |
| --- | --- |
| `src/1.tool.ts` | 用 `tool()` + `zod` 定义天气 / 邮件 / 新闻工具，`bindTools` 后手动执行工具并回填结果 |
| `src/2.file-tool.ts` | `manageFile` 工具：`read / create / write / delete`，限制只能操作 `files/` 目录，防止路径穿越 |
| `src/3.loop.ts` | 双层 `while` 的完整 ReAct 循环，带 `MAX_STEPS` 保护 |
| `src/4.loop_stream.ts` | 与 `3.loop.ts` 逻辑一致，但使用 `stream()` 逐块输出思考与回答 |

工具调用的本质：

1. 把用户消息放进消息历史数组；
2. 模型返回 `tool_calls` 时，按 `name` 找到本地工具并执行；
3. 把工具返回的 `ToolMessage` 追加回历史；
4. 再次调用模型，直到模型不再发起工具调用。

`2.tools` 还引入了 `dev-log-monitor/auto`，运行过程中会自动把 `console.log` 结构化写入 `.dev-log/logs-YYYY-MM-DD.jsonl`，方便回看每一步的工具调用与 token 用量。

### 3.agent —— 交给框架做循环

| 文件 | 内容 |
| --- | --- |
| `src/agent.ts` | 用 `createAgent({ model, tools })` 一行接管“模型思考 → 调工具 → 回填”的循环 |
| `src/ollama-agent.ts` | 使用 `ChatOllama` 调用本地模型，并把回答写入 txt 文件 |
| `src/mcp-server.ts` | 基于官方 SDK 的 MCP Server，通过 stdio 暴露加、减、乘、除四个工具 |
| `src/mcp-client.ts` | 原生 MCP Client：拉起 server、列出工具、逐个调用并打印结果 |
| `src/mcp-agent.ts` | `MultiServerMCPClient` 把 MCP 工具自动转换成 LangChain 工具，再交给 `createAgent` |

对比 `2.tools`：`3.agent` 用框架的 `createAgent` 取代手写双层循环，代码更短，但底层仍然是同一套 ReAct 逻辑。

### 4.mcp —— MCP 专项

`4.mcp/src` 与 `3.agent/src` 中的 MCP 三个文件基本一致，是抽出来单独练习 MCP 的最小工程：先跑 `mcp-server.ts` 理解协议，再跑 `mcp-client.ts` 验证工具，最后用 `mcp-agent.ts` 让模型自主决定调用哪个工具。

## ReAct 循环核心逻辑

`notes.md` 记录了循环的本质：

> 把用户消息和工具结果都维护在一个消息历史队列里。先让模型基于当前历史决定下一步；如果模型返回工具调用，就执行对应工具，并把结果作为 tool message 回填；然后再次调用模型，直到模型不再发起工具调用。

对应到代码就是两层 `while`：

- **外层循环**：一轮任务结束后检查是否还有排队的新消息，没有才真正退出；
- **内层循环**：反复执行“模型思考 → 执行工具 → 回填结果”，直到 `tool_calls` 为空；
- `MAX_STEPS`（默认 10）防止模型陷入无限工具调用。

## MCP 说明

`mcp-agent-explained/mcp-agent-explained.html` 是对 `mcp-agent.ts` 的图文详解，直接用浏览器打开即可，包含：

1. 这段代码解决什么问题
2. 整体架构
3. 运行时序
4. 逐段代码解析
5. Agent 工具调用循环
6. 与 `mcp-server.ts` 的对应
7. 容易踩坑的地方
8. 运行与扩展

MCP 使用要点：

- stdio 模式下 **stdout 被协议占用**，Server 内部所有日志必须走 `console.error`；
- 运行 `mcp-client.ts` / `mcp-agent.ts` 前，必须先编译出 `dist/mcp-server.js`；
- `MultiServerMCPClient` 只负责连接，构造时不会立刻启动子进程，`listTools()` 时才拉起；
- 结束时调用 `client.close()` 释放子进程。

## 常见命令

```bash
# 安装依赖
pnpm install

# 编译
pnpm build

# 监听编译
pnpm dev

# 运行指定示例
node dist/<文件名>.js

# 例：先编译再运行 MCP Agent
cd 4.mcp
pnpm build
node dist/mcp-agent.js
```

## 注意事项

- `dist/`、`node_modules/`、`.env*`、`.dev-log/` 等已在根目录 [.gitignore](./.gitignore) 中忽略。
- 所有子项目的 `package.json` 脚本一致（`build` / `dev` / `start`），但入口文件不同，`start` 只适用于存在 `src/index.ts` 的 `1.basic`。
- 示例里的工具（天气、邮件、新闻）都是模拟实现，重点在于演示工具定义与调用链路，替换成真实接口即可。
- 模型响应依赖外部服务，如果出现 401/超时，优先检查 `.env` 中的 `LLM_BASE_URL`、`LLM_API_KEY` 与网络连通性。
