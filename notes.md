# 2.Langchain JS 核心与智能体开发

> 关联文档：20260912 随堂笔记与源码资料

## 课程目标

> 💡
>
> - 初中级：
>
>   1. **掌握 LangChain.js 框架定位与核心包结构**：理解 LangChain 作为 LLM 应用开发框架的核心价值，掌握 @langchain/core 与各模型集成包的分层关系，能够按需安装依赖并搭建项目。
>   2. **掌握模型基础调用与配置参数**：能够使用 ChatOllama 等模型类完成基础对话，理解 temperature、topK、topP、numCtx、maxTokens 等参数的含义和调优方法，掌握 invoke 调用方式。
>   3. **掌握多模态能力与结构化输出**：能够构造包含图片和文本的多模态消息，理解 Base64 图片传输方式；能够使用 Zod Schema 定义输出结构，实现类型安全的结构化 JSON 输出。
>   4. **掌握工具系统与消息系统**：理解 SystemMessage、HumanMessage、AIMessage、ToolMessage 四种消息类型的作用，能够使用 tool 函数和 Zod 定义自定义工具，并将工具绑定到模型。
>   5. **掌握 ReAct Agent 智能代理开发**：理解 ReAct（Reason + Act）范式的"思考-行动-观察"循环，能够使用 createAgent 创建带工具的 Agent，实现流式响应和结构化响应。
> - 高级：
>
>   1. **深入 Runnable 核心抽象与 LCEL 表达式**：理解 Runnable 统一执行契约的设计思想，掌握 invoke/stream/batch/astreamEvents 四种调用方式，理解 RunnableConfig 和管道符组合原理。
>   2. **深入消息系统、模型 IO 与工具系统源码**：理解 BaseChatModel 基类的模板方法模式和模型调用链路，掌握 BaseTool 基类、工具绑定与 Function Calling 的底层实现，理解结构化输出的实现原理。
>   3. **深入 Agent 系统底层实现**：理解 ReAct 循环的源码实现，掌握 createAgent 函数的内部结构，理解 Agent 如何驱动模型进行多轮工具调用，以及流式响应机制的实现原理。

## 课程大纲

> （原文此处为内嵌流程图组件，Markdown 中无法保留）

## 补充资料

- LangChain.js 官方文档：https://js.langchain.com/docs/introduction/
- LangChain.js GitHub 仓库：https://github.com/langchain-ai/langchainjs
- @langchain/core 包文档：https://js.langchain.com/docs/concepts/architecture/
- LangChain.js Agent 指南：https://js.langchain.com/docs/tutorials/agents/
- LangChain.js 结构化输出：https://js.langchain.com/docs/how_to/structured_output/
- Ollama 官方文档：https://github.com/ollama/ollama
- Zod 官方文档：https://zod.dev/

## 相关面试真题

### 请解释 LangChain.js 中 Runnable 接口的作用，为什么说它是整个框架最核心的抽象？invoke、stream、batch 三种调用方式分别适用于什么场景？

Runnable 是 LangChain.js 定义的统一执行契约，所有可执行组件——包括 ChatModel、PromptTemplate、Tool、OutputParser、Chain、Agent——都实现了 Runnable 接口。它的核心价值在于标准化：不同组件虽然内部逻辑完全不同，但对外暴露相同的调用方法，这使得任意组件都可以通过管道符 | 自由组合成处理流水线，而不需要关心彼此的内部实现。

Runnable 接口定义了四种核心调用方式：**invoke** 是最基础的同步调用，接收输入返回完整结果，适合普通的一次性请求-响应场景；**stream** 返回异步迭代器，逐块（chunk）输出结果，适合大模型的流式输出场景，用户可以看到文字逐字生成，显著降低等待感；**batch** 并行处理多个输入，适合批量处理任务，如批量翻译、批量分类，内部通过线程池控制并发；**streamEvents** 输出执行过程中的所有事件，包括嵌套子组件的开始、结束事件，适合做全链路追踪和调试。

Runnable 还提供了统一的配置机制 RunnableConfig，可以传递 callbacks（回调监听）、tags（标签筛选）、metadata（元数据）、maxConcurrency（并发控制）、recursionLimit（递归深度限制）等。理解 Runnable 是理解整个 LangChain 的关键，因为框架的一切组合能力都建立在这个统一接口之上。

### LangChain.js 的 Agent 是如何实现 ReAct 循环的？请描述从用户提问到 Agent 调用工具再到返回最终答案的完整流程。

ReAct（Reasoning + Acting）是 Agent 的核心范式，它让大模型在"思考推理"和"执行行动"之间交替循环，直到解决问题。LangChain.js 的 createAgent 函数内部实现了这个循环，完整流程如下：

第一步，用户输入问题，Agent 将系统提示（包含工具说明和 ReAct 指令）、对话历史和用户消息组装后发送给模型。第二步，模型进行推理（Thought），判断是否需要调用工具。如果模型认为当前信息足以回答问题，直接生成最终答案，循环结束。第三步，如果模型决定调用工具，会通过 Function Calling 机制返回工具调用请求（包含工具名称和参数），而不是普通文本。Agent 解析这些请求，并行执行对应的工具函数。第四步，工具执行完成后，Agent 将工具返回结果封装为 ToolMessage 加入消息列表，连同完整对话历史再次发送给模型。模型看到工具结果后继续推理——可能调用更多工具，也可能基于结果生成最终答案。第五步，重复"模型推理→工具调用→结果观察"的循环，直到模型不再请求工具、生成最终回答为止。

这个循环的本质是一个 while 循环，终止条件是模型的响应中不再包含 tool_calls。recursionLimit 配置项限制了最大循环次数，防止模型陷入无限工具调用。理解 ReAct 循环的关键是：每次工具调用后，结果都会作为新的消息加入上下文，模型是在看到所有历史（包括之前的思考和工具结果）的基础上进行下一步决策的。

