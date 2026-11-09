import 'dotenv/config'

import { ChatOpenAI } from "@langchain/openai";
import { readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { HumanMessage, ToolMessage, createAgent, tool, type AIMessageChunk, type BaseMessage, type DynamicStructuredTool } from "langchain";
import * as z from "zod";

const BASE_URL = process.env.LLM_BASE_URL || 'https://api.deepseek.com'
const MODEL: string = process.env.LLM_MODEL || 'deepseek-flash'
const API_KEY = process.env.LLM_API_KEY || ''

// 创建模型调用的
const llm = new ChatOpenAI({
  model: MODEL,
  apiKey: API_KEY,
  configuration: {
    baseURL: BASE_URL,
  },
});


// 查询天气
const getWeather = tool((input) => `${input.city} 天气晴 19 度`, {
  // 工具元信息定义
  name: "get_weather",
  description: "获取给定城市的天气",
  schema: z.object({
    city: z.string().describe("要获取天气的城市")
  })
});


// 用户检索邮件
const getEmail = tool(
  async (input) => {
    // 这里可以调用外部接口
    // 异步操作
    return `${input.from} 发来了邮件`;
  },
  {
    name: "get_email",
    description: "获取给定用户的邮件",
    schema: z.object({
      from: z.string().describe("哪个用户的邮件"),
    }),
  },
);


// 用户检索邮件
const getNews = tool(
  async (input) => {
    // 这里可以调用外部接口
    // 异步操作
    const json = await (await fetch("https://api.cnodejs.org/api/v1/topics")).json()
    console.log('🚀 ~ json:', json)
    return
  },
  {
    name: "get_news",
    description: "获取 新闻",
  },
);

// 用户操作文件
const manageFile = tool(
  async (input) => {
    console.log('🚀 ~ input:', input)
    const { type, fileName, text } = input;
    const filePath = path.resolve(process.cwd(), fileName);

    try {
      switch (type) {
        case "create":
          await writeFile(filePath, text ?? "", "utf-8");
          return `文件 ${fileName} 创建成功`;
        case "write":
          await writeFile(filePath, text ?? "", "utf-8");
          return `文件 ${fileName} 写入成功`;
        case "read":
          return await readFile(filePath, "utf-8");
        case "delete":
          await unlink(filePath);
          return `文件 ${fileName} 删除成功`;
        case "dir": {
          const entries = await readdir(filePath, { withFileTypes: true });
          if (entries.length === 0) return `${fileName} 目录为空`;
          return entries
            .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
            .join("\n");
        }
      }
    } catch (err) {
      return `操作 ${type} ${fileName} 失败：${(err as Error).message}`;
    }
  },
  {
    name: "manage_file",
    description: "操作本地文件",
    schema: z.object({
      type: z.enum(["create", "delete", "read", "write", "dir"]),
      fileName: z.string().describe("文件名"),
      text: z.string().describe("具体内容")
    }),
  },
);
// 查询地图
// 查询数据库
// 模型没办法完成的，开发工具之后，让模型分析要调用什么工具，智能体运行负责工具调用

const tools = [manageFile, getWeather, getEmail, getNews];

async function invoke() {
  const msg: BaseMessage[] = [
    // new HumanMessage([{ type: "text", text: "查询北京明天的天气" }]),
    new HumanMessage([{ type: "text", text: "先帮我查一下北京的天气，然后呢帮我在本地创建一个文件，文件里面写我今天很开心。" }]),
    // new HumanMessage([{ type: "text", text: "先帮我查一下北京的天气，然后呢帮我在本地创建一个文件，帮我整理一下 langchain JS 最核心的几个概念：从模型、工具、记忆到执行循环，再到监控这些逻辑。帮我梳理一些资料内容，整理进去，输出到对应的 Markdown 文件或者 TXT 文件里面。" }]),
    // new HumanMessage([{ type: "text", text: "你帮我看一下本地有哪些文件，就是现在这个文件夹下面有哪些文件。" }]),
    // new HumanMessage([{ type: "text", text: "我当前文件夹下面有一个 开心.txt 文件是不想要的，你帮我把它删了。" }]),
  ];
  const agent = createAgent({ model: llm, tools, });
  const res = await agent.invoke({ messages: msg });
  console.log('🚀 ~ res:', res)
}

invoke();
