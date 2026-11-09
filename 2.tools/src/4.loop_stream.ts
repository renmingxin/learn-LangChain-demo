import 'dotenv/config'

import { ChatOpenAI } from "@langchain/openai";
import { readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { HumanMessage, ToolMessage, tool, type AIMessageChunk, type BaseMessage, type DynamicStructuredTool } from "langchain";
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

const modelWithTools = llm.bindTools(tools);

/**
 * 模型停下来之后，再看一眼有没有新的用户输入（对应 PI 的 config.getFollowUpMessages）
 * 这里没有交互式输入，先返回空数组；接上 CLI 或前端后，从这里把新消息取出来即可
 */
function getFollowUpMessages(): BaseMessage[] {
  return [];
}

const MAX_STEPS = 10;

/**
 * 流式请求一次模型，对应 Runnable 接口的 stream 方法
 * - 边收分片边打印，实现打字机效果
 * - 用 chunk.concat 把分片拼回完整消息，字符串字段（content / reasoning_content）会自动累加
 */
async function streamOnce(msg: BaseMessage[]): Promise<AIMessageChunk> {
  const stream = await modelWithTools.stream(msg);

  let full: AIMessageChunk | undefined;
  let thinkingStarted = false;
  let answeringStarted = false;

  for await (const chunk of stream) {
    full = full ? full.concat(chunk) : chunk;

    // 思考内容：deepseek 这类模型把思维链放在 additional_kwargs.reasoning_content
    const reasoning = chunk.additional_kwargs?.reasoning_content;
    if (typeof reasoning === "string" && reasoning.length > 0) {
      if (!thinkingStarted) {
        thinkingStarted = true;
        process.stdout.write("🤔 思考：");
      }
      process.stdout.write(reasoning);
    }

    // 正式回答
    if (typeof chunk.content === "string" && chunk.content.length > 0) {
      if (!answeringStarted) {
        answeringStarted = true;
        // 有思考的话先空一行，避免思考内容和回答糊在一起
        process.stdout.write(thinkingStarted ? "\n\n💬 回答：" : "💬 回答：");
      }
      process.stdout.write(chunk.content);
    }
  }
  process.stdout.write("\n");

  if (!full) throw new Error("模型没有返回任何内容");
  return full;
}

async function invoke() {
  const msg: BaseMessage[] = [
    // new HumanMessage([{ type: "text", text: "查询北京明天的天气" }]),
    new HumanMessage([{ type: "text", text: "先帮我查一下北京的天气，然后呢帮我在本地创建一个文件，文件里面写我今天很开心。" }]),
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

      // 流式拿到这一轮的消息，tool_calls 也是从分片里拼出来的
      const res = await streamOnce(msg);
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
        console.log(`� ${tc.name} →`, tool_res.content);
        msg.push(tool_res);
      }
    }

    // 模型已经给出最终回答，再检查有没有排队的新消息，有就回到内层继续跑
    const followUpMessages = getFollowUpMessages();
    if (followUpMessages.length === 0) break;
    msg.push(...followUpMessages);
  }
}

invoke();
