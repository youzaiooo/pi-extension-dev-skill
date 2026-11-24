# 隔离验收

从项目根运行：

```sh
npm ci --ignore-scripts
npm run check
npm run pack
```

这些命令面向含锁文件和 `.npmrc` 的 Git 工作副本；npm 发布归档按 npm 规则不含这两个文件。

`npm run typecheck` 对所有 examples 和 TypeScript fixture 做严格检查；`npm test` 调用[run.mjs](run.mjs)，每次在 `.test-work/run-*` 下创建全新 HOME、进程 agentDir、临时目录和缓存，用白名单环境启动 Node 测试子进程。测试文件不会自行修改当前 shell 的 HOME 或 agentDir。依赖安装缓存由工作副本的 `.npmrc` 固定到项目内。

默认使用锁定的开发宿主。也可以额外对本机已安装的同目标版本包运行：

```sh
node tests/run.mjs /absolute/path/to/node_modules/@earendil-works/pi-coding-agent
```

位置参数仅指向只读宿主代码，测试数据仍在项目内；不会修改宿主或其 node_modules。测试首先断言实际包名和版本等于[支持目标](../references/compatibility.md)。独立 tsc 使用开发依赖声明；额外运行时验证使用指定宿主的真实 loader 与会话实现。

[网络阻断入口](no-network.mjs)阻止测试进程的 fetch、HTTP、HTTPS 和常用 socket 连接，RPC 子进程也带同样入口。[假 provider](fixtures/fake-provider.ts)只把 JSON 工具脚本转换为内存 assistant 消息，不访问网络；SDK 使用空内存凭据存储及 modelsPath=null，CLI 用全新配置目录，不复制凭据。它是测试 fixture，不属于首版公开 Provider 教程，随测试源码一起供审查，但不由 Pi manifest 加载。

## 行为覆盖

| 验收 | 实际驱动方式 |
|---|---|
| A | DefaultResourceLoader 加载六个真实 TS 入口，再 createAgentSession/bindExtensions；通过 prompt 分发命令与工具 |
| B | 两个 agentDir、两个 cwd，实际创建/读取/排他创建失败/删除/重开；检查另一目录和哨兵；错误父目录不回退 |
| C | 同进程 Promise.all 创建 SDK 会话，显式目录均不同于进程环境；同一 createScopedExtension 工厂为每个会话注入不同目录 |
| D | 真实 navigateTree 切换分支和首次状态前的位置；最新快照无效时拒绝读写，切回有效位置后恢复；快照对象与重开文件检查；真实 compact 加 fixture 摘要 hook |
| E | 假模型驱动宿主工具流水线，检查参数修改、isError details、异常、拦截空改写、无效参数、执行中取消 |
| F | 真实 CLI RPC 逐行 JSONL、带 ID 响应、UI 取消、TUI 降级和退出；组件级宽度、序列键输入、dispose 检查 |
| G | 通过 fixture settings 的本地 package 声明发现 Skill；扩展集合为空；Markdown 本地目标与锚点验证 |
| H | 仅静态核对生态包边界，无自动集成或真实数据库访问 |

测试源码见 [sdk.test.ts](sdk.test.ts)、[rpc.test.ts](rpc.test.ts)、[package.test.ts](package.test.ts)。`npm run pack` 再通过 [pack.mjs](pack.mjs) 检查实际归档的文件集合、本地链接和 manifest。工具行为通过真实 AgentSession.prompt 和假模型响应触发，没有只用捕获 handler 的 mock 声称加载或执行成功。组件测试属于较低层的补充检查。

## 产物与限制

每次运行保留 results.tap、RPC stdout/stderr 和导航计数，便于审查；落盘会话、私有笔记和假配置也只在该次目录。打包输出放在 `.test-work/pack`；归档验证需系统 `tar`。删除测试产物时只处理本项目创建的这些目录；node_modules 是可重新安装的开发依赖。

自动测试不是 OS 沙箱、跨进程存储锁或外部扩展联调证明。真实 TUI 键鼠、IME/终端 resize、外部 RPC 客户端、真实模型摘要质量、Provider/OAuth、pi-subagents/pi-memory 联调未验证。当前结果见[验收记录](../references/acceptance.md)。
