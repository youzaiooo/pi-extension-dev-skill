# Session 状态与分支恢复

状态分成工作内存、原始会话树、当前分支、模型上下文四层。它们的保留与可见性不同，具体固定版本依据见[兼容基线](compatibility.md)。

| 载体 | 含义 | 恢复用途 |
|---|---|---|
| 工厂内部变量 | 当前运行实例的可变状态 | start/tree/compact 后重建 |
| `getEntries()` | 全树，含放弃的分支 | 检查历史，不用于恢复当前分支状态 |
| `getBranch()` | 当前 leaf 到根的祖先链，按历史顺序返回 | 读取最新匹配快照；只有不存在时才用默认值 |
| `buildContextEntries()` / 投影 | 经过压缩选择和上下文编辑的模型相关视图 | 查看下一次模型输入，不替代完整分支 |

`pi.appendEntry(customType, data)` 写入 `custom`，不是 custom_message。custom 不直接进入模型上下文；`pi.sendMessage` 产生的自定义消息会参与模型输入，display=false 也不改变这一点。需要让模型看到状态时，可由工具返回有界 content/details 或按需求注入消息。

## 完整模式

[分支笔记示例](../examples/session-state/index.ts)只维护一个小型 JSON 状态：

1. 仅在当前分支查找最新的匹配项，按 type=custom 和唯一 customType 区分。
2. 如果没有匹配项，恢复默认值，避免导航到首次快照之前仍保留旧状态。
3. 验证最新快照的版本、结构和大小。无效时不回退到旧快照：工具返回 `INVALID_SNAPSHOT`，拒绝读取、追加或清空。Pi 记录事件异常后仍可继续运行，所以不能仅靠在恢复事件里抛错阻止后续操作。
4. 保存和返回 details 时分别深拷贝；恢复时从已验证的字段重建独立对象。
5. session_start、session_tree、session_compact 都重新判断状态；切换到拥有有效快照或尚无快照的位置后，工具可以恢复使用。

目标版本的 session manager 不深拷贝 data。浅复制数组无法保护嵌套对象；把 entry.data 直接赋给可变 state 会让恢复后的 push/字段修改污染历史。示例用独立的嵌套对象快照，测试同时覆盖保存后修改与恢复后修改。

该工具串行执行，避免同批并行修改工作状态。`pi.appendEntry()` 成功追加会话记录后，工具才更新内存状态。追加成功不保证立即落盘：内存会话不会写文件；新的持久化会话若尚无用户或助手消息，也可能延迟创建文件。

快照采用 JSON 可序列化值，容量有界，模型文本输出截断到 8KiB 并提示完整快照位于 details；不把连接、函数、循环引用或 AbortSignal 写进会话。`clear` 只是追加一份空快照，不会删除此前的会话记录，因此不能用来擦除敏感数据。

## 压缩后的区别

压缩追加摘要与保留边界，改变模型上下文投影；并不删除原始树里全部 custom entries。示例从 getBranch 重建，因此压缩前的状态快照仍能恢复。工作内存是否正确取决于扩展的恢复逻辑；模型是否能看见状态取决于工具输出/消息注入，不能从“磁盘还有 entry”推导。

本项目通过真实 AgentSession.compact 调用和 fixture 摘要 hook 生成 compaction entry，验证投影确实删减旧部分、完整分支仍保留快照，再从项目内 JSONL 重开会话恢复。摘要文本是受控常量，不调用模型；没有验证真实摘要质量或上下文溢出恢复。

底层 compact 的位置参数很容易错位：第四个是 headers，第五个是 customInstructions，第六个是 signal。一般扩展用 ctx.compact 的回调或 session_before_compact hook；ctx.compact 返回 void，不能以 await 推断它已完成。首版不提供复杂的自定义压缩实现。

验收行为与边界见[测试说明](../tests/README.md)和[验收记录](acceptance.md)。
