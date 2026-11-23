// 结构化输出内容，将模型的输出转换为结构化数据，方便后续的处理和分析。例如，将模型的输出转换为 JSON 格式，方便后续的解析和使用
import 'dotenv/config'
import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage } from 'langchain'
import * as z from 'zod'

const BASE_URL = process.env.LLM_BASE_URL || 'https://api.deepseek.com'
const MODEL: string = process.env.LLM_MODEL || 'deepseek-flash'
const API_KEY = process.env.LLM_API_KEY || ''

// 定义结构化输出的Schema
const ResponseSchema = z.object({
  // dom: z.object().describe('dom json的描述信息'),
  name: z.string().describe('姓名'),
  age: z.number().describe('年龄'),
  sex: z.string().describe('性别'),
  address: z.string().describe('地址'),
  hobby: z.array(z.string().describe('爱好')).describe('爱好列表'),
})
const chatOpenAI = new ChatOpenAI({
  model: MODEL,
  configuration: {
    apiKey: API_KEY,
    baseURL: BASE_URL,
  },
  // 禁用思考过程，才能使用结构化输出功能，method: "functionCalling"才会生效
  modelKwargs: {
    thinking: { type: "disabled" },
  },
})
//  用于将模型的输出转换为结构化数据, 并根据Schema进行验证
const modalWithStruct = chatOpenAI.withStructuredOutput(ResponseSchema);

const invoke = async () => {
  console.log('invoke')
  const result = await modalWithStruct.invoke([
    new HumanMessage([
      {
        type: 'text',
        text: '请从以下文本中提取用户信息，并以 JSON 格式输出',
      },
      {
        type: 'text',
        text: '我叫renmx, 我今年18岁, 我是男生，我住在四川成都，我喜欢运动, 我也喜欢旅游',
      }
    ])])
  console.log('result', result)
}

invoke();