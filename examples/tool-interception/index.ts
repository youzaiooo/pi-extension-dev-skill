import { isToolCallEventType, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Static } from "typebox";
import type { textParameters } from "../tool/index.ts";

type TextInput = Static<typeof textParameters>;

/** 仅处理自有示例工具的文本规范化，不是命令权限控制器。 */
export default function interceptionExample(pi: ExtensionAPI): void {
  pi.on("tool_call", (event) => {
    if (!isToolCallEventType<"dev_text", TextInput>("dev_text", event)) return;
    const trimmed = event.input.text.trim();
    if (trimmed === "") return; // 保留通过 schema 的原值，由工具报告语义错误。
    const text = trimmed.replace(/^draft:/, "").trim();
    if (text === "") return { block: true, reason: "移除 draft: 前缀后文本不能为空" };
    if (text === "[blocked]") return { block: true, reason: "示例规则拒绝此输入" };
    // 宿主不会重新验证；只写回非空且不长于原值的字符串。
    event.input.text = text;
  });
}
