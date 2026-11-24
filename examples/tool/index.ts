import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { setTimeout as delay } from "node:timers/promises";
import { Type } from "typebox";

export const textParameters = Type.Object({
  text: Type.String({ minLength: 1, maxLength: 200, description: "最多 200 字符" }),
  delayMs: Type.Optional(Type.Integer({ minimum: 0, maximum: 1000 })),
});

export default function textToolExample(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "dev_text",
    label: "开发文本示例",
    description: "去除文本两端空白并转为大写；输入最多 200 字符，延迟最多 1000ms",
    parameters: textParameters,
    async execute(_id, params, signal, onUpdate, ctx) {
      signal?.throwIfAborted();
      const text = params.text.trim();
      if (text.length === 0) {
        return {
          isError: true,
          content: [{ type: "text", text: "去除空白后文本不能为空" }],
          details: { code: "EMPTY", value: "", cwd: ctx.cwd },
        };
      }
      if (params.delayMs) {
        onUpdate?.({
          content: [{ type: "text", text: "等待中" }],
          details: { code: "WAITING", value: "", cwd: ctx.cwd },
        });
        await delay(params.delayMs, undefined, { signal });
      }
      signal?.throwIfAborted();
      return {
        content: [{ type: "text", text: text.toUpperCase() }],
        details: { code: "OK", value: text.toUpperCase(), cwd: ctx.cwd },
      };
    },
  });
}
