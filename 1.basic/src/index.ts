import 'dotenv/config'
import { ChatOpenAI } from '@langchain/openai'
// import { ChatAnthropic } from '@langchain/anthropic'
// import { ChatOllama } from '@langchain/ollama'
import { HumanMessage, SystemMessage } from 'langchain'
import fs from 'node:fs'
import path from 'node:path'

const BASE_URL = process.env.LLM_BASE_URL || 'https://api.deepseek.com'
const MODEL: string = process.env.LLM_MODEL || 'deepseek-flash'
const API_KEY = process.env.LLM_API_KEY || ''

const chatOpenAI = new ChatOpenAI({
  model: MODEL,
  configuration: {
    apiKey: API_KEY,
    baseURL: BASE_URL,
  }
})


const invoke = async () => {
  console.log('invoke')
  const result = await chatOpenAI.invoke([
    new SystemMessage([{
      type: 'text',
      text: '识别图中的内容',
    }]),
    new HumanMessage([
      // {
      //   type: 'text',
      //   text: '你好,我是renmx',
      // }
      {
        type: 'image_url',
        image_url: {
          url: `data:image/png;base64,${fs.readFileSync(path.resolve(__dirname, "../static/png1.png")).toString('base64')}`
        }
      },
      {
        type: 'text',
        text: '帮我输出成HTML的内容,稍微美观一点',
      }

    ])])
  // fs.writeFileSync(path.resolve(__dirname, '../agent_output/result.txt'), 'asdasd')
  console.log('result', result)
}

invoke();