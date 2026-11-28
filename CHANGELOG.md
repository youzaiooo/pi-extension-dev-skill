# Changelog

## 0.1.2

对照 `@earendil-works/pi-coding-agent@1.7.0`（及同版 pi-ai、pi-tui）复核并更新基线；示例行为不变。

- 兼容基线改为 1.7.0，新增事实行：`--agent-dir` 与 `PI_CODING_AGENT_DIR` 等价、agentDir 的读取时机与 `usesDefaultAgentDir()`、对话框 `blockedKind`、`after_provider_response` 每响应触发、图像 `aspectRatio`/`size`、遥测接口移除、`notices` 设置分组。
- 新增“从 1.6.0 迁移”一节，列出四点需核对的变化：模块顶层缓存 agentDir、旧 `SettingsManager` 方法、provider 响应 hooks 可以多次触发、`blockedKind` 与 decision model 命名。
- 运行目录与 API 篇补充 `--agent-dir` 的生效时机、模块顶层只放纯函数、对话框与设置写入注意点。
- 开发依赖升到 1.7.0；测试 A 不再硬编码宿主版本，改为与本项目锁定的开发版本比对。

## 0.1.1

- 说明 `appendEntry()` 成功不等于立即落盘，`clear` 不会擦除历史快照。
- 说明私有笔记示例中 `wx` 的防覆盖边界、失败或取消后可能残留的文件，以及生产场景下的恢复建议。
- 以上修正仅涉及文档和注释，不改变示例行为。

## 0.1.0

首个发布版本。

- 新建中文 Skill 入口、集中兼容记录与主题指南。
- 提供命令、组件、工具、分支状态、工具拦截与 agent 私有数据六个完整入口。
- 新建锁定依赖、类型检查和隔离 SDK/CLI RPC/资源 manifest/导航验收。
- 分支状态只恢复最新匹配快照；无效版本或内容拒绝读取和写入，不回退到旧状态。
- 工具拦截不会把输入改成空字符串；隔离测试显式断言缓存预热关闭与默认不信任项目。
- 只暴露 Skill；示例不自动加载，无安装器、全局 bootstrap 或运行依赖。
- 记录具名历史参考与 MIT 许可，明确未实测终端交互及生态扩展联调范围。
