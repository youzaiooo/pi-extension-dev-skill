import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
const host = await import(process.env.TEST_PI_ENTRY!);
const root = process.env.TEST_ROOT!;
const work = process.env.TEST_WORK!;

test("G：真实 package 资源发现只暴露 Skill，示例不执行", async () => {
  const agentDir = join(work, "package-agent"), cwd = join(work, "package-cwd");
  await mkdir(agentDir); await mkdir(cwd);
  // 仅 fixture settings 声明本地包，避免安装或修改当前 agent。
  const settingsManager = host.SettingsManager.inMemory({ packages: [root], defaultProjectTrust: "never", cacheWarming: "off" });
  assert.equal(settingsManager.getDefaultProjectTrust(), "never");
  assert.equal(settingsManager.getCacheWarmingMode(), "off");
  const loader = new host.DefaultResourceLoader({ cwd, agentDir, settingsManager, noContextFiles: true });
  await loader.reload();
  assert.deepEqual(loader.getExtensions().errors, []);
  assert.equal(loader.getExtensions().extensions.length, 0);
  assert.equal(loader.getPrompts().prompts.length, 0);
  assert.equal(loader.getThemes().themes.length, 0);
  assert.deepEqual(loader.getSkills().diagnostics, []);
  assert.deepEqual(loader.getSkills().skills.map((s: any) => s.name), ["pi-extension-dev-skill"]);
  assert.deepEqual(await readdir(agentDir), []);
});

async function markdownFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const lists = await Promise.all(entries.filter((e) => !["node_modules", ".git", ".test-work"].includes(e.name)).map(async (entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? markdownFiles(path) : entry.name.endsWith(".md") ? [path] : [];
  }));
  return lists.flat();
}

test("G：全部 Markdown 相对链接、显式锚点、发布文件与版本声明可验证", async () => {
  const files = await markdownFiles(root);
  let links = 0;
  for (const file of files) {
    const text = await readFile(file, "utf8");
    assert.ok(!text.includes("/home/hermes") && !text.includes("~/pico/agent"), file);
    const withoutCode = text.replace(/```[^]*?```/g, "");
    for (const match of withoutCode.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
      const link = match[1];
      if (/^(https?:|mailto:)/.test(link)) continue;
      assert.ok(!link.startsWith("/"), "文档不得引用本机绝对路径：" + link);
      const [path, anchor] = link.split("#");
      const target = path ? resolve(dirname(file), decodeURIComponent(path)) : file;
      assert.ok(target.startsWith(root + "/"));
      const body = await readFile(target, "utf8");
      if (anchor) assert.ok(body.includes('id="' + decodeURIComponent(anchor) + '"'), "使用可验证的显式锚点：" + link);
      links++;
    }
  }
  assert.ok(links > 20);
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  assert.match(manifest.version, /^[0-9]+[.][0-9]+[.][0-9]+$/); assert.deepEqual(manifest.pi.extensions, []);
  const lock = JSON.parse(await readFile(join(root, "package-lock.json"), "utf8"));
  assert.equal(lock.version, manifest.version);
  assert.equal(lock.packages[""].version, manifest.version);
  assert.equal(manifest.dependencies, undefined); assert.equal(manifest.scripts.postinstall, undefined);
  const skill = await readFile(join(root, "SKILL.md"), "utf8");
  assert.match(skill, /^---\nname: pi-extension-dev-skill\ndescription: /);
  assert.equal(skill.split("\n---\n", 1)[0].match(/^  version: "([^"\n]+)"$/m)?.[1], manifest.version);
  assert.match(await readFile(join(root, "references/compatibility.md"), "utf8"), /1\.6\.0/);
  await writeFile(join(work, "navigation.json"), JSON.stringify({ markdownFiles: files.length, localLinks: links }, null, 2));
});
