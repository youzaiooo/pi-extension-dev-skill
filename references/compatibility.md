# 兼容基线

这是本项目版本事实的集中入口。**唯一支持目标为 `@earendil-works/pi-coding-agent@1.6.0`**；没有对其它版本做兼容承诺。项目版本为 0.1.0 候选，验收环境的 Node 为 26.8.1，npm 为 12.0.2；宿主声明的 Node 下限为 22.19.0，下限本身未实跑。

以随该 npm 版本发布的 `docs/`、`dist/*.d.ts`、JS 实现和 `examples/` 为依据。官网或仓库 main 可能继续变化，不能替代固定版本证据。开发依赖固定同版本 coding-agent、pi-ai、pi-tui，以及 `typebox@1.3.27`、`typescript@5.9.3`；详见工作副本中的 `package-lock.json`。

## 目标版本的事实与依据

以下路径均相对目标包根；agent-core 的路径相对同版本 `@earendil-works/pi-agent-core`。表格不是完整 API 清单。

| 事实 | 固定版本证据 | 本项目验证 |
|---|---|---|
| `getAgentDir()` 读进程 `PI_CODING_AGENT_DIR`，未设置或为空时默认用户目录下 `.pi/agent` | `dist/config.js`；`docs/configuration.md` | B/C：环境目录与 SDK 目录不同 |
| SDK 显式 `agentDir` 不写回进程环境；Context 没有 `agentDir` | `dist/core/sdk.js`；`dist/core/extensions/types.d.ts` | C：同进程并发会话实际读写 |
| 普通/工具/命令/替换后 Context 能力不同 | `ExtensionContext`、`ExtensionToolContext`、`ExtensionCommandContext`、`ReplacedSessionContext` | 类型检查；A/E：真实命令、工具 |
| `appendEntry` 生成 `custom`；data 不深拷贝 | `dist/core/session-manager.js` 的 `appendCustomEntry`、`_appendEntry` | D：保存与恢复后修改、重开文件 |
| `getEntries()` 是全树，`getBranch()` 是当前祖先链 | 同文件对应方法；`docs/session-format.md` | D：两个分支与首次状态前导航 |
| 压缩会改变上下文投影，完整分支的 custom 历史仍可恢复 | `buildContextEntries`；`docs/compaction.md` | D：真实手动压缩、落盘、重新加载 |
| `isError: true` 与抛异常都能报告工具失败 | agent-core `dist/types.d.ts`、`dist/agent-loop.js`；`docs/extensions.md` | E：细节保留、异常、取消 |
| `tool_call` 修改 `event.input` 原对象；不会再次验证 | `ToolCallEventResult`；`dist/core/agent-session.js` | E：后续 handler 和实际结果 |
| `compact` 第四参数为 headers，第五为 instructions，第六为 signal | `dist/core/compaction/compaction.d.ts` | 静态核对；首版不实现底层自定义压缩 |
| `ctx.mode` 区分四种模式；RPC 的 `hasUI` 为真，`custom()` 返回 undefined | `docs/rpc-extension-ui.md`；`dist/modes/rpc/rpc-mode.js` | F：真实 RPC、TUI 路径降级 |
| 兼容旧 `@mariozechner/*`、`@sinclair/typebox` 路径的映射属于宿主 loader | `dist/core/extensions/loader.js` 的别名映射 | 静态核对；新示例用实际包名与 typebox |
| `render()` 结果为只读行数组，缓存数组须先复制再改 | 同版本 pi-tui `dist/tui.d.ts`；`docs/tui.md` | F：组件宽度与清理，真实键鼠未测 |
| `withFileMutationQueue` 是进程内队列 | `dist/core/tools/file-mutation-queue.js` | 静态核对；无跨进程锁承诺 |
| 包仅暴露声明的 Skill，无扩展自动执行 | `docs/packages.md`；`dist/core/package-manager.js` | G：真实 loader 读取本包 manifest |

加载器的兼容入口不等于独立 Node/tsc 会自动解析旧包名或虚拟导出。新示例直接从 `typebox` 导入 schema，从 `@earendil-works/pi-tui` 导入 `AutocompleteItem`；不依赖虚拟的 TypeBox 再导出。没有历史证据时，本指南只描述目标版本行为，不称某入口“已废弃”或“已删除”。

## 与生态扩展的边界

静态核对了 `pi-subagents@0.90.0` 与 `@pedro_klein/pi-memory@1.0.0-agent.5` 的 manifest 和隔离入口。前者前台子会话在进程内，后台走独立 runner；后者提供显式 `createMemoryExtension({ agentDir })`，并有失败不回退的 agent 私有存储补丁。这些是具名版本事实，不是本 Skill 的实现。

本包未注册它们的工具，也不复制记忆数据库或代理编排逻辑。修改活动工具集、替换内置工具或编辑上下文可能影响它们，需单独联调；本候选未加载这两个包测试，因此不声称完整兼容。升级复验按[测试说明](../tests/README.md)执行，并记录新的支持范围。

实际验收结果见[验收记录](acceptance.md)，来源见 [SOURCES.md](../SOURCES.md)。