### 请解释 LangChain.js 中结构化输出的实现原理，withStructuredOutput 方法如何让 LLM 输出符合预定义格式的 JSON 数据？

结构化输出解决的是"让 LLM 的输出可以直接被程序消费"的问题。自由文本无法可靠地传入后续代码逻辑，而结构化输出保证模型返回的是符合 Schema 的 JSON 数据。LangChain.js 的 withStructuredOutput 方法通过以下机制实现：

首先，开发者使用 Zod 定义目标数据结构，每个字段可以通过 describe 方法添加自然语言说明。这些说明会被转换为提示信息，帮助模型理解每个字段应该填什么。然后，withStructuredOutput 内部将 Zod Schema 转换为模型支持的 Function Calling 工具定义（JSON Schema 格式），并通过 bindTools 将这个特殊的"输出工具"绑定到模型上。当模型生成响应时，会被引导调用这个工具，工具的参数就是结构化的输出内容。最后，模型返回的工具调用参数经过 Zod 校验和解析，转换为类型安全的对象返回给调用者。如果模型输出不符合 Schema，Zod 会抛出校验错误。

需要注意的是，结构化输出的可靠性依赖于模型的 Function Calling 能力，能力越强的模型遵循 Schema 的准确率越高。因此结构化输出时建议将 temperature 设为 0，降低随机性。withStructuredOutput 的返回值同时包含原始模型和解析方法，开发者也可以选择 includeRaw 获取未解析的原始响应用于调试。

### LangChain.js 为什么要将模型调用抽象为 BaseChatModel 基类？这种设计如何实现不同模型的无缝切换？

BaseChatModel 是 LangChain.js 模型层的核心基类，它的设计采用了模板方法模式（Template Method Pattern），这是实现多模型统一接口的关键。BaseChatModel 在基类中定义了固定的调用流程骨架（invoke → 参数处理 → \_generate → 结果封装），而将具体的 API 调用逻辑声明为抽象方法 \_generate，由各个模型实现类去完成。

以 ChatOllama 为例，它继承 BaseChatModel 并实现 \_generate 方法，在 \_generate 中负责将 LangChain 标准消息格式转换为 Ollama API 要求的请求格式，发送 HTTP 请求，再将响应解析回标准的 AIMessage。而 ChatOpenAI、ChatAnthropic 等类做的事情类似，只是目标 API 不同。对外暴露的 invoke、stream、batch 等方法都由基类统一实现，所有模型类共享相同的调用接口。

这种设计带来的直接好处是模型可替换：业务代码依赖的是 BaseChatModel 抽象而不是具体实现，切换模型时只需更换实例化的类（如从 ChatOllama 换成 ChatOpenAI），后续的 invoke、bindTools、withStructuredOutput 等调用代码完全不需要修改。这也是 LangChain "抽象化"设计哲学的体现——将变化的部分（各厂商 API 差异）封装在实现类中，将稳定的部分（调用契约）保留在基类中。

## LangChain.js 框架概述

### LangChain.js 概述

#### 框架定位

LangChain.js 是 LangChain 框架的官方 JavaScript/TypeScript 实现，专为 Node.js 和浏览器环境设计，是构建 LLM 驱动应用的事实标准框架。它通过**抽象化、模块化、可组合**的设计思想，将大语言模型的通用能力封装为可复用的组件，极大降低了 AI 应用的开发门槛。

LangChain.js 核心提供四大能力：

- **模型抽象层**：统一的模型调用接口，屏蔽不同厂商（OpenAI、Anthropic、Ollama 等）的 API 差异，实现模型的无缝切换
- **工具系统**：标准化的工具定义与调用机制，扩展 LLM 与外部世界交互的能力
- **Agent 框架**：基于 ReAct 等范式的智能代理实现，支持自主思考、规划与任务执行
- **RAG 支持**：完整的检索增强生成工具链，涵盖文档加载、文本分割、向量化、检索与生成全流程

#### 核心包结构

LangChain.js 采用**分层模块化架构**，包职责清晰，支持按需引入，避免不必要的依赖：

```text
@langchain/core        # 核心抽象层（所有包的基础，定义接口、基类、消息结构）
├─ @langchain/ollama      # Ollama 模型集成
├─ @langchain/openai      # OpenAI 模型集成
├─ @langchain/anthropic   # Anthropic 模型集成
├─ @langchain/community   # 社区贡献的第三方集成（向量库、工具、文档加载器等）
├─ @langchain/textsplitters # 文本分割器组件
├─ @langchain/vectorstores # 向量数据库抽象与实现
└─ langchain              # 高层应用 API（Agent、高阶 Chain、快捷方法）
```

**包依赖关系说明**：

- `@langchain/core` 是唯一的基础依赖，不包含任何第三方集成
- 所有模型集成包（如 `@langchain/ollama`）仅依赖 `@langchain/core`
- `langchain` 包依赖所有核心组件，提供开箱即用的完整能力
- 生产环境推荐按需引入最小依赖集，减小包体积

## 模型调用、多模态与结构化输出

### 模型基础使用

#### Hello World

这是 LangChain.js 最简单的完整示例，演示了如何调用本地 Ollama 模型进行对话：

```TypeScript
// langchainjs-demo/src/1.hello-world/index.ts
// 从 Ollama 集成包导入 ChatOllama 类
import { ChatOllama } from "@langchain/ollama";

// 初始化模型实例，指定使用的模型名称
const llm = new ChatOllama({
  model: "qwen3:0.6b", // 使用通义千问3 0.6B参数轻量模型，适合本地快速测试
});

// 定义异步调用函数
const invoke = async () => {
  // 调用模型，传入用户输入文本
  const res = await llm.invoke("你好");
  // 打印完整的 AIMessage 响应对象
  console.log(res);
};

// 执行调用
invoke();
```

