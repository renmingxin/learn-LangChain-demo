// MCP + 大模型 Agent 示例：把 mcp-server 的加减乘除工具交给模型，由模型自主决定调用
// 切换模型：默认 OpenAI 兼容接口（.env 里的 LLM_*），设置 LLM_PROVIDER=ollama 则用本地 Ollama
import 'dotenv/config'
import path from 'node:path'
import { MultiServerMCPClient } from '@langchain/mcp-adapters'
import { ChatOllama } from '@langchain/ollama'
import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, createAgent } from 'langchain'

const PROVIDER = (process.env.LLM_PROVIDER ?? 'openai').toLowerCase()

const buildModel = () => {
  if (PROVIDER === 'ollama') {
    return new ChatOllama({
      model: process.env.OLLAMA_MODEL ?? 'qwen3.5:0.8b',
      temperature: 0.7,
      topP: 0.9,
      topK: 50,
    })
  }
  return new ChatOpenAI({
    model: process.env.LLM_MODEL ?? 'deepseek-flash',
    apiKey: process.env.LLM_API_KEY ?? '',
    configuration: {
      baseURL: process.env.LLM_BASE_URL ?? 'https://api.deepseek.com',
    },
  })
}

const main = async () => {
  // 客户端只负责连接，构造时不会启动子进程
  const client = new MultiServerMCPClient({
    servers: {
      calculator: {
        transport: 'stdio',
        command: process.execPath,
        args: [path.join(__dirname, 'mcp-server.js')],
        stderr: 'inherit',
      },
    },
  })

  try {
    // 把 MCP 工具转成 LangChain 工具（名字、描述、参数 schema 都会自动映射）
    const tools = await client.listTools()
    console.log(`当前模型：${PROVIDER}`)
    console.log('已加载 MCP 工具：', tools.map((item) => item.name).join(', '))

    const agent = createAgent({ model: buildModel(), tools })

    const res = await agent.invoke({
      messages: [
        new HumanMessage('请用工具计算：(12 + 30) 等于多少？再算 12 除以 3 等于多少？'),
      ],
    })

    const last = res.messages.at(-1)
    const text = typeof last?.content === 'string' ? last.content : JSON.stringify(last?.content)
    console.log('最终回答：', text)
  } finally {
    // 关闭所有 MCP 连接，释放子进程
    await client.close()
  }
}

main().catch((err) => {
  console.error('运行失败：', err)
  process.exit(1)
})
