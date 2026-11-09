// 一个最简单的 MCP Server：通过 stdio 暴露加、减、乘、除四个工具
// 注意：stdio 模式下 stdout 被协议占用，所有日志必须走 stderr（console.error）
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import * as z from 'zod'

const server = new McpServer({
  name: 'simple-calculator',
  version: '1.0.0',
})

const numberSchema = z.number().describe('参与运算的数字')

// 避免 0.1 + 0.2 = 0.30000000000000004 这类浮点误差直接展示给模型
const formatNumber = (value: number) => `${Math.round(value * 1e10) / 1e10}`

server.registerTool(
  'add',
  {
    title: '加法',
    description: '计算两个数字之和',
    inputSchema: { a: numberSchema, b: numberSchema },
  },
  async ({ a, b }) => ({
    content: [{ type: 'text', text: `${a} + ${b} = ${formatNumber(a + b)}` }],
  })
)

server.registerTool(
  'subtract',
  {
    title: '减法',
    description: '计算两个数字之差（a - b）',
    inputSchema: { a: numberSchema, b: numberSchema },
  },
  async ({ a, b }) => ({
    content: [{ type: 'text', text: `${a} - ${b} = ${formatNumber(a - b)}` }],
  })
)

server.registerTool(
  'multiply',
  {
    title: '乘法',
    description: '计算两个数字之积',
    inputSchema: { a: numberSchema, b: numberSchema },
  },
  async ({ a, b }) => ({
    content: [{ type: 'text', text: `${a} × ${b} = ${formatNumber(a * b)}` }],
  })
)

server.registerTool(
  'divide',
  {
    title: '除法',
    description: '计算两个数字之商（a ÷ b），除数不能为 0',
    inputSchema: { a: numberSchema, b: numberSchema },
  },
  async ({ a, b }) => {
    if (b === 0) {
      return {
        content: [{ type: 'text', text: '除数不能为 0' }],
        isError: true,
      }
    }
    return {
      content: [{ type: 'text', text: `${a} ÷ ${b} = ${formatNumber(a / b)}` }],
    }
  }
)

const main = async () => {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[simple-calculator] MCP server 已通过 stdio 启动，等待客户端连接')
}

main().catch((err) => {
  console.error('[simple-calculator] 启动失败：', err)
  process.exit(1)
})
