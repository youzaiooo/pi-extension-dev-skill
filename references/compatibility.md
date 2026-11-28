# 兼容基线

这是本项目版本事实的集中入口。**唯一支持目标为 `@earendil-works/pi-coding-agent@1.7.0`**；没有对其它版本做兼容承诺。项目版本为 0.1.2，验收环境的 Node 为 26.8.1，npm 为 12.0.2；宿主声明的 Node 下限为 22.19.0，下限本身未实跑。

上一版基线为 1.6.0；两者的差异见[从 1.6.0 迁移](#migrate-160)，已覆盖包根导出面、Extension 类型与设置项。包根导出（`dist/index.d.ts`）与 `dist/core/extensions/types.d.ts` 在 1.6.1 → 1.7.0 之间无删除，新增项见下表与迁移段。

以随该 npm 版本发布的 `docs/`、`dist/*.d.ts`、JS 实现和 `examples/` 为依据。官网或仓库 main 可能继续变化，不能替代固定版本证据。开发依赖固定同版本 coding-agent、pi-ai、pi-tui，以及 `typebox@1.3.27`、`typescript@5.9.3`；详见工作副本中的 `package-lock.json`。

## 目标版本的事实与依据

以下路径均相对目标包根；agent-core 的路径相对同版本 `@earendil-works/pi-agent-core`。表格不是完整 API 清单。

| 事实 | 固定版本证据 | 本项目验证 |
|---|---|---|
| `getAgentDir()` 读进程 `PI_CODING_AGENT_DIR`；`--agent-dir` 启动时把值（绝对路径）写回该变量，因此两种写法等价，子进程同样可见 | `dist/config.js`、`dist/cli/agent-dir-arg.js`；`docs/cli.md`、`docs/environment-variables.md` | 本机 1.7.0 实测：flag 与 env 两种启动方式得到相同 env 与 `getAgentDir()` |
| 不要在模块加载期读 agentDir：`main()` 应用 `--agent-dir` 之前读到的是默认目录；`usesDefaultAgentDir()` 判断目录是否被移出 `~/.pi/agent` | `dist/config.js`、`dist/utils/tools-manager.js` 的注释 | 静态核对 |
| 对话框可传 `blockedKind`（`permission`/`question`/`auth`），决定 OSC 7501 阻塞状态；默认 `confirm()` 为 `permission`、`select()`/`input()` 为 `question` | `dist/core/extensions/types.d.ts`；`docs/extensions.md` 的 Program Status Kind | 类型与文档核对 |
| `after_provider_response` 对每个 HTTP 响应触发，包括错误响应和重试，一次请求可能多次；SSE 流内错误与 WebSocket 传输不触发 | 同上；`docs/extensions.md` | 类型与文档核对 |
| 图像生成选项新增 `aspectRatio`、`size`（1.7.0 起） | pi-ai `dist/types.d.ts` 的 `ImagesOptions` | 类型核对；本项目未调用图像模型 |
| 远程遥测已删除：无 `enableInstallTelemetry` 设置、无 `PI_TELEMETRY`；`getClientIdentity()` 不再接收 SettingsManager | `docs/settings.md`、`docs/environment-variables.md`、`dist/core/client-identity.d.ts` | 静态核对 |
| 设置键迁移：`showCacheMissNotices` 改为 `notices.{cacheMisses,cacheWarming,compactionCosts,reasoningDrops}`，方法改为 `getNotices()`/`setNotice(key, shown)` | `dist/core/settings-schema.d.ts`、`dist/core/settings-manager.d.ts` | 静态核对；本项目示例不读写这些设置 |
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

<a id="migrate-160"></a>

## 从 1.6.0 迁移

在 1.6.0 下写的扩展跑在 1.7.0 上时，按以下四点核对。没有改动则行为一致：包根 `dist/index.d.ts` 的导出与 Extension 类型面未删减。

1. **agentDir 的读取时机**：`--agent-dir` 只在 `main()` 之后生效。把 `getAgentDir()` 或任何读环境的路径解析放在模块顶层，会拿到默认的 `~/.pi/agent` 并被模块缓存住。放到工厂闭包内按需调用，或在 `session_start` 取值。
2. **设置 API**：`SettingsManager` 的 `getShowCacheMissNotices()` / `setShowCacheMissNotices()` 与 `getEnableInstallTelemetry()` / `setEnableInstallTelemetry()` 已不存在，改用 `getNotices()` / `setNotice(key, shown)`。旧的 `showCacheMissNotices` / `enableInstallTelemetry` 设置键不再被读取，也不要再写；直接改设置文件更会与规范化后的键冲突。
3. **`after_provider_response` 语义**：从“收到响应后一次”变为“每个 HTTP 响应一次”，错误响应与重试都计。用它做计数、落盘或状态机时按幂等重入设计，不要假设它与一次模型请求一一对应。
4. **阻塞状态与命名**：对话框需要终端显示正确的 blocked 状态时传 `blockedKind`（`permission`/`question`/`auth`）。文档把类型值为 `"classifier"` 的模型称作 decision model，查询入口与类型值不变。

`OSC7577_TOKEN` 由支持 OSC 7577 的终端注入，pi 会从它启动的每个进程环境中删除；不要在子进程里读它，也不要当作身份凭据。

## 与生态扩展的边界

静态核对了 `pi-subagents@0.90.0` 与 `@pedro_klein/pi-memory@1.0.0-agent.5` 的 manifest 和隔离入口。前者前台子会话在进程内，后台走独立 runner；后者提供显式 `createMemoryExtension({ agentDir })`，并有失败不回退的 agent 私有存储补丁。这些是具名版本事实，不是本 Skill 的实现。

本包未注册它们的工具，也不复制记忆数据库或代理编排逻辑。修改活动工具集、替换内置工具或编辑上下文可能影响它们，需单独联调；本版本未加载这两个包测试，因此不声称完整兼容。升级复验按[测试说明](../tests/README.md)执行，并记录新的支持范围。

实际验收结果见[验收记录](acceptance.md)，来源见 [SOURCES.md](../SOURCES.md)。
