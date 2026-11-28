import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { InMemoryCredentialStore } from "@earendil-works/pi-ai";
import type { AgentSession, ExtensionFactory, ExtensionAPI, SettingsManager } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { visibleWidth } from "@earendil-works/pi-tui";
import { createScopedExtension } from "../examples/agent-scope/index.ts";
import { DevPanel } from "../examples/command/panel.ts";
import { mockConfig } from "./fixtures/fake-provider.ts";

const host = await import(process.env.TEST_PI_ENTRY!);
const work = process.env.TEST_WORK!;
const root = process.env.TEST_ROOT!;
const exampleFiles = ["command/index.ts", "command/panel.ts", "tool/index.ts", "session-state/index.ts", "tool-interception/index.ts"];
let sequence = 0;

async function openFixture(options: { agentDir?: string; cwd?: string; inline?: ExtensionFactory[]; files?: string[]; manager?: any } = {}) {
  const agentDir = options.agentDir ?? join(work, "agent-" + sequence++);
  const cwd = options.cwd ?? join(work, "cwd-" + sequence++);
  await mkdir(agentDir, { recursive: true });
  await mkdir(cwd, { recursive: true });
  const settings = {
    compaction: { enabled: false, keepRecentTokens: 0, reserveTokens: 1000 },
    retry: { enabled: false }, cacheWarming: "off", defaultProjectTrust: "never",
  } satisfies NonNullable<Parameters<typeof SettingsManager.inMemory>[0]>;
  const settingsManager = host.SettingsManager.inMemory(settings);
  assert.equal(settingsManager.getCacheWarmingMode(), "off");
  assert.equal(settingsManager.getDefaultProjectTrust(), "never");
  const loader = new host.DefaultResourceLoader({
    cwd, agentDir, settingsManager,
    noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
    additionalExtensionPaths: (options.files ?? exampleFiles).map((f) => resolve(root, "examples", f)),
    extensionFactories: options.inline ?? [],
    systemPrompt: "Controlled fixture. Use scripted tool calls only.",
  });
  await loader.reload();
  assert.deepEqual(loader.getExtensions().errors, []);
  const runtime = await host.ModelRuntime.create({ credentials: new InMemoryCredentialStore(), modelsPath: null, refreshOnCreate: false });
  runtime.registerProvider("fixture", mockConfig);
  const { session } = await host.createAgentSession({ cwd, agentDir, resourceLoader: loader,
    modelRuntime: runtime, model: runtime.getModel("fixture", "fixture"), thinkingLevel: "off",
    settingsManager, sessionManager: options.manager ?? host.SessionManager.inMemory(cwd), noTools: "builtin" });
  const errors: unknown[] = [];
  await session.bindExtensions({ mode: "print", onError: (error: unknown) => errors.push(error) });
  return { session: session as AgentSession, loader, errors, cwd, agentDir, runtime };
}

async function call(session: AgentSession, tool: string, args: unknown) {
  const before = session.messages.length;
  await session.prompt(JSON.stringify({ tool, args }));
  const result = session.messages.slice(before).findLast((m) => m.role === "toolResult");
  assert.ok(result && result.role === "toolResult", "宿主必须真正执行并记录工具结果");
  return result;
}

const summaryFixture: ExtensionFactory = (pi) => {
  pi.on("session_before_compact", (event) => ({ compaction: {
    summary: "受控 fixture 摘要", firstKeptEntryId: event.preparation.firstKeptEntryId,
    tokensBefore: event.preparation.tokensBefore,
  } }));
};

