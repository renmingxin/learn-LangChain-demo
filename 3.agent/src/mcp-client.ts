// MCP 客户端示例：拉起本地 mcp-server 的编译产物，列出工具并依次调用
// 运行前需要先编译：npx tsc（保证 dist/mcp-server.js 存在）
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import path from 'node:path'

const SERVER_ENTRY = path.join(__dirname, 'mcp-server.js')

// 新版协议的 callTool 返回值还可能是「需要继续交互」的联合类型，这里只处理带 content 的常规结果
type ToolResultLike = { content?: unknown; isError?: boolean | undefined; [key: string]: unknown }

const printResult = (label: string, result: ToolResultLike) => {
  const list = Array.isArray(result.content) ? result.content : []
  const first = list[0] as { type?: string; text?: string } | undefined
  const text = first?.type === 'text' ? first.text : JSON.stringify(result.content ?? result)
  console.log(`${label} -> ${result.isError ? '[失败] ' : ''}${text}`)
}
 
const main = async () => {
  // 连接 MCP server, 并列出工具,StdioClientTransport是通过stdio协议连接的，需要指定server的可执行文件路径
  const transport = new StdioClientTransport({
    // 用当前 Node 可执行文件拉起子进程，避免依赖 PATH 里的 node 名称
    command: process.execPath,
    args: [SERVER_ENTRY],
  })

  const client = new Client({ name: 'simple-calculator-client', version: '1.0.0' })
  await client.connect(transport)
  console.log('已连接到 mcp-server')

  const { tools } = await client.listTools()
  console.log('可用工具：')
  for (const item of tools) {
    console.log(`  - ${item.name}: ${item.description ?? '无描述'}`)
  }

  printResult('2 + 3', await client.callTool({ name: 'add', arguments: { a: 2, b: 3 } }))
  printResult('9 - 4', await client.callTool({ name: 'subtract', arguments: { a: 9, b: 4 } }))
  printResult('6 × 7', await client.callTool({ name: 'multiply', arguments: { a: 6, b: 7 } }))
  printResult('10 ÷ 4', await client.callTool({ name: 'divide', arguments: { a: 10, b: 4 } }))
  printResult('1 ÷ 0', await client.callTool({ name: 'divide', arguments: { a: 1, b: 0 } }))

  await client.close()
}

main().catch((err) => {
  console.error('客户端运行失败：', err)
  process.exit(1)
})
