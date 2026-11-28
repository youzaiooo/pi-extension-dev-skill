# pi-extension-dev-skill

面向 Pi 扩展开发的中文指南与可运行示例，版本 **0.1.2**。唯一声明支持的 Pi 版本和开发环境集中在[兼容基线](references/compatibility.md)。

本项目独立维护。Dwsy/pi-extensions-skill 的固定版本仅作为具名历史参考，不跟随或合并其历史。首版围绕真实宿主验收重新组织文档与实现；来源和许可见 [SOURCES.md](SOURCES.md) 和 [LICENSE](LICENSE)。

## 阅读入口

| 任务 | 入口 |
|---|---|
| 在开发任务中使用本指南 | [SKILL.md](SKILL.md) |
| 确认版本事实、证据与支持边界 | [兼容基线](references/compatibility.md) |
| 选择数据作用域，处理 CLI/SDK 多目录 | [运行目录](references/runtime-paths.md) |
| 编写工具、命令、生命周期事件 | [API 与 Context](references/api-and-context.md) |
| 实现可恢复的分支状态 | [Session 状态](references/session-state.md) |
| 兼容终端和 RPC | [TUI 与 RPC](references/tui-and-rpc.md) |
| 加载完整示例 | [示例说明](examples/README.md) |
| 重现验收与了解测试边界 | [测试说明](tests/README.md) |
| 查看本版本的验收结果 | [验收记录](references/acceptance.md) |

## 本地开发

需要 npm 和[兼容基线](references/compatibility.md)中的 Node 环境，在本项目的 Git 工作副本目录执行（含锁文件和项目 npm 配置）：

```sh
npm ci --ignore-scripts
npm run check
npm run pack
```

依赖版本记录在 [package.json](package.json) 和 `package-lock.json`。npm 缓存、测试 HOME、agentDir、会话文件和打包输出都在忽略的 `.test-work/` 内；测试入口创建新目录、白名单子进程环境并禁止测试网络。正常验收不读取当前 agent 的模型或凭据配置，也不请求真实模型。

`check` 检查全部完整示例的类型，再执行真实资源发现、SDK 行为、CLI RPC 与文档导航测试。宿主声明自身使用 `skipLibCheck`，项目示例和 fixture 仍在严格类型检查范围内；这不代表重新检查整个宿主源码。

## 包与加载方式

Pi manifest 仅声明 `skills: ["."]`，其余资源显式为空；没有安装脚本、全局 bootstrap 或运行依赖。宿主提供的包是可选 peer，开发目录另以精确版本的 devDependencies 做检查，不把宿主副本放入发布包。示例只在使用者显式指定文件时运行。

确认目标 Pi 进程使用正确的 agentDir，再通过该 Agent 的启动器执行安装；下面的 `pi` 代表该启动命令。重新执行同一仓库的新标签可更新固定版本。

```sh
pi install git:github.com/youzaiooo/pi-extension-dev-skill@v0.1.2
```

默认安装到当前 Agent 的配置范围；要安装到可信项目范围才加 `--local`。执行 `/reload` 或启动新会话加载 Skill。本项目不提供另一个安装器。

首版覆盖路径、基础 API、分支快照、工具拦截与错误/取消、TUI/RPC。Provider/OAuth、自制安装器、复杂代理编排与启动性能优化均不在首版范围。不会取代 pi-subagents 或 pi-memory；没有执行这两个扩展的完整联调。
