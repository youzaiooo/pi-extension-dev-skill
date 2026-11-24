import { truncateHead, type AgentToolResult, type CustomEntry, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export const STATE_TYPE = "dev-notes:snapshot";
interface Notes { version: 1; items: { text: string }[] }
type NotesDetails = Notes | { code: "INVALID_SNAPSHOT" };
const defaults = (): Notes => ({ version: 1, items: [] });

function parseSnapshot(data: unknown): Notes | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const snapshot = data as Partial<Notes>;
  if (snapshot.version !== 1 || !Array.isArray(snapshot.items) || snapshot.items.length > 100) return undefined;
  const state = defaults();
  for (const item of snapshot.items) {
    if (typeof item?.text !== "string" || !item.text.trim() || [...item.text].length > 200) return undefined;
    state.items.push({ text: item.text }); // 只保留已验证字段，不引用历史对象。
  }
  return state;
}

export default function notesExample(pi: ExtensionAPI): void {
  let state: Notes | undefined = defaults(); // 工厂局部；undefined 表示最新快照无效。
  const restore = (ctx: ExtensionContext): void => {
    const entry = ctx.sessionManager.getBranch().findLast((entry): entry is CustomEntry =>
      entry.type === "custom" && entry.customType === STATE_TYPE);
    // 没有快照才回到默认值；无效快照不能回退到旧状态。
    state = entry === undefined ? defaults() : parseSnapshot(entry.data);
  };
  pi.on("session_start", (_event, ctx) => restore(ctx));
  pi.on("session_tree", (_event, ctx) => restore(ctx));
  pi.on("session_compact", (_event, ctx) => restore(ctx));

  pi.registerTool({
    name: "dev_notes",
    label: "分支笔记示例",
    description: "读取、追加或清空当前分支笔记，最多 100 条，每条最多 200 字符；模型文本最多 8KiB 加截断提示，details 保留完整快照",
    executionMode: "sequential",
    parameters: Type.Object({
      action: Type.Union([Type.Literal("list"), Type.Literal("add"), Type.Literal("clear")]),
      text: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
    }),
    async execute(_id, params, signal): Promise<AgentToolResult<NotesDetails>> {
      signal?.throwIfAborted();
      if (state === undefined) {
        return {
          isError: true,
          content: [{ type: "text", text: "当前分支的最新笔记快照版本或内容不受支持；不能读取、追加或清空笔记。" }],
          details: { code: "INVALID_SNAPSHOT" },
        };
      }
      let next = structuredClone(state);
      if (params.action === "add") {
        if (!params.text?.trim() || state.items.length >= 100) {
          return {
            isError: true,
            content: [{ type: "text", text: "需要非空文本且笔记数必须少于 100" }],
            details: structuredClone(state),
          };
        }
        next.items.push({ text: params.text.trim() });
      } else if (params.action === "clear") next = defaults();
      if (params.action !== "list") {
        pi.appendEntry(STATE_TYPE, structuredClone(next));
        state = next; // 追加会话记录成功后才更新工作状态；不保证落盘。
      }
      const output = truncateHead(JSON.stringify(state.items, null, 2), { maxBytes: 8192, maxLines: 100 });
      const text = output.content + (output.truncated ? "\n[文本已截断；details 保留完整快照]" : "");
      return {
        content: [{ type: "text", text }],
        details: structuredClone(state), // 与持久化数据及可变工作状态分别独立。
      };
    },
  });
}