test("A：目标包版本、全部完整扩展真实加载，命令不调用模型", async () => {
  const manifest = JSON.parse(await readFile(join(process.env.TEST_PI_ROOT!, "package.json"), "utf8"));
  assert.equal(manifest.name, "@earendil-works/pi-coding-agent");
  const project = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  assert.equal(manifest.version, project.devDependencies["@earendil-works/pi-coding-agent"],
    "宿主版本必须与本项目锁定的开发版本一致");
  const f = await openFixture({ files: [...exampleFiles, "agent-scope/index.ts"] });
  try {
    assert.equal(f.loader.getExtensions().extensions.length, 6);
    assert.ok(f.session.getActiveToolNames().includes("dev_text"));
    await f.session.prompt("/dev-info brief");
    const entry = f.session.sessionManager.getBranch().findLast((e) => e.type === "custom" && e.customType === "dev-info:last");
    assert.ok(entry?.type === "custom");
    assert.deepEqual(entry.data, { mode: "print", cwd: f.cwd, tokens: 0, percent: 0 });
    assert.equal(f.session.messages.filter((m) => m.role === "assistant").length, 0);
    assert.deepEqual(f.errors, []);
  } finally { f.session.dispose(); }
});

test("B/C：环境目录与两个 SDK agentDir 不同；并发创建、增删、重开与 cwd 隔离", async () => {
  const aDir = join(work, "private-a"), bDir = join(work, "private-b");
  const aCwd = join(work, "project-a"), bCwd = join(work, "project-b");
  const envDir = host.getAgentDir();
  assert.equal(envDir, process.env.PI_CODING_AGENT_DIR);
  const [a, b] = await Promise.all([
    openFixture({ agentDir: aDir, cwd: aCwd, inline: [createScopedExtension({ agentDir: aDir })] }),
    openFixture({ agentDir: bDir, cwd: bCwd, inline: [createScopedExtension({ agentDir: bDir })] }),
  ]);
  try {
    const [ar, br] = await Promise.all([
      call(a.session, "dev_private_note", { action: "create", text: "a-only" }),
      call(b.session, "dev_private_note", { action: "create", text: "b-only" }),
    ]);
    assert.equal((ar.details as any).agentDir, aDir); assert.equal((ar.details as any).cwd, aCwd);
    assert.equal((br.details as any).agentDir, bDir); assert.equal((br.details as any).cwd, bCwd);
    const file = (dir: string) => join(dir, "extension-data/dev-scope/note.txt");
    assert.equal(await readFile(file(aDir), "utf8"), "a-only");
    assert.equal(await readFile(file(bDir), "utf8"), "b-only");
    assert.equal((await call(a.session, "dev_private_note", { action: "create", text: "overwrite" })).isError, true);
    await call(a.session, "dev_private_note", { action: "delete" });
    assert.equal(((await call(a.session, "dev_private_note", { action: "read" })).details as any).value, null);
    assert.equal(await readFile(file(bDir), "utf8"), "b-only");
    assert.equal(host.getAgentDir(), envDir);
    assert.deepEqual(await readdir(envDir!), []);
    assert.deepEqual(await readdir(aCwd), []); assert.deepEqual(await readdir(bCwd), []);
    await Promise.all([call(a.session, "dev_notes", { action: "add", text: "a-state" }),
      call(b.session, "dev_notes", { action: "add", text: "b-state" })]);
    assert.deepEqual((await call(a.session, "dev_notes", { action: "list" })).details,
      { version: 1, items: [{ text: "a-state" }] });
    assert.deepEqual((await call(b.session, "dev_notes", { action: "list" })).details,
      { version: 1, items: [{ text: "b-state" }] });
    assert.deepEqual(a.errors, []); assert.deepEqual(b.errors, []);
  } finally { a.session.dispose(); b.session.dispose(); }
  const reopened = await openFixture({ agentDir: bDir, cwd: bCwd, inline: [createScopedExtension({ agentDir: bDir })] });
  try { assert.equal(((await call(reopened.session, "dev_private_note", { action: "read" })).details as any).value, "b-only"); }
  finally { reopened.session.dispose(); }
});

