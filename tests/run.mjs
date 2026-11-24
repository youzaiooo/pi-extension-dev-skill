import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
await mkdir(resolve(root, ".test-work"), { recursive: true });
const work = await mkdtemp(resolve(root, ".test-work/run-"));
for (const name of ["home", "tmp", "env-agent", "cache"]) await mkdir(resolve(work, name));
const host = process.argv[2] ? resolve(process.argv[2]) : resolve(root, "node_modules/@earendil-works/pi-coding-agent");
// 白名单环境：不继承 provider key、配置、日志开关或当前 agent 的其它状态。
const env = {
  PATH: process.env.PATH,
  HOME: resolve(work, "home"),
  TMPDIR: resolve(work, "tmp"),
  XDG_CACHE_HOME: resolve(work, "cache"),
  PI_CODING_AGENT_DIR: resolve(work, "env-agent"),
  PI_OFFLINE: "1",
  NO_COLOR: "1",
  TEST_WORK: work,
  TEST_ROOT: root,
  TEST_PI_ROOT: host,
  TEST_PI_ENTRY: pathToFileURL(resolve(host, "dist/index.js")).href,
};
const args = ["--import", resolve(root, "tests/no-network.mjs"), "--test", "--test-concurrency=1",
  ...["sdk.test.ts", "rpc.test.ts", "package.test.ts"].map((name) => resolve(root, "tests", name))];
const result = spawnSync(process.execPath, args, { cwd: root, env, encoding: "utf8", timeout: 120000, maxBuffer: 1024 * 1024 });
const output = (result.stdout ?? "") + (result.stderr ?? "");
await writeFile(resolve(work, "results.tap"), output);
console.log(output);
console.log("测试产物：", work);
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
