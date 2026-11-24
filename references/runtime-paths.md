# 运行目录与作用域

先确定数据由谁拥有，再决定路径。具体宿主版本事实见[兼容基线](compatibility.md)。

| 数据 | 路径来源 | 共享含义 |
|---|---|---|
| Agent 私有配置、缓存、日志、数据库 | CLI 的 `getAgentDir()`；SDK 的显式工厂参数 | 同一 agent 跨项目可见 |
| 项目配置或资源 | `ctx.cwd` 下的 `CONFIG_DIR_NAME` | 打开同一项目的 agent 可能都能看到；动态项目配置遵守信任判断 |
| Session 内的分支状态 | `pi.appendEntry` 和只读 sessionManager | 属于当前会话树，不额外拼会话文件路径 |
| 用户共享 Skill | 用户 HOME 下 `.agents/skills` | 不随 agentDir 改变，只有明确需要所有 agent 共享时使用 |
| 明确共享的数据 | 独立配置的共享根目录 | 文档说明参与者、并发、权限、所有权和清理 |
| 临时数据 | 调用方指定的临时根目录内 `mkdtemp` | 唯一命名、有限大小、finally 清理；测试全部位于项目忽略目录 |

本项目约定示例私有数据在 `<agentDir>/extension-data/dev-scope/`。这个子目录是示例约定，不是 Pi 强制标准。宿主程序安装位置与 agent 的数据目录互不等同。

## CLI 与 SDK

CLI 入口调用官方 getter，它每次读取当前进程环境；环境变量未配置或为空时默认 HOME 下的 `.pi/agent`。不要把某个操作者的目录写进扩展。

SDK 的 `createAgentSession({ agentDir })` 不改变进程环境；扩展 Context 也不提供 `ctx.agentDir`。完整工厂见[私有笔记示例](../examples/agent-scope/index.ts)。下面是接线片段，省略了模型 runtime、settings、会话 manager、错误处理和 finally dispose；完整隔离 fixture 见 [SDK 测试](../tests/sdk.test.ts)：

```ts
const resourceLoader = new DefaultResourceLoader({
  cwd,
  agentDir,
  extensionFactories: [createScopedExtension({ agentDir })],
});
await resourceLoader.reload();
const { session } = await createAgentSession({ cwd, agentDir, resourceLoader });
await session.bindExtensions({});
```

同一份显式绝对目录传入三处。SDK 在同一进程中创建多个会话时，不临时切换 `process.env.PI_CODING_AGENT_DIR`、HOME、cwd 或全局软链。模块顶层仅保存 schema、类型和纯函数；会话的可变状态放在工厂返回的闭包内，避免模块缓存、单例连接池和模块级路径常量串用。

私有笔记示例要求非空绝对目录，创建文件使用 `wx` 避免覆盖。错误目录、已有文件和删除失败由宿主转为工具错误，读不存在文件才返回空值。失败不会改写到默认 HOME 或其它 agent。它是小型教学存储：不提供崩溃事务、跨进程写锁、符号链接防护或共享目录的访问控制。

## 实施和验收

检查所有实际 I/O：文件、缓存、日志、数据库及 WAL、锁、IPC、子进程和 SDK 会话。只看包安装目录或调用一次 getter 不能证明数据隔离。文件 mutation queue 只在当前进程协调同一路径，多个进程仍需存储自身的并发机制。

本项目测试在环境目录之外创建两个 agentDir 和两个 cwd，并发写入不同标记、删除其中一个、重新打开另一个，检查内容和环境目录是否受影响。错误目录用普通文件挡住数据父目录，必须报告错误且哨兵内容不变。这里只验证示例明确触及的存储边界，不是 OS 级权限隔离。

动态项目配置先检查 `ctx.isProjectTrusted()`；上下文文件发现与动态项目资源不是同一信任流程。不要把 `setActiveTools`、改变 cwd 或路径命名空间解释为硬沙箱。
