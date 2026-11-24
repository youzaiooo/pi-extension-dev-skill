import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { matchesKey, truncateToWidth, type Component } from "@earendil-works/pi-tui";

/** 每个交互创建一个实例。定时器由 dispose() 幂等关闭。 */
export class DevPanel implements Component {
  private ticks = 0;
  private disposed = false;
  private timer: ReturnType<typeof setInterval>;
  private readonly requestRender: () => void;
  private readonly done: () => void;

  constructor(requestRender: () => void, done: () => void, intervalMs = 1000) {
    this.requestRender = requestRender;
    this.done = done;
    this.timer = setInterval(() => {
      this.ticks++;
      this.requestRender();
    }, intervalMs);
  }

  render(width: number): readonly string[] {
    return [
      "开发示例面板 / Enter 或 Escape 关闭",
      `计时：${this.ticks}`,
    ].map((line) => truncateToWidth(line, Math.max(0, width)));
  }

  handleInput(data: string): void {
    if (!this.disposed && (matchesKey(data, "enter") || matchesKey(data, "escape"))) this.done();
  }

  invalidate(): void {} // 无缓存：每帧按宽度重建。

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    clearInterval(this.timer);
  }
}

export default function panelExample(pi: ExtensionAPI): void {
  const active: { panel?: DevPanel } = {};
  const cleanup = (): void => { active.panel?.dispose(); active.panel = undefined; };
  pi.on("session_shutdown", cleanup);
  pi.registerCommand("dev-panel", {
    description: "仅在 TUI 中打开面板；RPC 中记录不可用结果",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") {
        pi.appendEntry("dev-panel:last", { supported: false, mode: ctx.mode });
        if (ctx.hasUI) ctx.ui.notify("dev-panel 需要 TUI", "info");
        return;
      }
      if (active.panel) return;
      try {
        await ctx.ui.custom<void>((tui, _theme, _keys, done) => {
          active.panel = new DevPanel(() => tui.requestRender(), () => done());
          return active.panel;
        }, { blocked: { kind: "question", message: "关闭开发面板" } });
      } finally {
        cleanup();
      }
    },
  });
}
