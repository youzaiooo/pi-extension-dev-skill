# 0.1.0 候选验收记录

本候选仅声明[兼容基线](compatibility.md)中的宿主版本。结论由文档、六个完整入口、类型检查及真实宿主行为测试共同支持；未安装或发布。

## 已验证

在 Node 26.8.1、npm 12.0.2 环境中执行：

| 命令 | 结果 |
|---|---|
| `npm ci --ignore-scripts` | 锁文件可重装项目开发依赖；缓存留在项目忽略目录 |
| `npm run check` | strict tsc 通过；11 项 Node 行为测试通过，0 失败/跳过 |
| `node tests/run.mjs <installed-package-root>` | 对本机已安装的目标宿主重复全部 11 项行为验收，通过 |
| `npm run pack` | 本地 npm 归档生成，文件清单、manifest 和归档内本地 Markdown 链接检查通过 |

`<installed-package-root>` 是已安装的 `@earendil-works/pi-coding-agent@1.6.0` 包根，只读使用；具体本机定位保留在本地运行记录，不作为对外路径规范。开发依赖与已安装宿主的 config、sdk、loader、Context 类型、session manager、agent session、resource loader 七个关键文件另做 SHA-256 对照，均一致。

自动验收包含以下实际行为：

- **A：加载与类型。** 六个 TS 入口由 DefaultResourceLoader 加载，绑定真实 AgentSession；命令通过 prompt 分发，不产生模型 turn。示例与 TypeScript fixture 采用 strict、erasableSyntaxOnly 检查。
- **B/C：目录与状态。** 两个 SDK agentDir、不同 cwd 与第三个进程环境目录实际并发读写；验证排他创建、删除只影响自身、另一个目录重开后内容保持、工厂工作状态互不混用。错误父目录报告工具错误，哨兵未变，环境目录与临时 HOME 不出现回退数据。CLI 默认入口还在真实 RPC 进程中验证创建/删除路径。
- **D：分支与快照。** 真实 navigateTree 切回旧分支、新分支和首次状态之前；修改工作状态与工具返回对象不能改写原 custom 快照。真实 compact 经常量摘要 fixture 追加 compaction，模型投影缩短而完整分支保留快照；JSONL 重开后恢复并继续修改，早期快照不变。最新快照无效时拒绝读取和写入，不回退到旧状态；切回有效位置后恢复使用。额外验证中文/emoji 大快照恢复和 8KiB 模型文本预算。
- **E：工具流水线。** 假模型响应驱动宿主执行，验证 draft 前缀原地修改被后续 handler 和实际 execute 看见、isError 保留 details、异常转错误、规则拦截、拒绝移除前缀后为空的文本、保留纯空白参数的结构化语义错误、宿主参数校验、执行中取消及结束事件。
- **F：RPC 与组件。** 真实 CLI stdout 全部合法 JSONL，含 U+2028/U+2029 字符仍正确按 LF 分帧；带 ID 的命令响应、取消选择、TUI 降级、工具结果与正常退出通过。组件级检查覆盖宽度 0/1/4/12/80、中文、Enter/Escape 序列，以及幂等 dispose 后定时器停止。
- **G：包与导航。** fixture settings 中声明本地 package，真实资源发现只提供本 Skill，零扩展/模板/主题。工作副本与真实归档内的本地链接全部存在；包不包含 node_modules、配置或测试运行产物。

[测试说明](../tests/README.md)列出驱动入口与产物位置。每次运行创建独立的 `.test-work/run-*` 并保留 `results.tap`、RPC JSONL/stderr 和导航计数；汇总日志为 `.test-work/check.log`、`.test-work/installed-host-check.log`。打包清单和完整性摘要在 `.test-work/pack/manifest.json`，候选为 `.test-work/pack/pi-extension-dev-skill-0.1.0.tgz`。这些是被 Git 忽略的本地产物。

测试采用空内存凭据存储或全新 CLI agentDir、受控假 provider 和网络阻断，不请求真实模型。SDK 和包发现测试显式设置并断言 `cacheWarming: "off"`、`defaultProjectTrust: "never"` 生效。没有改现有 agent 配置、启动器、状态库、宿主包或其它仓库。

## 静态判断

Context 分层、会话替换后旧对象失效、底层 compact 参数顺序、loader 兼容别名、进程内文件队列等结论按目标包文档、声明和实现核对。会话替换流程没有另做完整运行测试，不能将类型核对解释为交互验收。

只读核对了 pi-subagents 与 pi-memory 固定补丁的 manifest/路径入口，包与示例没有替代它们的工具或默认数据存储。这是边界检查，不是完整联调。

## 未验证与限制

- 真实终端的键鼠、IME、resize、主题切换、regular/fullscreen、多路复用器；外部 RPC 客户端的显示与对话行为。
- 其它 Pi 版本、其它 Node 版本（包括声明下限）、Windows/macOS。
- 真实模型、摘要质量、自动上下文溢出恢复、Provider/OAuth。
- pi-subagents/pi-memory 完整联调；没有启动子代理或访问真实记忆库。
- OS 权限隔离、跨进程文件锁、崩溃事务、符号链接对抗；私有笔记仅为有界单文件教学存储。

本候选在独立 Git 仓库中供审查；远程推送、发布、打标签与安装不属于本次交付。