**代码深度解析：**

1. **ChatOllama 类**：Ollama 模型的官方包装类，实现了 `BaseChatModel` 抽象接口。它负责将 LangChain 的标准消息格式转换为 Ollama API 要求的格式，并将返回结果解析为 LangChain 的 `AIMessage` 对象。
2. **invoke 方法**：模型的同步调用方法，接收字符串或消息数组作为输入，返回一个 Promise，解析完成后得到 `AIMessage` 对象。这是最基础也是最常用的模型调用方式。
3. **模型配置**：除了必填的 `model` 参数外，还可以配置 `baseUrl`、`temperature`、`maxTokens` 等参数，控制模型的行为。

**完整执行流程：**

```text
用户输入字符串 → ChatOllama.invoke() 内部转换为 HumanMessage
→ 构建符合 Ollama API 规范的 HTTP 请求体
→ 发送 POST 请求到 http://localhost:11434/api/chat
→ Ollama 服务加载模型并执行推理
→ 返回 JSON 格式的响应结果
→ ChatOllama 解析响应，封装为 AIMessage 对象
→ 返回给调用者
```

#### 模型配置选项

ChatOllama 支持丰富的配置参数，用于精确控制模型的推理行为：

```TypeScript
const llm = new ChatOllama({
  model: "qwen3:0.6b",
  baseUrl: "http://localhost:11434",  // Ollama 服务地址，默认本地 11434 端口
  temperature: 0.7,                    // 创造性参数，0-1 范围
                                       // 0 = 确定性输出，适合代码、结构化数据
                                       // 1 = 最大创造性，适合创意写作
  topK: 40,                            // Top-K 采样：从概率最高的前 K 个 Token 中选择
  topP: 0.9,                           // Top-P 采样：从累计概率达到 P 的 Token 集合中选择
  repeatPenalty: 1.1,                  // 重复惩罚系数，>1 抑制重复内容
  numCtx: 4096,                        // 上下文窗口大小，单位 Token
  maxTokens: 1024,                     // 最大生成 Token 数
  stop: ["\n\n"],                      // 停止序列，遇到这些字符串时停止生成
});
```

**参数最佳实践：**

- 结构化输出、代码生成：`temperature=0`，保证结果确定性
- 创意写作、头脑风暴：`temperature=0.7-0.9`，增加多样性
- 对话系统：`temperature=0.5-0.7`，平衡创造性与一致性
- 长文本处理：根据模型能力适当增大 `numCtx`

### 多模态能力

#### 图片理解

LangChain.js 原生支持多模态模型调用，能够处理包含图片和文本的混合输入：

```TypeScript
// langchainjs-demo/src/2.model/2.image.ts
import { ChatOllama } from "@langchain/ollama";
import { HumanMessage } from "@langchain/core/messages";
import fs from "node:fs";
import path from "node:path";

// 必须使用支持视觉能力的模型
const llm = new ChatOllama({
  model: "qwen3-vl:2b",  // 通义千问3视觉模型，2B参数
});

const invoke = async () => {
  // 读取本地图片文件，转换为 Base64 编码
  const imagePath = path.resolve(import.meta.dirname, "../../public/miaoma-logo.png");
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");

  // 调用模型，传入多模态消息
  const res = await llm.invoke([
    new HumanMessage({
      content: [
        // 图片内容块
        {
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${base64Image}`,
            // 可选：指定图片细节级别，"low"、"high" 或 "auto"
            detail: "auto"
          },
        },
        // 文本内容块
        {
          type: "text",
          text: "帮我看看图片里面有什么，请使用中文详细描述",
        },
      ],
    }),
  ]);

  console.log(res.content);
};

invoke();
```

**技术要点深度解析：**

1. **多模态消息结构**：`HumanMessage` 的 `content` 字段可以是一个数组，包含多个不同类型的内容块。目前支持 `text` 和 `image_url` 两种类型。
2. **图片传输方式**：

   - **Base64 编码**：将图片数据直接嵌入请求体，适合小图片（<1MB）
   - **URL 引用**：传入可公开访问的图片 URL，适合大图片或网络图片
   - 注意：Ollama 目前仅支持 Base64 编码的本地图片
3. **模型选择**：必须使用支持视觉能力的多模态模型，如 `qwen3-vl`、`llava`、`gemma3:12b-it` 等。纯文本模型无法处理图片输入。

**多模态消息内部结构：**

```text
HumanMessage {
  content: [
    { 
      type: "image_url", 
      image_url: { 
        url: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAAAAAAAD/...",
        detail: "auto"
      } 
    },
    { 
      type: "text", 
      text: "描述这张图片" 
    }
  ],
  role: "user"
}
```

### 结构化输出

#### 使用 Zod Schema

结构化输出是连接 AI 与程序的关键技术，它让 LLM 输出符合预定义格式的 JSON 数据，而不是自由文本。LangChain.js 与 Zod 深度集成，提供类型安全的结构化输出能力：

```TypeScript
// langchainjs-demo/src/2.model/3.structured-output.ts
// 导入 Zod 库，用于定义数据结构
import * as z from "zod";
import { ChatOllama } from "@langchain/ollama";

// 初始化模型，结构化输出建议将 temperature 设置为 0
const llm = new ChatOllama({
  model: "qwen3:0.6b",
  temperature: 0,  // 降低随机性，保证输出格式稳定
});

// 定义输出结构，使用 Zod 的 describe 方法添加字段说明
// 这些说明会被转换为 Prompt 告诉模型
const User = z.object({
  name: z.string().describe("用户的真实姓名，必须是中文"),
  age: z.number().int().min(0).max(150).describe("用户的年龄，必须是整数"),
  gender: z.enum(["男", "女", "未知"]).describe("用户的性别"),
  email: z.string().email().optional().describe("用户的电子邮箱地址"),
});

