import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, posix } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outputDir = resolve(root, ".test-work/pack");
await mkdir(outputDir, { recursive: true });
await mkdir(resolve(root, ".test-work/tmp"), { recursive: true });
const packed = spawnSync("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", outputDir], {
  cwd: root,
  env: { ...process.env, TMPDIR: resolve(root, ".test-work/tmp") },
  encoding: "utf8",
});
assert.equal(packed.status, 0, packed.stderr);
const report = JSON.parse(packed.stdout);
// npm 12 返回按包名索引的对象；较早 npm 返回数组。
const metadata = Array.isArray(report) ? report[0] : Object.values(report)[0];
assert.ok(metadata?.filename, "npm pack 必须返回归档名称");
const archive = resolve(outputDir, metadata.filename);
const list = spawnSync("tar", ["-tzf", archive], { encoding: "utf8" });
assert.equal(list.status, 0, list.stderr);
const paths = new Set(list.stdout.trim().split("\n").map((path) => path.replace(/^package\//, "")));
assert.ok([...paths].every((path) => !/(^|\/)(node_modules|\.test-work|\.git)(\/|$)/.test(path)));
const read = (path) => {
  assert.ok(paths.has(path), "打包遗漏文档目标：" + path);
  const result = spawnSync("tar", ["-xOzf", archive, "package/" + path], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
};
const manifest = JSON.parse(read("package.json"));
assert.deepEqual(manifest.pi, { skills: ["."], extensions: [], prompts: [], themes: [] });
assert.equal(manifest.dependencies, undefined);
assert.equal(manifest.scripts.postinstall, undefined);
let links = 0;
for (const path of paths) {
  if (!path.endsWith(".md")) continue;
  const body = read(path).replace(/```[^]*?```/g, "");
  for (const match of body.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const link = match[1];
    if (/^(https?:|mailto:)/.test(link)) continue;
    assert.ok(!link.startsWith("/"), link);
    const [file, anchor] = link.split("#");
    const target = file ? posix.normalize(posix.join(posix.dirname(path), decodeURIComponent(file))) : path;
    const content = read(target);
    if (anchor) assert.ok(content.includes('id="' + decodeURIComponent(anchor) + '"'), link);
    links++;
  }
}
assert.ok(links > 20);
await writeFile(resolve(outputDir, "manifest.json"), JSON.stringify({ ...metadata, localLinks: links }, null, 2) + "\n");
console.log(JSON.stringify({ archive, files: paths.size, localLinks: links, bytes: metadata.size, sha512: metadata.integrity }, null, 2));
