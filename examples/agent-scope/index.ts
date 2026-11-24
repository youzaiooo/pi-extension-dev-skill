import { getAgentDir, type ExtensionAPI, type ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { Type } from "typebox";

/** 教学用单文件存储；不是跨进程并发存储或权限沙箱。 */
export function createScopedExtension({ agentDir }: { agentDir: string }): ExtensionFactory {
  if (!agentDir || !isAbsolute(agentDir)) throw new Error("必须提供绝对 agentDir");
  const directory = join(agentDir, "extension-data", "dev-scope");
  const file = join(directory, "note.txt");
  return (pi: ExtensionAPI): void => {
    pi.registerTool({
      name: "dev_private_note",
      label: "Agent 私有笔记示例",
      description: "在显式 agentDir 下增、读、删一条私有笔记；写入采用排他创建，已有文件时报错",
      executionMode: "sequential",
      parameters: Type.Object({
        action: Type.Union([Type.Literal("create"), Type.Literal("read"), Type.Literal("delete")]),
        text: Type.Optional(Type.String({ maxLength: 200 })),
      }),
      async execute(_id, params, signal, _update, ctx) {
        signal?.throwIfAborted();
        let value: string | null = null;
        if (params.action === "create") {
          if (params.text === undefined) throw new Error("create 需要 text");
          await mkdir(directory, { recursive: true, mode: 0o700 });
          // wx 防覆盖，但失败或取消可能在最终路径留下不完整文件。
          await writeFile(file, params.text, { flag: "wx", mode: 0o600, signal });
          value = params.text;
        } else if (params.action === "delete") {
          await unlink(file); // 路径失败直接报错，不回退。
        } else {
          try { value = await readFile(file, { encoding: "utf8", signal }); }
          catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          }
        }
        return {
          content: [{ type: "text", text: value === null ? "无笔记" : value }],
          details: { value, agentDir, cwd: ctx.cwd },
        };
      },
    });
  };
}

/** CLI 入口。SDK 必须调用上面的工厂，把同一 agentDir 传给会话、loader 和工厂。 */
export default function cliScopedExample(pi: ExtensionAPI): void {
  createScopedExtension({ agentDir: getAgentDir() })(pi);
}