// 将模型与结构化输出绑定
const modelWithStructure = llm.withStructuredOutput(User, {
  includeRaw: true,  // 同时返回原始 AIMessage 和解析后的结构化对象
  method: "function_call",  // 使用函数调用模式实现结构化输出
  // 可选：method: "json_mode"，直接让模型输出 JSON
});

const invoke = async () => {
  const response = await modelWithStructure.invoke(
    "我是合一，年龄是25岁，性别是男，我的邮箱是 heyi@example.com"
  );

  // response 包含 parsed 和 raw 两个字段（当 includeRaw: true 时）
  console.log("解析后的结构化数据:", response.parsed);
  // 输出: { name: "合一", age: 25, gender: "男", email: "heyi@example.com" }

  console.log("原始模型响应:", response.raw);
};

invoke();
```

**实现原理深度解析：**

1. **Zod Schema 转换**：`withStructuredOutput` 方法会将 Zod Schema 自动转换为一个函数定义，包含函数名、描述和参数结构。
2. **Prompt 注入**：框架会自动将这个函数定义注入到 Prompt 中，告诉模型："你必须调用这个函数，参数必须符合这个结构"。
3. **函数调用模式**：模型被约束为只输出函数调用，而不是自由文本。函数的参数就是我们需要的结构化数据。
4. **自动解析与验证**：框架接收模型输出的 `tool_calls`，提取参数部分，然后使用 Zod Schema 进行类型验证。如果验证失败，会自动重试。

**完整输出保证流程：**

```text
用户输入 → 框架将 Zod Schema 转换为函数定义
→ 注入到系统 Prompt 中
→ LLM 调用 → 模型输出标准 tool_calls 结构
→ 框架提取参数 → Zod 验证参数类型和约束
→ 验证通过 → 返回结构化对象
→ 验证失败 → 自动重试（最多3次）
```

## 工具系统、消息系统与 Agent 开发

### 工具系统

工具系统是 LLM 能力的延伸，它让模型能够调用外部函数，获取实时信息、执行计算或操作外部系统。

工具系统是 LLM 与外部世界交互的桥梁，其底层依赖于模型的 Function Calling（函数调用）能力。理解 Function Calling 的机制，是理解工具系统和 Agent 的基础。传统的纯文本对话中，模型只能返回文字，无法主动触发外部操作。Function Calling 是现代大模型的一项专项能力：开发者在请求中向模型描述可用的函数（名称、功能说明、参数结构），模型在理解用户意图后，如果判断需要调用函数，会返回结构化的函数调用请求（函数名 + 参数值），而不是普通文本。应用程序执行函数后，将结果回传给模型，模型再基于结果生成自然语言回答。

需要强调的是，**模型本身不会执行函数**——它只是决定"应该调用哪个函数、传什么参数"，真正的执行由应用程序完成。这是一个重要的安全边界：模型不直接接触外部系统，所有工具调用都经过应用程序，开发者可以在执行前做权限校验和参数检查。LangChain 的工具系统本质上是对 Function Calling 流程的封装：tool 函数定义工具的描述和参数 Schema，bindTools 将工具信息传给模型，框架自动处理工具请求的解析和结果的回传。

#### 定义和绑定工具

```TypeScript
// langchainjs-demo/src/3.tools/1.model-tools.ts
import { ChatOllama } from "@langchain/ollama";
import { tool } from "@langchain/core/tools";
import * as z from "zod";

// 初始化模型
const llm = new ChatOllama({
  model: "qwen3:0.6b",
});

// 定义工具：使用 tool 高阶函数
const getWeather = tool(
  // 工具的实际执行函数
  async (input) => {
    console.log(`正在查询 ${input.location} 的天气...`);
    // 这里可以调用真实的天气 API
    return `${input.location}今天天气很好，气温25度，晴天，微风。`;
  },
  {
    // 工具元数据
    name: "get_weather",  // 工具唯一标识，不能有空格或特殊字符
    description: "获取给定城市的实时天气信息",  // 工具功能描述，供模型理解
    // 参数 Schema，定义工具接受的参数
    schema: z.object({
      location: z.string().describe("要查询天气的城市名称，例如：北京、上海"),
    }),
  }
);

// 将工具绑定到模型
// 绑定后，模型知道可以使用这些工具
const modelWithTools = llm.bindTools([getWeather]);

const invoke = async () => {
  // 调用模型，传入用户问题
  const res = await modelWithTools.invoke("北京今天天气怎么样？");
  console.log("模型响应:", res);

  // 检查模型是否要求调用工具
  if (res.tool_calls && res.tool_calls.length > 0) {
    // 遍历所有工具调用
    for (const tc of res.tool_calls) {
      console.log(`调用工具: ${tc.name}, 参数:`, tc.args);

      // 执行工具
      if (tc.name === getWeather.name) {
        const toolResult = await getWeather.invoke(tc);
        console.log("工具执行结果:", toolResult);

        // 将工具结果返回给模型，生成最终回答
        const finalResponse = await modelWithTools.invoke([
          new HumanMessage("北京今天天气怎么样？"),
          res,
          new ToolMessage({
            tool_call_id: tc.id,
            content: toolResult,
          }),
        ]);

        console.log("最终回答:", finalResponse.content);
      }
    }
  }
};

