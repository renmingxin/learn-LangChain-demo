// 工具调用，比如说查询天气、查询地图，这些模模型没法完成的事情，就必须要agent去调用工具。
import 'dotenv/config'
import 'dev-log-monitor/auto';
import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, tool } from 'langchain'
import * as z from 'zod'
import fs from 'node:fs/promises'
import path from 'node:path'
// import { ninjalog } from "@ninjacut/ninja-logger/client";

const BASE_URL = process.env.LLM_BASE_URL || 'https://api.deepseek.com'
const MODEL: string = process.env.LLM_MODEL || 'deepseek-flash'
const API_KEY = process.env.LLM_API_KEY || ''

const ManageFileResponseSchema = z.object({
  type: z.enum(['read', 'write', "create", "delete"]),
  fileName: z.string().describe('文件名'),
  text: z.string().optional().describe('文件内容'),
})

const WORK_DIR = path.resolve(process.cwd(), 'files')

const resolveInWorkDir = (fileName: string) => {
  const target = path.resolve(WORK_DIR, fileName)
  const rel = path.relative(WORK_DIR, target)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`非法路径：${fileName}`)
  }
  return target
}

const listDir = async (dir: string) => {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  if (entries.length === 0) return `目录 ${dir} 为空`
  return entries
    .map((e) => `${e.isDirectory() ? '[目录]' : '[文件]'} ${e.name}`)
    .join('\n')
}


const llm = new ChatOpenAI({
  model: MODEL,
  configuration: {
    apiKey: API_KEY,
    baseURL: BASE_URL,
  }
})

// 定义一个工具，用于查询文件
const manageFileTool = tool(async (input) => {
  console.log('input11111', input)
  await fs.mkdir(WORK_DIR, { recursive: true })
  try {
    const fileName = input.fileName.trim()
    switch (input.type) {
      case 'read': {
        if (!fileName || fileName === '.' || fileName === './') {
          return `目录 ${WORK_DIR} 下的内容：\n${await listDir(WORK_DIR)}`
        }
        const target = resolveInWorkDir(fileName)
        const stat = await fs.stat(target)
        if (stat.isDirectory()) {
          return `目录 ${fileName} 下的内容：\n${await listDir(target)}`
        }
        return `文件 ${fileName} 的内容：\n${await fs.readFile(target, 'utf8')}`
      }
      case 'create': {
        const target = resolveInWorkDir(fileName)
        await fs.writeFile(target, input.text ?? '', { flag: 'wx' })
        return `已创建文件 ${fileName}`
      }
      case 'write': {
        const target = resolveInWorkDir(fileName)
        await fs.writeFile(target, input.text ?? '', 'utf8')
        return `已写入文件 ${fileName}`
      }
      case 'delete': {
        await fs.unlink(resolveInWorkDir(fileName))
        return `已删除文件 ${fileName}`
      }
      default:
        return `不支持的操作类型：${input.type}`
    }
  } catch (err: any) {
    if (err?.code === 'ENOENT') return `文件或目录不存在：${input.fileName}`
    if (err?.code === 'EEXIST') return `文件已存在：${input.fileName}`
    if (err?.code === 'EISDIR') return `目标是目录，无法按文件操作：${input.fileName}`
    return `操作失败：${err?.message ?? String(err)}`
  }
}, {
  name: 'manageFile',
  description: '操作本地文件',
  schema: ManageFileResponseSchema,
})


// 工具列表
const tools = [manageFileTool]

const modalWithTools = llm.bindTools(tools)

//本质就是递归调用，先询问模型，模型调用工具，工具调用模型，直到没有工具调用为止
const invoke = async () => {
  console.log('invoke')
  const msg: any[] = [new HumanMessage([
    {
      type: 'text',
      text: '帮我创建一个文件，文件内容为hello world', //create
      // text:"帮我查看一下本地有哪些文件。", //read
      // text:"帮我删除一个文件，文件名是test.txt", //delete
      // text:"帮我写入文件，文件名是test.txt，文件内容是hello world", //write
    }
  ])]
  const result = await modalWithTools.invoke(msg)
  msg.push(result)
  console.log('result111', result)
  // ninjalog("debug", "result111", result);
  const toolCalls = result.tool_calls || []
  if (toolCalls?.length > 0) {
    for (const item of toolCalls) {
      //匹配工具列表中的工具，根据工具的name来匹配，name匹配到manageFile就命中了
      const tool_fn = tools.find((tool) => tool.name === item.name)
      if (!tool_fn) continue
      // @ts-ignore
      const tool_res = await tool_fn.invoke(item)
      console.log('result222', tool_res)
      // ninjalog("debug", "result222", tool_res);
      msg.push(tool_res)
    }
    const a = await modalWithTools.invoke(msg)
    console.log('result333', a)
    // ninjalog("debug", "result333", a);
  }

}


invoke();