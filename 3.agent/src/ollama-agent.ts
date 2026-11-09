import { ChatOllama } from "@langchain/ollama";
import fs from 'node:fs'
import path from "node:path";

const llm = new ChatOllama({
  // 模型名称
  model: "qwen3.5:0.8b",
  // 温度，0-1之间，0表示确定，1表示随机，越高越随机
  temperature: 0.7,
  // 控制文本的多样性，0-1之间，0表示确定，1表示随机，越高越随机
  topP:50,
  topK: 50,

});


const invoke = async () => {
  const prompt = "今天天气？"
  const res:any = await await llm.invoke(prompt);
  console.log(res);
  fs.writeFileSync(path.join(__dirname, `${prompt}-anwser.txt`), res.content)
  

  //流式输出
  // for await (const chunk of await llm.stream(prompt)) {
  //   console.log(chunk);
  //   fs.writeFileSync(path.join(__dirname, `${prompt}-anwser.txt`), chunk?.content || '' as any,{flag:'a'})
  // }

}

invoke();