invoke();
```

**工具定义三要素深度解析：**

| 要素 | 说明 | 重要性 |
| --- | --- | --- |
| **执行函数** | 工具的实际业务逻辑，接收模型传入的参数，返回执行结果 | 核心 |
| **name** | 工具的唯一标识符，用于模型识别和框架路由 | 必须唯一 |
| **description** | 工具的功能描述，是模型决定是否调用该工具的关键依据 | 描述越清晰准确，模型调用越正确 |
| **schema** | 参数的类型定义和约束，保证模型传入的参数合法 | 避免工具执行错误 |

**完整工具调用流程：**

> （原文此处为内嵌流程图组件，Markdown 中无法保留）

### 消息系统

消息系统是 LangChain 的核心数据结构，用于表示对话中的不同角色和内容类型。

#### 消息类型

LangChain 定义了四种核心消息类型，分别对应对话中的不同角色：

```TypeScript
import {
  HumanMessage,    // 用户发送的消息
  AIMessage,       // AI 生成的响应消息
  SystemMessage,   // 系统提示消息，用于设定 AI 的身份和行为
  ToolMessage,     // 工具执行结果消息
} from "@langchain/core/messages";
```

**各消息类型详解：**

1. **SystemMessage**：对话开始时发送，用于设定 AI 的身份、行为准则、输出格式等。它会影响整个对话的风格和行为。
2. **HumanMessage**：用户输入的消息，可以是纯文本或多模态内容。
3. **AIMessage**：AI 生成的响应消息，包含文本内容、工具调用信息等。
4. **ToolMessage**：工具执行的结果消息，必须与对应的 AIMessage 中的 tool_call 关联。

#### 消息构建示例

```TypeScript
// langchainjs-demo/src/4.messages/1.role.ts
import { ChatOllama } from "@langchain/ollama";
import {
  HumanMessage,
  SystemMessage,
  AIMessage
} from "@langchain/core/messages";

const llm = new ChatOllama({ model: "qwen3:0.6b" });

// 构建多轮对话历史
const messages = [
  // 系统提示：设定 AI 身份
  new SystemMessage("你是一个专业的翻译助手，只负责中英互译，不要回答其他问题。翻译结果要准确、自然。"),
  // 第一轮用户输入
  new HumanMessage("Hello World"),
  // 第一轮 AI 响应
  new AIMessage("你好，世界"),
  // 第二轮用户输入
  new HumanMessage("LangChain is a framework for building applications with LLMs"),
];

// 调用模型，传入完整对话历史
const response = await llm.invoke(messages);
console.log(response.content);
// 输出: "LangChain 是一个用于构建大语言模型应用的框架"
```

**消息历史管理最佳实践：**

- 始终将 SystemMessage 放在消息数组的第一个位置
- 消息按时间顺序排列，最新的消息在最后
- 工具调用必须遵循：HumanMessage → AIMessage(tool_calls) → ToolMessage 的顺序
- 定期清理过长的消息历史，避免超出模型上下文窗口

### Agent 智能代理（ReAct）

如果说 LLM 是一个只有"大脑"的百科全书，那么 **Agent** 就是给这个大脑装上了"手脚"（Tools）和"耳朵"（Sensors）。它不仅能**思考**（Reasoning），还能**规划**（Planning）并**执行任务**（Acting）。

- **LLM 的局限性**：模型训练完成后，知识就截止了（无法获取实时信息）；且模型无法直接操作现实世界（如查天气、写数据库、调用 API）。
- **ReAct 范式**：为了解决上述问题，引入了 **"ReAct" (Reason + Act)** 范式，即让模型在执行行动之前先进行思考推理，明确下一步要做什么、为什么要做，然后再执行相应的工具调用。这种"思考-行动-观察"的循环，让 Agent 具备了解决复杂问题的能力。

#### 创建基础 Agent

```TypeScript
// langchainjs-demo/src/5.agent/1.basic.ts
import { ChatOllama } from "@langchain/ollama";
import { createAgent } from "langchain";

// 创建一个最简单的 Agent，没有工具
const agent = createAgent({
  model: new ChatOllama({
    model: "qwen3:0.6b",
  }),
});

const invoke = async () => {
  const res = await agent.invoke({
    messages: [
      {
        role: "user",
        content: "你好，请介绍一下你自己",
      },
    ],
  });

  console.log("Agent 响应:", res.messages.at(-1).content);
};

invoke();
```

#### 带工具的 Agent

这是最常用的 Agent 形式，能够根据用户问题自主决定是否调用工具：

```TypeScript
// langchainjs-demo/src/5.agent/2.zod.ts
import { ChatOllama } from "@langchain/ollama";
import { createAgent } from "langchain/agents";
import { tool } from "@langchain/core/tools";
import * as z from "zod";

// 定义天气工具
const getWeather = tool(
  async (input) => {
    return `${input.city}今天天气晴朗，气温22-28度，适合外出。`;
  },
  {
    name: "get_weather",
    description: "获取给定城市的天气信息",
    schema: z.object({
      city: z.string().describe("城市名称"),
    }),
  }
);

// 定义计算器工具
const calculator = tool(
  async (input) => {
    const result = eval(input.expression);
    return String(result);
  },
  {
    name: "calculator",
    description: "执行数学计算，支持加减乘除和括号",
    schema: z.object({
      expression: z.string().describe("数学表达式，例如：(3 + 5) * 2"),
    }),
  }
);

// 创建带工具的 Agent
const agent = createAgent({
  model: new ChatOllama({
    model: "qwen3:0.6b",
    temperature: 0,
  }),
  tools: [getWeather, calculator],
});

const invoke = async () => {
  const res = await agent.invoke({
    messages: [{ role: "user", content: "北京今天天气怎么样？如果温度超过25度，计算一下25度比22度高多少百分比" }],
  });

  // 打印完整的对话历史
  console.log("完整对话:");
  res.messages.forEach((msg, i) => {
    console.log(`[${i}] ${msg.role}: ${msg.content}`);
    if (msg.tool_calls) {
      console.log(`  工具调用:`, msg.tool_calls);
    }
  });

  // 打印最终回答
  console.log("\n最终回答:", res.messages.at(-1).content);
};

