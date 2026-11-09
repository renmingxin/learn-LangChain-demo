// loop 调用工具，参考PI的loop核心逻辑。
import 'dotenv/config'
import 'dev-log-monitor/auto';
import { ChatOpenAI } from '@langchain/openai'
import { BaseMessage, HumanMessage, tool, ToolMessage } from 'langchain'
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

const WeatherResponseSchema = z.object({
  city: z.string().describe('要获取天气的城市'),
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

// 定义一个工具，用于查询天气
const getWeatherTool = tool((input) => `查询${input.city}的明天的天气,天气19度，天气晴朗`, {
  name: 'getWeather',
  description: '获取给定的城市的天气。',
  schema: WeatherResponseSchema,
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
        console.log('create1111111111', fileName)
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
const tools = [getWeatherTool, manageFileTool]

const modalWithTools = llm.bindTools(tools)
/**
 * 模型停下来之后，再看一眼有没有新的用户输入（对应 PI 的 config.getFollowUpMessages）
 * 这里没有交互式输入，先返回空数组；接上 CLI 或前端后，从这里把新消息取出来即可
 */
function getFollowUpMessages(): BaseMessage[] {
  return [];
}

const MAX_STEPS = 10;

//本质就是递归调用，先询问模型，模型调用工具，工具调用模型，直到没有工具调用为止
async function invoke() {
  const msg: BaseMessage[] = [
    // new HumanMessage([{ type: "text", text: "查询北京明天的天气" }]),
    new HumanMessage([{ type: "text", text: "先帮我查一下成都的天气，然后呢帮我在本地创建一个文件，文件里面写入成都的天气，并且我很开心" }]),
    // new HumanMessage([{ type: "text", text: "先帮我查一下北京的天气，然后呢帮我在本地创建一个文件，帮我整理一下 langchain JS 最核心的几个概念：从模型、工具、记忆到执行循环，再到监控这些逻辑。帮我梳理一些资料内容，整理进去，输出到对应的 Markdown 文件或者 TXT 文件里面。" }]),
    // new HumanMessage([{ type: "text", text: "你帮我看一下本地有哪些文件，就是现在这个文件夹下面有哪些文件。" }]),
    // new HumanMessage([{ type: "text", text: "我当前文件夹下面有一个 开心.txt 文件是不想要的，你帮我把它删了。" }]),
  ];

  let steps = 0;

  // 外层循环：一整轮任务结束后，看是否还有排队的新消息，没有才真正退出
  while (true) {
    // 内层循环的条件：模型还要调工具，或者有排队的新消息要插进来
    let hasMoreToolCalls = true;

    // 内层循环：一次「模型思考 → 执行工具 → 回填结果」，直到模型不再要工具
    while (hasMoreToolCalls) {
      if (++steps > MAX_STEPS) {
        console.log(`⚠️ 达到最大步数 ${MAX_STEPS}，强制结束`);
        return msg;
      }

      const res = await modalWithTools.invoke(msg);
      console.log("🚀 ~ invoke ~ res:", res.content);
      // 模型这条带 tool_calls 的消息必须先入历史，否则后面的工具结果没有对应的调用方
      msg.push(res);

      const toolCalls = res.tool_calls ?? [];
      hasMoreToolCalls = toolCalls.length > 0;
      if (!hasMoreToolCalls) break;

      // 同一轮里的多个工具调用依次执行，每个结果都要回填
      for (const tc of toolCalls) {
        const tool_fn = tools.find((t) => t.name === tc.name);
        if (!tool_fn) {
          msg.push(new ToolMessage({ content: `未找到工具 ${tc.name}`, tool_call_id: tc.id ?? "" }));
          continue;
        }
        const tool_res = await tool_fn.invoke(tc);
        console.log("🚀 ~ invoke ~ tool_res:", tool_res);
        msg.push(tool_res);
      }
    }

    // 模型已经给出最终回答，再检查有没有排队的新消息，有就回到内层继续跑
    const followUpMessages = getFollowUpMessages();
    if (followUpMessages.length === 0) break;
    msg.push(...followUpMessages);
  }

  console.log("🚀 ~ invoke ~ 最终回答:", msg.at(-1)?.content);
}


invoke();