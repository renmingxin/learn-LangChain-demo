// 工具调用，比如说查询天气、查询地图，这些模模型没法完成的事情，就必须要agent去调用工具。
import 'dotenv/config'
import 'dev-log-monitor/auto';
import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, tool } from 'langchain'
import * as z from 'zod'
// import { ninjalog } from "@ninjacut/ninja-logger/client";

const BASE_URL = process.env.LLM_BASE_URL || 'https://api.deepseek.com'
const MODEL: string = process.env.LLM_MODEL || 'deepseek-flash'
const API_KEY = process.env.LLM_API_KEY || ''

const WeatherResponseSchema = z.object({
  city: z.string().describe('要获取天气的城市'),
})
const EmailResponseSchema = z.object({
  from: z.string().describe('要获取邮箱的发送人'),
})
const NewsResponseSchema = z.object({
  from: z.string().describe('要获取新闻的发送人'),
})

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

// 定义一个工具，用于查询邮箱
const getEmailTool = tool(async (input) => {
  return {
    from: `${input.from}发来了邮件`,
  }
}, {
  name: 'getEmail',
  description: '获取输入的邮箱。',
  schema: EmailResponseSchema,
})

// 定义一个工具，用于查询新闻
const getNewsTool = tool(async (input) => {
  return {
    from: `${input.from}发来了新闻`,
  }
}, {
  name: 'getNews',
  description: '获取输入的新闻。',
  schema: NewsResponseSchema,
})


// 工具列表
const tools = [getWeatherTool, getEmailTool, getNewsTool]

const modalWithTools = llm.bindTools(tools)

//本质就是递归调用，先询问模型，模型调用工具，工具调用模型，直到没有工具调用为止
const invoke = async () => {
  console.log('invoke')
  const msg: any[] = [new HumanMessage([
    {
      type: 'text',
      text: '查询成都的明天的天气。',
    }
  ])]
  const result = await modalWithTools.invoke(msg)
  msg.push(result)
  console.log('result111', result)
  // ninjalog("debug", "result111", result);
  const toolCalls = result.tool_calls || []
  if (toolCalls?.length > 0) {
    for (const item of toolCalls) {
      // 找到对应的工具,这里就是根据工具的name来匹配的
      const tool_fn = tools.find((tool) => tool.name === item.name)
      if (tool_fn) {
        // @ts-ignore
        const tool_res = await tool_fn.invoke(item)
        console.log('result222', tool_res)
        // ninjalog("debug", "result222", tool_res);
        msg.push(tool_res)
        const a = await modalWithTools.invoke(msg)
        console.log('result333', a)
        // ninjalog("debug", "result333", a);
      }
    }
  }

}


invoke();