invoke();
```

**Agent 工作原理深度解析：**

> （原文此处为内嵌流程图组件，Markdown 中无法保留）

#### 结构化响应 Agent

LLM 本质上输出的是字符串（自然语言），但程序代码（如 API 调用、数据库操作）需要的是严格的结构化数据（JSON）。Zod 结构化输出是连接 AI 模糊语言与程序精确代码的桥梁。

```TypeScript
// langchainjs-demo/src/5.agent/3.format-res.ts
import { ChatOllama } from "@langchain/ollama";
import { createAgent } from "langchain/agents";
import * as z from "zod";

// 定义输出结构
const PersonInfo = z.object({
  name: z.string().describe("人物的真实姓名"),
  age: z.number().int().describe("人物的年龄，整数"),
  occupation: z.string().describe("人物的职业"),
  hobbies: z.array(z.string()).describe("人物的爱好列表"),
});

// 创建结构化响应 Agent
const agent = createAgent({
  model: new ChatOllama({
    model: "qwen3:0.6b",
    temperature: 0,
  }),
  responseFormat: PersonInfo,  // 指定响应格式
});

const invoke = async () => {
  const res = await agent.invoke({
    messages: [{ role: "user", content: "我是合一，今年25岁，是一名软件工程师，喜欢编程、读书和跑步" }],
  });

  // 结构化响应会自动解析到 structuredResponse 字段
  console.log("结构化数据:", res.structuredResponse);
  // 输出: { name: "合一", age: 25, occupation: "软件工程师", hobbies: ["编程", "读书", "跑步"] }

  // 也可以访问原始消息
  console.log("原始消息:", res.messages.at(-1).content);
};

invoke();
```

#### 流式响应

流式响应能够让用户实时看到 AI 的输出过程，极大提升用户体验。Agent 支持三种流式模式：

```TypeScript
// langchainjs-demo/src/5.agent/4.streaming-res.ts
import { ChatOllama } from "@langchain/ollama";
import { createAgent, ToolCall } from "langchain/agents";
import * as z from "zod";

const PersonInfo = z.object({
  name: z.string().describe("人物姓名"),
  age: z.number().describe("人物年龄"),
});

const agent = createAgent({
  model: new ChatOllama({
    model: "qwen3:0.6b",
    temperature: 0,
  }),
  responseFormat: PersonInfo,
});

const invoke = async () => {
  // 调用 stream 方法获取异步迭代器
  const stream = await agent.stream(
    {
      messages: [{ role: "user", content: "我是合一，我今年18岁" }],
    },
    {
      streamMode: "values",  // 流式模式
    }
  );

  // 遍历迭代器，实时获取输出
  for await (const chunk of stream) {
    const latestMessage = chunk.messages.at(-1);

    if (latestMessage?.content) {
      // 打印文本内容
      process.stdout.write(latestMessage.content);
    } else if (latestMessage?.tool_calls) {
      // 打印工具调用信息
      const toolCallNames = latestMessage.tool_calls.map(
        (tc: ToolCall) => tc.name
      );
      console.log(`\n正在调用工具: ${toolCallNames.join(", ")}`);
    }
  }

  console.log("\n\n处理完成");
};

invoke();
```

**三种流式模式对比：**

| 模式 | 说明 | 适用场景 |
| --- | --- | --- |
| `values` | 每次返回完整的当前状态 | 状态追踪、需要完整上下文的场景 |
| `updates` | 仅返回本次迭代的增量变化 | 增量更新、节省带宽 |
| `messages` | 流式输出消息块，逐 Token 返回 | 前端实时显示打字效果 |

理解 LangChain 的价值，可以从"不使用框架直接调用模型 API 会遇到什么问题"入手。直接通过 HTTP 请求调用大模型，开发者需要自己处理一系列通用问题：不同厂商的 API 格式各不相同（消息结构、参数命名、流式协议都有差异），切换模型需要重写调用代码；多轮对话需要手动维护和拼接消息历史；工具调用需要自己设计提示词、解析模型返回的工具请求、执行后再拼回上下文；结构化输出需要反复提示并校验模型是否真的返回了合法 JSON；此外还缺少统一的日志追踪、错误重试、超时控制等工程能力。

LangChain 将这些 AI 应用的通用需求沉淀为标准化组件，开发者通过组合组件而不是从零编写样板代码来构建应用。这种"框架化"的思路和 Web 开发中 Express 封装了 HTTP 服务器的底层细节是一样的——不是不能直接做，而是框架让开发者可以聚焦在业务逻辑上。

## 整体架构与 Runnable 核心原理

### 整体架构与仓库结构

#### 官方仓库目录结构

LangChain.js 采用 **pnpm monorepo** 架构，代码组织清晰，模块化程度极高。核心目录如下：

```text
langchainjs/
├── langchain-core/          # 核心抽象层（所有包的基础）
├── langchain/               # 主框架包（Agents、Chains、检索策略）
├── libs/
│   ├── langchain-classic/   # 遗留组件兼容层
│   ├── langchain-textsplitters/ # 文本分割器独立包
│   └── providers/           # 模型提供商独立包
│       ├── langchain-openai/
│       ├── langchain-anthropic/
│       ├── langchain-ollama/
│       └── ...
├── internal/                # 内部构建工具与配置
├── examples/                # 官方示例代码
├── docs/                    # 文档源码
└── package.json             # 根工作区配置
```

#### 包分层架构

LangChain.js 采用严格的分层依赖设计，确保核心抽象稳定、上层组件灵活：

| 层级 | 包名 | 核心职责 | 依赖关系 |
| --- | --- | --- | --- |
| **基础层** | `@langchain/core` | 定义所有基础接口与抽象（Runnable、Message、Tool 等） | 无外部依赖 |
| **提供商层** | `@langchain/openai`、`@langchain/ollama` 等 | 实现特定模型/服务的集成 | 仅依赖 `@langchain/core` |
| **社区层** | `@langchain/community` | 第三方工具、向量库、文档加载器集成 | 依赖 `@langchain/core` |
| **框架层** | `langchain` | 提供高阶 API（Agent、Chain、RAG 流水线） | 依赖 core + 常用提供商 + community |
| **专业层** | `@langchain/langgraph`、`@langchain/textsplitters` | 垂直领域专用工具 | 依赖 `@langchain/core` |

#### 四大核心设计原则

##### Peer Dependency 模式

所有包都将 `@langchain/core` 声明为 peer dependency，根工作区通过 `pnpm overrides` 强制统一版本：

```JSON
// 根 package.json
{
  "pnpm": {
    "overrides": {
      "@langchain/core": "workspace:^",
      "langchain": "workspace:^"
    }
  }
}
```

**设计目的**：确保整个依赖树中只有一个 `@langchain/core` 实例，避免 TypeScript 类型不兼容问题（特别是 Zod 类型的深度比较导致的 OOM 错误）。

##### 基类扩展模型

所有提供商实现都继承自 `@langchain/core` 中的基类，保证接口统一：

```TypeScript
// @langchain/ollama/src/chat_models.ts
import { BaseChatModel } from "@langchain/core/chat_models";

