# 来源与许可

## 独立维护与历史参考

项目从空目录独立实现，不含上游 Git 历史，不跟随或合并上游。主题选择与需避免的问题参考了 `Dwsy/pi-extensions-skill` 固定 SHA：

`40a2815bb161f54e69bad973e6d6c8f23b0914b4`

具名入口：[固定提交树](https://github.com/Dwsy/pi-extensions-skill/tree/40a2815bb161f54e69bad973e6d6c8f23b0914b4)、[固定 MIT 许可](https://github.com/Dwsy/pi-extensions-skill/blob/40a2815bb161f54e69bad973e6d6c8f23b0914b4/LICENSE)。原 fork [youzaiooo/pi-extensions-skill](https://github.com/youzaiooo/pi-extensions-skill) 保持独立，未被本项目修改。

本项目重新编写精简指南、完整示例和验收，不复制原安装脚本、模式全集或其可复制承诺。为保留历史参考和可能构成改写的主题组织之出处，[LICENSE](LICENSE) 保留 `Copyright (c) 2025 dwsy` 及完整 MIT 文本，并列本项目贡献者版权。未将先前审计会话原文、宿主凭据或本机配置纳入项目。
## Pi 固定版本材料

权威证据来自实际安装的目标 npm 包，不从仓库 main 推断兼容性。包名、版本、符号与验证映射集中在[兼容基线](references/compatibility.md)。公开版本入口：[coding-agent 1.7.0](https://www.npmjs.com/package/@earendil-works/pi-coding-agent/v/1.7.0)、[pi-tui 1.7.0](https://www.npmjs.com/package/@earendil-works/pi-tui/v/1.7.0)、[pi-agent-core 1.7.0](https://www.npmjs.com/package/@earendil-works/pi-agent-core/v/1.7.0)。上一版基线 1.6.0 与 1.7.0 的差异清单见[兼容基线](references/compatibility.md#migrate-160)。

逐项读取的主要材料（路径相对 coding-agent 包根）：

| 材料 | 用途 |
|---|---|
| docs/extensions.md、docs/sdk.md、docs/packages.md、docs/skills.md | 工厂、Context、manifest 与 SDK 接线；1.7.0 的 dialog `blockedKind` 与 `after_provider_response` 语义 |
| docs/configuration.md、docs/cli.md、docs/environment-variables.md、docs/terminal-setup.md | agentDir 与 `--agent-dir`、环境变量、OSC 7577 程序恢复 |
| docs/session-format.md、docs/compaction.md | 分支、custom 与压缩投影 |
| docs/tui.md、docs/rpc.md、docs/rpc-extension-ui.md | 组件、模式和协议 |
| examples/extensions/hello.ts、todo.ts | 工具与状态 API 的使用参考；本项目独立处理深快照 |
| examples/sdk/06-extensions.ts、12-full-control.ts | loader、显式服务与会话生命周期 |
| dist/config.js、dist/cli/agent-dir-arg.js、dist/utils/tools-manager.js、dist/core/sdk.js、dist/core/extensions/loader.js、dist/core/extensions/types.d.ts、dist/core/session-manager.js、dist/core/agent-session.js、dist/core/settings-schema.d.ts | 文档结论的声明与实现复核；agentDir 生效时机与设置键 |
| dist/core/compaction/compaction.d.ts、dist/core/tools/file-mutation-queue.js | 参数顺序与进程内并发边界 |
| 同版本 agent-core dist/types.d.ts、dist/agent-loop.js；pi-tui dist/tui.d.ts | 错误标志、取消和只读 render 契约 |

这些官方材料属于 Pi 项目原作者；包 manifest 声明 MIT 许可。本项目通过 API 和行为重新编写示例，没有整份搬运官方示例源码。依赖按各包许可分发；开发依赖不进入本项目发布 tarball。

## 环境内只读边界核对

阅读多 agent 运行布局规则，实读当前进程的 agentDir；只读核对 pi-subagents 与 pi-memory 固定补丁的 manifest、公开工厂及路径解析，不加载它们。版本与未联调限制在[兼容基线](references/compatibility.md)中说明。本机绝对目录仅用于执行定位，不构成对外配置规范。
