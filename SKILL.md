---
name: pi-extension-dev-skill
description: 用中文开发和审查 Pi 扩展；适用于编写工具、命令、生命周期处理、分支状态、agentDir 隔离及 TUI/RPC 兼容代码。先核对目标版本，再使用随附完整示例和隔离测试。
license: MIT
compatibility: 目标宿主与开发环境见 references/compatibility.md。
metadata:
  version: "0.1.0"
---

# Pi 扩展开发

先读[兼容基线](references/compatibility.md)，核对实际包名和版本。遇到未实测版本，先查其随包文档、声明和实现，记录差异后验收；不套用其它版本的结论。

开发时依次确认：

1. 读写范围按[运行目录](references/runtime-paths.md)决定。CLI 用进程目录；SDK 将同一显式 `agentDir` 注入会话、loader 和扩展工厂。可变状态留在工厂内部。
2. 按[API 与 Context](references/api-and-context.md)选择工具、命令或事件；会话替换后使用新 Context。
3. 按[Session 状态](references/session-state.md)从当前分支恢复，先重置默认值，保存和读取都使用独立快照。
4. 按[TUI 与 RPC](references/tui-and-rpc.md)检测模式、处理空值和释放资源。stdout 留给宿主协议。
5. 从[完整示例](examples/README.md)开始修改，并执行[验收方法](tests/README.md)。片段应标出省略的上下文。

本包只暴露 Skill。示例需显式加载，不能通过安装 Skill 自动执行。修改自己的扩展与项目测试即可；安装、发布或改变当前 agent 配置须由实际任务范围决定。

路径隔离不是权限沙箱，工具启用列表不是硬只读边界。不要复制安装器、执行未审查脚本、引入 eval 计算器或按 shell 第一个词宣称命令安全。已有代理编排和记忆扩展的边界见[兼容基线](references/compatibility.md)。