export class ChatOllama extends BaseChatModel {
  // 实现 BaseChatModel 定义的抽象方法
  async _generate(messages, options, runManager) {
    // 调用 Ollama API 的具体逻辑
  }
}
```

**设计目的**：实现模型的无缝切换，应用代码只需修改模型实例，无需改动业务逻辑。

##### 双模块格式支持

所有包同时支持 **CommonJS (CJS)** 和 **ECMAScript Modules (ESM)**，通过 `package.json` 的 `exports` 字段实现：

```JSON
// @langchain/core/package.json
{
  "type": "module",
  "main": "./dist/index.cjs",
  "types": "./dist/index.d.cts",
  "exports": {
    ".": {
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      },
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      }
    }
  }
}
```

**设计目的**：兼容 Node.js 不同版本的模块系统，同时支持浏览器、Edge 运行时等环境。

##### Turbo 构建编排

使用 **Turborepo** 进行 monorepo 构建管理，支持增量构建、并行任务执行和智能缓存，大幅提升构建速度。

### 核心抽象：Runnable 接口

`Runnable` 是 LangChain.js 最基础、最重要的抽象，**所有可执行组件（模型、提示词、工具、链、Agent）都实现了这个接口**。它定义了统一的执行契约，使得组件可以任意组合、嵌套和流水线化。

#### 接口定义（源码来自 `@langchain/core/src/runnables/base.ts`）

```TypeScript
export interface Runnable<Input, Output> {
  // 同步调用：输入一个值，返回一个输出
  invoke(input: Input, config?: RunnableConfig): Promise<Output>;

  // 流式调用：返回异步迭代器，逐块输出结果
  stream(input: Input, config?: RunnableConfig): AsyncIterable<Output>;

  // 批处理调用：并行处理多个输入
  batch(inputs: Input[], config?: RunnableConfig | RunnableConfig[]): Promise<Output[]>;

  // 事件流：返回执行过程中的所有事件（开始、结束、错误等）
  astreamEvents(input: Input, config?: RunnableConfig): AsyncIterable<StreamEvent>;
}
```

#### RunnableConfig 运行时配置

`RunnableConfig` 是所有 Runnable 方法的第二个参数，用于统一控制执行行为：

```TypeScript
export interface RunnableConfig {
  runName?: string;          // 运行名称，用于日志和追踪
  tags?: string[];           // 标签，用于筛选和分类
  metadata?: Record<string, any>; // 元数据，存储额外信息
  callbacks?: Callbacks;     // 回调函数，监听执行生命周期
  maxConcurrency?: number;   // 最大并发数
  recursionLimit?: number;   // 递归深度限制
  configurable?: Record<string, any>; // 可配置字段，运行时动态修改
}
```

**特殊特性**：以双下划线 `__` 开头的配置字段会被标记为机密，不会被日志和追踪系统记录，用于传递 API 密钥等敏感信息。

Runnable 的组合能力体现了"组合优于继承"的设计原则。传统框架常通过深层继承层级来复用行为，但继承是静态的、强耦合的，无法在运行时灵活改变。LangChain 选择让每个组件独立实现 Runnable 接口，然后通过 RunnableSequence 将它们动态串联——管道符 a | b | c 在运行时会创建一个 RunnableSequence 实例，它内部持有组件数组，invoke 时依次将前一个组件的输出作为后一个组件的输入。

这种组合方式的灵活性在于：组件可以在运行时按需拼装，同一个模型实例可以出现在不同的流水线中，也可以通过 RunnableParallel 实现分支并行、通过 RunnablePassthrough 透传数据、通过 RunnableBranch 做条件路由。LCEL（LangChain Expression Language）本质上就是这套 Runnable 组合机制的语法糖，它让复杂的处理流程可以用声明式的方式简洁表达，而底层全部是 Runnable 对象的嵌套组合。

#### LCEL 表达式语言

基于 Runnable 接口，LangChain.js 提供了 **LangChain Expression Language (LCEL)**，使用管道符 `|` 快速构建流水线：

```TypeScript
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOllama } from "@langchain/ollama";
import { StringOutputParser } from "@langchain/core/output_parsers";

// 构建流水线：提示词模板 → 模型 → 输出解析器
const chain = ChatPromptTemplate.fromTemplate("翻译以下文本为中文：{text}")
  | new ChatOllama({ model: "qwen3:0.6b" })
  | new StringOutputParser();

