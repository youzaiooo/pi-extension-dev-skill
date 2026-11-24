import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { AutocompleteItem } from "@earendil-works/pi-tui";

export default function commandExample(pi: ExtensionAPI): void {
  pi.registerCommand("dev-info", {
    description: "显示当前模式、工作目录和可空的上下文用量；不调用模型",
    getArgumentCompletions(prefix): AutocompleteItem[] | null {
      const items = ["brief"].filter((value) => value.startsWith(prefix));
      return items.length ? items.map((value) => ({ value, label: value })) : null;
    },
    handler: async (_args, ctx) => {
      const usage = ctx.getContextUsage();
      const info = {
        mode: ctx.mode,
        cwd: ctx.cwd,
        tokens: usage?.tokens ?? null,
        percent: usage?.percent ?? null,
      };
      pi.appendEntry("dev-info:last", info);
      if (ctx.hasUI) {
        const percent = info.percent === null ? "未知" : info.percent.toFixed(1) + "%";
        ctx.ui.notify(`模式：${info.mode}；上下文：${percent}`, "info");
      }
    },
  });

  pi.registerCommand("dev-pick", {
    description: "演示支持 TUI/RPC 的可取消选择框",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      const choice = await ctx.ui.select("选择示例颜色", ["蓝色", "绿色"], { timeout: 1000 });
      // undefined 表示取消/超时；空字符串也不能被当成默认授权。
      pi.appendEntry("dev-pick:last", { choice: choice ?? null });
      if (choice !== undefined) ctx.ui.notify(choice, "info");
    },
  });
}