test("B：错误存储目录不回退；相对或空 agentDir 明确拒绝", async () => {
  assert.throws(() => createScopedExtension({ agentDir: "" }), /绝对/);
  assert.throws(() => createScopedExtension({ agentDir: "relative" }), /绝对/);
  const blockedDir = join(work, "blocked-agent"); await mkdir(blockedDir);
  await writeFile(join(blockedDir, "extension-data"), "sentinel");
  const f = await openFixture({ agentDir: blockedDir, inline: [createScopedExtension({ agentDir: blockedDir })] });
  try {
    const result = await call(f.session, "dev_private_note", { action: "create", text: "must fail" });
    assert.equal(result.isError, true);
    assert.match(JSON.stringify(result.content), /ENOTDIR|EEXIST/);
    assert.equal(await readFile(join(blockedDir, "extension-data"), "utf8"), "sentinel");
    assert.deepEqual(await readdir(process.env.PI_CODING_AGENT_DIR!), []);
    assert.deepEqual(await readdir(process.env.HOME!), []);
  } finally { f.session.dispose(); }
});

test("D：当前分支、导航到首次状态前、保存与恢复快照及压缩重载", async () => {
  const cwd = join(work, "history-cwd"); await mkdir(cwd);
  const sessionDir = join(work, "history-sessions");
  const manager = host.SessionManager.create(cwd, sessionDir);
  const f = await openFixture({ cwd, manager, inline: [summaryFixture] });
  let sessionFile: string | undefined;
  try {
    await f.session.prompt("/dev-info");
    const rootId = manager.getLeafId()!;
    const firstResult = await call(f.session, "dev_notes", { action: "add", text: "first" });
    const first = manager.getBranch().find((e: any) => e.type === "custom" && e.customType === "dev-notes:snapshot");
    const firstId = manager.getLeafId()!;
    const saved = structuredClone(first.data);
    (firstResult.details as any).items[0].text = "外部修改返回快照";
    assert.deepEqual(first.data, saved, "工具返回对象与持久化快照互不别名");
    assert.deepEqual((await call(f.session, "dev_notes", { action: "list" })).details, saved, "工具返回对象不能改写工作状态");
    await call(f.session, "dev_notes", { action: "add", text: "abandoned" });
    const abandonedId = manager.getLeafId()!;
    assert.deepEqual(first.data, saved, "保存后修改不能改写历史对象");
    await f.session.navigateTree(firstId, { summarize: false });
    assert.deepEqual((await call(f.session, "dev_notes", { action: "list" })).details, saved);
    await call(f.session, "dev_notes", { action: "add", text: "branch" });
    const branchId = manager.getLeafId()!;
    assert.deepEqual(first.data, saved, "恢复后修改也不能改写历史对象");
    await f.session.navigateTree(rootId, { summarize: false });
    assert.deepEqual((await call(f.session, "dev_notes", { action: "list" })).details, { version: 1, items: [] });
    await f.session.navigateTree(abandonedId, { summarize: false });
    assert.deepEqual((await call(f.session, "dev_notes", { action: "list" })).details, { version: 1, items: [{ text: "first" }, { text: "abandoned" }] });
    await f.session.navigateTree(branchId, { summarize: false });
    await f.session.compact();
    assert.ok(manager.getBranch().some((e: any) => e.type === "compaction"));
    assert.ok(manager.getBranch().some((e: any) => e.id === first.id), "完整分支仍保留压缩前的 custom");
    assert.equal(manager.buildContextEntries().some((e: any) => e.id === first.id), false, "投影已压缩旧历史");
    await f.session.prompt("/dev-info");
    const usageEntry = manager.getBranch().findLast((e: any) => e.type === "custom" && e.customType === "dev-info:last");
    assert.equal(usageEntry.data.tokens, null); assert.equal(usageEntry.data.percent, null);
    const expected = { version: 1, items: [{ text: "first" }, { text: "branch" }] };
    assert.deepEqual((await call(f.session, "dev_notes", { action: "list" })).details, expected);
    sessionFile = manager.getSessionFile();
    assert.ok(sessionFile?.startsWith(work));
    assert.deepEqual(f.errors, []);
  } finally { f.session.dispose(); }
  const restored = await openFixture({ cwd, manager: host.SessionManager.open(sessionFile!, sessionDir) });
  try {
    assert.deepEqual((await call(restored.session, "dev_notes", { action: "list" })).details,
      { version: 1, items: [{ text: "first" }, { text: "branch" }] });
    await call(restored.session, "dev_notes", { action: "add", text: "after restart" });
    const entries = restored.session.sessionManager.getEntries();
    assert.deepEqual((entries.find((e) => e.type === "custom" && e.customType === "dev-notes:snapshot") as any).data,
      { version: 1, items: [{ text: "first" }] });
  } finally { restored.session.dispose(); }
});

