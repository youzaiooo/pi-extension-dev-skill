import { createAssistantMessageEventStream, type AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export const mockConfig = {
  baseUrl: "https://invalid.test/never-called",
  apiKey: "fixture-placeholder",
  api: "openai-completions" as const,
  models: [{
    id: "fixture", name: "In-memory fixture", reasoning: false, input: ["text" as const],
    contextWindow: 64000, maxTokens: 1000,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  }],
  streamSimple(model: { api: string; provider: string; id: string }, context: { messages: any[] }) {
    const stream = createAssistantMessageEventStream();
    const last = context.messages.at(-1);
    const message: AssistantMessage = {
      role: "assistant", api: model.api, provider: model.provider, model: model.id,
      timestamp: Date.now(), stopReason: "stop", content: [{ type: "text", text: "fixture done" }],
      usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    };
    if (last?.role === "user") {
      const text = typeof last.content === "string" ? last.content : last.content.map((x: any) => x.text ?? "").join("");
      const request = JSON.parse(text) as { tool: string; args: Record<string, any> };
      if (!request.tool) throw new Error("fixture 仅接收工具脚本");
      message.content = [{ type: "toolCall", id: "fixture-" + context.messages.length, name: request.tool, arguments: request.args }];
      message.stopReason = "toolUse";
    }
    stream.push({ type: "start", partial: structuredClone(message) });
    stream.push({ type: "done", reason: message.stopReason as "stop" | "toolUse", message });
    stream.end();
    return stream;
  },
};

export default function fakeProvider(pi: ExtensionAPI): void { pi.registerProvider("fixture", mockConfig); }
