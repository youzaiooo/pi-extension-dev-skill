# API、Context 与基本生命周期

完整类型以[目标版本证据](compatibility.md)为准。扩展默认导出接受 `ExtensionAPI` 的工厂；工厂只注册事件、工具和命令。后台进程、连接、watcher、计时器等放在 `session_start` 或实际需要它的操作中启动，并用幂等的 `session_shutdown` 清理。

## Context 的能力边界

| Context | 出现位置 | 本主题需要的能力 |
|---|---|---|
| `ExtensionContext` | 普通事件 | `ui`、`mode`、`hasUI`、`cwd`、只读 sessionManager、modelRegistry、可空 model、signal、compact 等 |
| `ExtensionToolContext` | 工具 execute | 普通能力，加 `tools`、`executeTool`；嵌套执行走验证和 hooks |
| `ExtensionCommandContext` | 命令 handler | 普通能力，加 `waitForIdle`、newSession、fork、switchSession、navigateTree、reload 等；没有工具 Context 的执行入口 |
| `ReplacedSessionContext` | 替换操作的 `withSession` 回调 | 命令能力，加绑定替换会话的异步 sendMessage / sendUserMessage |

普通 Context 没有 agentDir、executeTool、navigateTree 或 reload。事件处理器不会因为等到了 agent_end 就变成命令 Context。

会话替换先发旧实例 shutdown，再加载新实例并发 start，之后运行 withSession。旧 `pi` 和旧 Context 已失效，使用回调的新 Context；也不要继续使用提前抽取的旧 sessionManager。回调仍来自旧闭包，因此只捕获字符串、ID、已序列化配置等独立数据。reload 后让命令立即 return，不继续依赖旧实例状态。

## 工具、命令与事件

[文本工具](../examples/tool/index.ts)含完整 imports、schema、name、label、description、execute 和 details。schema 限定大小；execute 处理语义约束，所有结果和进度更新都有 content/details。

[命令示例](../examples/command/index.ts)通过 `/dev-info` 直接处理请求；普通命令不必调用模型。AutocompleteItem 来自 pi-tui。用户命令会先于 input 事件分发，扩展发送的 slash 文本只有明确启用 `expandPromptTemplates: true` 时才按命令处理；否则会进入模型输入。处理完一次低层 run 的 agent_end 之后可能还有重试和续跑；最终 idle 通知看 agent_settled。首版不提供自动 reload 调度器。

基本顺序：

```text
命令匹配 → input → Skill/模板展开 → before_agent_start
→ agent_start → turn_start → 模型响应 → 工具批次 → turn_end
→ agent_end →（可能重试/续跑）→ agent_before_settle → agent_settled
```

这是普通成功运行的概念顺序，不是全部异常和中断路径。工具调用顺序为 tool_execution_start、tool_call、执行与 update、tool_result、tool_execution_end。参数无效、被阻止、取消等情况可能跳过执行和 tool_result；tool_execution_end 能观察每个已完成调用。默认工具可并行执行；共享可变状态的示例声明 `executionMode: "sequential"`。

会话启动原因在 session_start.reason 中：startup、reload、new、resume、fork；分支导航使用 session_tree；压缩结果使用 session_compact 或 session_compact_failed。不要凭空注册 session_switch / session_fork 事件。

## 参数拦截、失败与取消

[拦截示例](../examples/tool-interception/index.ts)配合文本工具，只对自身已知 schema 操作，用类型收窄后原地修改 `event.input.text`，去除空白及示例 `draft:` 前缀。返回 `{ input, metadata }` 不能替换参数。修改后宿主不会再次校验，处理器必须保持约束。示例在去掉 `draft:` 后为空时拒绝调用；原输入全是空白时不改写，交给工具返回结构化语义错误。

| 情况 | 写法与含义 |
|---|---|
| 正常结果 | 返回 content 与 details |
| 可预期的语义失败 | 返回 `isError: true`，可保留结构化 details；需要脚本直接消费对象时另声明 outputSchema/structuredContent |
| 意外异常 | 抛 Error，宿主转换为错误结果；不要吞掉后报告成功 |
| 参数拦截拒绝 | 返回 `{ block: true, reason }`；这是针对该工具调用的规则，不是 OS 权限 |
| 取消 | 使用 execute 的 signal，传给支持 abort 的 I/O，并在产生结果/副作用前检查；清理使用 finally |

文本工具的空白输入属于可预期失败；等待期间取消由 abort-aware timer 抛出，宿主报告为失败，不伪装成功。异常和已发生的副作用不能仅靠 abort 回滚。普通事件中的 ctx.signal 可能为 undefined，特别是空闲命令与 session 事件。

扩展可以直接访问进程权限允许的资源。激活工具列表只控制工具暴露和调用策略，不能证明所有代码只读；尤其 codemode/deferred 工具有自己的可达规则。不要用 shell 第一词白名单或字符串路径片段做“安全命令”保证。