test("D：最新快照无效时拒绝读取和写入，不回退；可切回有效快照", async () => {
  const cwd = join(work, "invalid-snapshot-cwd");
  const manager = host.SessionManager.inMemory(cwd);
  const type = "dev-notes:snapshot";
  const older = { version: 1, items: [{ text: "older" }] };
  const invalid = { version: 99, items: [{ text: "unknown-version" }] };
  const newer = { version: 1, items: [{ text: "newer" }] };
  const olderId = manager.appendCustomEntry(type, older);
  const invalidId = manager.appendCustomEntry(type, invalid);
  const newerId = manager.appendCustomEntry(type, newer);
  manager.branch(invalidId);
  const f = await openFixture({ cwd, manager });
  const snapshots = () => manager.getEntries().filter((e: { type: string; customType?: string }) =>
    e.type === "custom" && e.customType === type).map((e: { data: unknown }) => e.data);
  try {
    for (const args of [{ action: "list" }, { action: "add", text: "must not save" }, { action: "clear" }]) {
      const result = await call(f.session, "dev_notes", args);
      assert.equal(result.isError, true, `${args.action} 必须拒绝无效快照`);
      assert.deepEqual(result.details, { code: "INVALID_SNAPSHOT" });
    }
    assert.deepEqual(snapshots(), [older, invalid, newer], "不能追加快照或改写历史");
    await f.session.navigateTree(newerId, { summarize: false });
    const afterInvalid = await call(f.session, "dev_notes", { action: "list" });
    assert.equal(afterInvalid.isError, false, "有效的最新快照不受旧无效快照影响");
    assert.deepEqual(afterInvalid.details, newer);
    await f.session.navigateTree(invalidId, { summarize: false });
    assert.equal((await call(f.session, "dev_notes", { action: "list" })).isError, true);
    await f.session.navigateTree(olderId, { summarize: false });
    assert.deepEqual((await call(f.session, "dev_notes", { action: "list" })).details, older);
    const saved = await call(f.session, "dev_notes", { action: "add", text: "usable again" });
    assert.equal(saved.isError, false);
    assert.deepEqual(saved.details, { version: 1, items: [{ text: "older" }, { text: "usable again" }] });
    assert.deepEqual(f.errors, []);
  } finally { f.session.dispose(); }
});

test("D：多字节快照恢复与模型输出预算", async () => {
  const cwd = join(work, "bounded-cwd");
  const manager = host.SessionManager.inMemory(cwd);
  const snapshot = { version: 1, items: Array.from({ length: 100 }, () => ({ text: "中文😀".repeat(66) })) };
  manager.appendCustomEntry("dev-notes:snapshot", structuredClone(snapshot));
  const f = await openFixture({ cwd, manager });
  try {
    const result = await call(f.session, "dev_notes", { action: "list" });
    assert.equal(result.isError, false);
    assert.deepEqual(result.details, snapshot);
    const text = result.content.filter((c) => c.type === "text").map((c) => c.text).join("");
    assert.match(text, /文本已截断/);
    assert.ok(Buffer.byteLength(text) <= 8400);
    assert.deepEqual(f.errors, []);
  } finally { f.session.dispose(); }
});

