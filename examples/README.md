# 完整示例

以下六个入口文件都参与严格类型检查与真实资源加载。schema、imports 和返回 details 均已包含；表格中的完整路径直接可加载，不需要复制到配置目录。

| 入口 | 注册内容 | 学习重点 |
|---|---|---|
| [command/index.ts](command/index.ts) | /dev-info、/dev-pick | 命令 Context、可空用量、RPC 对话取消 |
| [command/panel.ts](command/panel.ts) | /dev-panel | TUI 模式判断、定时器与 dispose |
| [tool/index.ts](tool/index.ts) | dev_text | 有界 schema、语义 isError、取消 |
| [tool-interception/index.ts](tool-interception/index.ts) | tool_call handler | 原地修改自有工具参数、拦截 |
| [session-state/index.ts](session-state/index.ts) | dev_notes | 分支快照与恢复 |
| [agent-scope/index.ts](agent-scope/index.ts) | dev_private_note | CLI getter 与 SDK 工厂注入 |

## 显式加载

在已选择合适 agentDir 的开发进程中，可以从项目根显式试用命令示例：

```sh
pi -e ./examples/command/index.ts
```

输入 `/dev-info` 即可运行命令，无需发起模型请求。该试用仍会使用启动进程的正常设置和资源；需要完全隔离、禁止真实模型的验收时，执行 [测试入口](../tests/README.md)。本项目交付阶段没有执行上述交互命令或安装示例。

联动文本工具与拦截器需同时指定两个文件：

```sh
pi -e ./examples/tool/index.ts -e ./examples/tool-interception/index.ts
```

示例名字带 dev_ / dev- 前缀，便于识别；不覆盖内置 read/bash、现有编排工具或记忆工具。实际对模型发起请求仍由操作者选择，自动验收只调用假 provider。

SDK 中导入[显式工厂](agent-scope/index.ts)的 createScopedExtension，把与会话及 loader 相同的 agentDir 传进去。不要把默认 CLI 入口用于 agentDir 不同于进程环境的 SDK 会话。其余示例把可变状态放在各自工厂内部，可以通过 loader 的 additionalExtensionPaths 显式加载。

这些是受容量限制的教学模板，边界分别见[状态指南](../references/session-state.md)、[路径指南](../references/runtime-paths.md)和[TUI 指南](../references/tui-and-rpc.md)。扩展不会因安装本 Skill 而自动执行。
