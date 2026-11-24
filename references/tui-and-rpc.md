# TUI 与 RPC 的基本兼容

使用 ctx.mode 判断运行模式；用 hasUI 判断是否有对话/通知通道。具体类型和实现依据集中在[兼容基线](compatibility.md)。

| 模式 | hasUI | 适合的行为 |
|---|---|---|
| tui | true | 对话、字符串 widget、自定义组件、终端输入 |
| rpc | true | 支持的 UI 子协议；自定义组件不可用 |
| json | false | 工具结果和事件流；不等待交互 |
| print | false | 工具结果与最终文本；不等待交互 |

RPC 中 custom() 返回 undefined，组件工厂会被忽略；不能以 hasUI 判断可以渲染终端组件。对话也可能因客户端取消或超时返回 undefined，confirm 则返回 false。没有结果不表示用户授权了操作。

stdout 属于 RPC/JSON 的协议，扩展不要使用 console.log 或直接写终端控制序列。通知走 ctx.ui.notify，必要诊断走 stderr 并避免敏感内容。RPC 是严格 LF 分帧的 JSONL；不能按 U+2028/U+2029 分割字符串。本项目真实 RPC 测试同时检查每一行都能解析，使用带 ID 的 response 关联，不假定响应顺序；工具运行完成等待 agent_settled。

## 空值与清理

getContextUsage() 本身可空，tokens 与 percent 也各自可为 null，特别是压缩后。model、主题查询、用户输入和组件结果均按声明处理可空值。[命令示例](../examples/command/index.ts)在格式化数字前检查这些值，并使用跨 TUI/RPC 的 select 展示取消处理。

[面板示例](../examples/command/panel.ts)只在 tui 打开，RPC 中记录 supported=false 并通知。每次交互创建一个新实例，计时器在组件创建时启动，dispose 幂等关闭；命令 finally 和 session_shutdown 同时提供清理。用 done() 关闭交互，避免直接隐藏 custom 创建的 overlay。后台资源不要在扩展工厂阶段启动。

每行 render 输出须适配传入宽度，包括中文、ANSI 和 emoji；使用 pi-tui 的宽度工具。render 返回的数组视为只读，修改父类缓存前先复制。输入使用 matchesKey 或注入的 KeybindingsManager，不能把终端序列直接和单词 "up" / "return" 比较。例子仅使用固定 Enter/Escape；可配置动作优先使用注入 manager。

本项目已用真实 pi-tui 的宽度函数检查窄宽与中文，通过终端序列测试组件的键盘处理，检查 dispose 后计时器停止；这些是组件级测试。**未执行真实终端的键鼠、IME、resize、主题切换、regular/fullscreen 或多路复用器验收。** RPC 测试使用本项目的最小客户端，不能代替所有外部 RPC 客户端。

真实终端复验应人工检查：打开与取消面板、窄宽/宽字符、快速重复打开、切换会话与退出、定时器释放；若新增鼠标逻辑，再检查 fullscreen 下的 capture、focus、滚轮与键盘替代路径。该清单不是已通过结果。