test("E：宿主执行原地参数修改、结构化 isError、异常、拦截与取消", async () => {
  const seen: any[] = [];
  const probe: ExtensionFactory = (pi: ExtensionAPI) => {
    pi.on("tool_call", (event) => { if (event.toolName === "dev_text") seen.push(structuredClone(event.input)); });
    pi.registerTool({ name: "fixture_throw", label: "fixture", description: "fixture exception", parameters: Type.Object({}),
      async execute() { throw new Error("fixture unexpected failure"); } });
  };
  const f = await openFixture({ inline: [probe] });
  try {
    const result = await call(f.session, "dev_text", { text: "  draft:hello  " });
    assert.equal(result.isError, false);
    assert.deepEqual(result.content, [{ type: "text", text: "HELLO" }]);
    assert.equal(seen.at(-1).text, "hello", "后续 handler 看见修改过的 input");
    const empty = await call(f.session, "dev_text", { text: "   " });
    assert.equal(empty.isError, true); assert.equal((empty.details as any).code, "EMPTY");
    assert.equal(seen.at(-1).text, "   ", "全空白输入保留原结构，由工具报告语义错误");
    const thrown = await call(f.session, "fixture_throw", {});
    assert.equal(thrown.isError, true); assert.match(JSON.stringify(thrown.content), /fixture unexpected failure/);
    const blocked = await call(f.session, "dev_text", { text: "[blocked]" });
    assert.equal(blocked.isError, true); assert.match(JSON.stringify(blocked.content), /示例规则/);
    const seenBeforeEmptyDraft = seen.length;
    const emptyDraft = await call(f.session, "dev_text", { text: " draft:   " });
    assert.equal(emptyDraft.isError, true);
    assert.match(JSON.stringify(emptyDraft.content), /移除 draft: 前缀后文本不能为空/);
    assert.equal(seen.length, seenBeforeEmptyDraft, "拦截后不应将无效参数交给后续 handler");
    const invalid = await call(f.session, "dev_text", { text: "x", delayMs: -1 });
    assert.equal(invalid.isError, true);
    let started!: () => void;
    const waiting = new Promise<void>((resolve) => { started = resolve; });
    const events: any[] = [];
    const unsubscribe = f.session.subscribe((event) => {
      events.push(event);
      if (event.type === "tool_execution_update" && event.toolName === "dev_text") started();
    });
    try {
      const pending = f.session.prompt(JSON.stringify({ tool: "dev_text", args: { text: "cancel", delayMs: 1000 } }));
      await waiting;
      await f.session.abort(); await pending;
      const end = events.findLast((e) => e.type === "tool_execution_end" && e.toolName === "dev_text");
      assert.equal(end?.isError, true);
      assert.ok(!end.result.content.some((c: any) => c.text === "CANCEL"));
      assert.equal(f.session.isStreaming, false);
    } finally { unsubscribe(); }
    assert.deepEqual(f.errors, []);
  } finally { f.session.dispose(); }
});

test("F：组件窄宽/中文、键盘序列与 dispose 后不再重绘（无真实终端）", async () => {
  let renders = 0, closes = 0;
  const panel = new DevPanel(() => renders++, () => closes++, 5);
  try {
    for (const width of [0, 1, 4, 12, 80]) assert.ok(panel.render(width).every((line) => visibleWidth(line) <= width));
    panel.handleInput("\r"); panel.handleInput("\x1b"); assert.equal(closes, 2);
    await delay(25); assert.ok(renders > 0);
    panel.dispose(); panel.dispose();
    const count = renders; await delay(25); assert.equal(renders, count);
    panel.handleInput("\r"); assert.equal(closes, 2);
  } finally { panel.dispose(); }
});