// 调用流水线
const result = await chain.invoke({ text: "Hello World" });
console.log(result); // 输出：你好，世界
```

**实现原理**：管道符 `|` 会被转换为 `RunnableSequence` 实例，按顺序执行各个 Runnable 组件。

## 模型 IO 与工具系统源码解读

### 消息系统与模型 IO

#### 消息类型体系

LangChain.js 定义了四种核心消息类型，分别对应对话中的不同角色：

```TypeScript
// @langchain/core/src/messages/index.ts
export class HumanMessage extends BaseMessage {
  role = "user"; // 用户发送的消息
}

export class AIMessage extends BaseMessage {
  role = "assistant"; // AI 生成的响应
  tool_calls?: ToolCall[]; // 工具调用信息
}

export class SystemMessage extends BaseMessage {
  role = "system"; // 系统提示消息
}

export class ToolMessage extends BaseMessage {
  role = "tool"; // 工具执行结果
  tool_call_id: string; // 关联的工具调用 ID
}
```

**设计目的**：统一不同模型提供商的消息格式，屏蔽 API 差异。

#### BaseChatModel 基类

所有聊天模型都继承自 `BaseChatModel`，它实现了 `Runnable` 接口，并定义了模型调用的通用逻辑：

```TypeScript
// @langchain/core/src/chat_models/base.ts
export abstract class BaseChatModel extends Runnable<BaseMessage[], AIMessage> {
  // 抽象方法：由子类实现具体的模型调用逻辑
  protected abstract _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult>;

  // 实现 Runnable.invoke 方法
  async invoke(messages: BaseMessage[], config?: RunnableConfig): Promise<AIMessage> {
    const result = await this._generate(messages, this._getCallOptions(config));
    return result.generations[0].message;
  }
}
```

#### 模型调用链路源码解读

以 `ChatOllama.invoke()` 为例，完整调用链路如下：

1. **参数预处理**：将输入消息转换为 Ollama API 要求的格式
2. **HTTP 请求**：发送 POST 请求到 `http://localhost:11434/api/chat`
3. **响应解析**：将 Ollama 的 JSON 响应转换为 `AIMessage` 对象
4. **回调触发**：执行 `onLLMStart`、`onLLMEnd` 等回调函数
5. **结果返回**：返回 `AIMessage` 给调用者

### 工具系统与 Function Calling

#### BaseTool 基类

所有工具都继承自 `BaseTool`，它定义了工具的标准接口：

```TypeScript
// @langchain/core/src/tools/base.ts
export abstract class BaseTool implements Runnable<ToolInput, ToolOutput> {
  name: string; // 工具唯一标识
  description: string; // 工具描述，供 LLM 理解
  schema: z.ZodSchema; // 入参校验 Schema

  // 抽象方法：工具的实际执行逻辑
  protected abstract _call(arg: any, config?: RunnableConfig): Promise<any>;

  // 实现 Runnable.invoke 方法
  async invoke(input: any, config?: RunnableConfig): Promise<any> {
    const validatedInput = this.schema.parse(input);
    return this._call(validatedInput, config);
  }
}
```

#### 工具绑定与调用流程

1. **工具定义**：使用 `tool()` 高阶函数快速创建工具
2. **工具绑定**：调用 `model.bindTools(tools)` 将工具列表绑定到模型
3. **LLM 决策**：LLM 根据用户问题决定是否调用工具、调用哪个工具
4. **工具执行**：应用代码解析 LLM 返回的 `tool_calls`，执行对应的工具
5. **结果回传**：将工具执行结果作为 `ToolMessage` 回传给 LLM，生成最终回答

#### 结构化输出实现

结构化输出本质上是一种特殊的工具调用：

1. 框架将 Zod Schema 转换为一个虚拟工具的定义
2. 强制 LLM 只调用这个虚拟工具
3. 工具的参数就是我们需要的结构化数据
4. 框架自动解析工具调用的参数，返回结构化对象

## Agent 系统底层源码解读

### Agent 系统底层实现

#### ReAct 循环源码解读

ReAct 是 LangChain.js 默认的 Agent 范式，核心是「思考-行动-观察」的无限循环：

```TypeScript
// 简化版 ReAct 循环实现
async function reactLoop(messages, model, tools) {
  while (true) {
    // 1. 思考：调用 LLM 生成响应
    const response = await model.invoke(messages);
    messages.push(response);

    // 2. 判断是否需要调用工具
    if (!response.tool_calls || response.tool_calls.length === 0) {
      // 没有工具调用，返回最终回答
      return response;
    }

    // 3. 行动：并行执行所有工具调用
    const toolResults = await Promise.all(
      response.tool_calls.map(async (toolCall) => {
        const tool = tools.find(t => t.name === toolCall.name);
        const result = await tool.invoke(toolCall.args);
        return new ToolMessage({
          tool_call_id: toolCall.id,
          content: result,
        });
      })
    );

    // 4. 观察：将工具结果加入消息历史
    messages.push(...toolResults);
  }
}
```

#### createAgent 函数解析

`createAgent` 是 LangChain.js 提供的高阶函数，用于快速创建 Agent 实例：

```TypeScript
export function createAgent({ model, tools, prompt }) {
  // 1. 绑定工具到模型
  const modelWithTools = model.bindTools(tools);

  // 2. 构建 Agent 流水线：提示词 → 带工具的模型
  const agentRunnable = prompt | modelWithTools;

  // 3. 返回 Agent 实例
  return {
    async invoke(input) {
      const messages = [new HumanMessage(input)];
      return reactLoop(messages, agentRunnable, tools);
    },
    async stream(input) {
      // 流式实现
    }
  };
}
```

#### 流式响应机制

Agent 的流式响应通过 `astreamEvents` 实现，它会返回执行过程中的所有事件，包括：

- `llm_start`：模型开始调用
- `llm_stream`：模型输出 Token
- `tool_start`：工具开始执行
- `tool_end`：工具执行完成
- `agent_end`：Agent 执行结束
