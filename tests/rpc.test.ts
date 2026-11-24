import assert from "node:assert/strict";
import { test } from "node:test";
import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";

const root = process.env.TEST_ROOT!;
const work = process.env.TEST_WORK!;

test("F：真实 CLI RPC 所有 stdout 行为 JSONL，命令/空选择/TUI 降级/关闭", { timeout: 30000 }, async () => {
  const agentDir = join(work, "rpc-agent"); const cwd = join(work, "rpc-cwd");
  await mkdir(agentDir); await mkdir(cwd);
  const cli = resolve(process.env.TEST_PI_ROOT!, "dist/cli.js");
  const extensions = ["tests/fixtures/fake-provider.ts", "examples/command/index.ts", "examples/command/panel.ts", "examples/tool/index.ts", "examples/session-state/index.ts", "examples/tool-interception/index.ts", "examples/agent-scope/index.ts"];
  const child = spawn(process.execPath, ["--import", resolve(root, "tests/no-network.mjs"), cli,
    "--mode", "rpc", "--no-session", "--offline", "--no-extensions", "--no-mcp", "--no-skills", "--no-context-files",
    "--no-prompt-templates", "--no-themes", "--no-approve", "--no-builtin-tools",
    "--provider", "fixture", "--model", "fixture", ...extensions.flatMap((f) => ["-e", resolve(root, f)])], {
    cwd, env: { ...process.env, PI_CODING_AGENT_DIR: agentDir }, stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "", stderr = "", pending = "", failed: Error | undefined;
  const records: any[] = [];
  const waiters = new Set<() => void>();
  const receive = (record: any) => {
    records.push(record);
    if (record.type === "extension_ui_request" && record.method === "select") {
      child.stdin.write(JSON.stringify({ type: "extension_ui_response", id: record.id, cancelled: true }) + "\n");
    }
    for (const notify of waiters) notify();
  };
  child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
  child.stdout.on("data", (data: string) => {
    stdout += data; pending += data;
    for (let index; (index = pending.indexOf("\n")) !== -1;) {
      const line = pending.slice(0, index).replace(/\r$/, ""); pending = pending.slice(index + 1);
      try { receive(JSON.parse(line)); } catch { failed = new Error("非 JSONL stdout：" + line); for (const notify of waiters) notify(); }
    }
  });
  child.stderr.on("data", (data) => { stderr += data; });
  child.on("error", (error) => { failed = error; for (const notify of waiters) notify(); });
  const exited = new Promise<number | null>((resolve) => child.on("exit", (code) => resolve(code)));
  const wait = (predicate: (r: any) => boolean): Promise<any> => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { waiters.delete(check); reject(new Error("RPC 等待超时：" + stderr)); }, 12000);
    function check() {
      if (failed) { clearTimeout(timer); waiters.delete(check); reject(failed); return; }
      const value = records.find(predicate);
      if (value) { clearTimeout(timer); waiters.delete(check); resolve(value); }
    }
    waiters.add(check); check();
  });
  let id = 0;
  async function send(type: string, data: object = {}) {
    const requestId = "rpc-" + id++;
    const response = wait((r) => r.type === "response" && r.id === requestId);
    child.stdin.write(JSON.stringify({ id: requestId, type, ...data }) + "\n");
    const value = await response; assert.equal(value.success, true, JSON.stringify(value)); return value;
  }
  try {
    await send("get_state");
    const commands = await send("get_commands");
    assert.match(JSON.stringify(commands), /dev-info/);
    await send("prompt", { message: "/dev-info" });
    await send("prompt", { message: "/dev-pick" });
    await send("prompt", { message: "/dev-panel" });
    const entries = await send("get_entries");
    const all = entries.data.entries as any[];
    assert.ok(all.some((e) => e.customType === "dev-info:last" && e.data.mode === "rpc"));
    assert.ok(all.some((e) => e.customType === "dev-pick:last" && e.data.choice === null));
    assert.ok(all.some((e) => e.customType === "dev-panel:last" && e.data.supported === false));
    assert.equal(records.some((r) => r.type === "agent_start"), false, "命令不能触发模型请求");
    async function tool(tool: string, args: object) {
      const boundary = records.length;
      const settled = wait((r) => r.type === "agent_settled" && records.indexOf(r) >= boundary);
      await send("prompt", { message: JSON.stringify({ tool, args }) });
      await settled;
      const result = records.slice(boundary).find((r) => r.type === "tool_execution_end" && r.toolName === tool);
      assert.ok(result); assert.equal(result.isError, false);
      return result;
    }
    const textResult = await tool("dev_text", { text: " rpc\u2028中文\u2029tail " });
    assert.equal(textResult.result.content[0].text, "RPC\u2028中文\u2029TAIL");
    await tool("dev_private_note", { action: "create", text: "cli-private" });
    const note = join(agentDir, "extension-data/dev-scope/note.txt");
    assert.equal(await readFile(note, "utf8"), "cli-private", "CLI 默认入口确实使用子进程 agentDir");
    await tool("dev_private_note", { action: "delete" });
    await assert.rejects(readFile(note), { code: "ENOENT" });
    child.stdin.end();
    assert.equal(await exited, 0);
    assert.equal(pending, ""); assert.equal(failed, undefined);
    assert.ok(stdout.trim().split("\n").every((line) => typeof JSON.parse(line) === "object"));
  } finally {
    if (child.exitCode === null) child.kill("SIGTERM");
    await writeFile(join(work, "rpc-stdout.jsonl"), stdout);
    await writeFile(join(work, "rpc-stderr.log"), stderr);
  }
});
