import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { SKILL_DIR, tmpDir, run, readJson } from "./helpers.mjs";

const INSTALL = path.join(SKILL_DIR, "install.mjs");
let home, env, settingsPath;

const OLD = {
  statusLine: { type: "command", command: "echo viejo" },
  hooks: { PreToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: "otro.sh" }] }] },
  theme: "dark",
};

beforeEach(() => {
  home = tmpDir();
  env = { HOME: home, USERPROFILE: home };
  settingsPath = path.join(home, ".claude", "settings.json");
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(OLD));
});

const install = (...args) => run(INSTALL, args, { env });
const guardEntries = (s) =>
  Object.values(s.hooks ?? {}).flat().flatMap((g) => g.hooks).filter((h) => h.command.includes("usage-guard.mjs"));

test("instalación global: hooks, statusline, skill y respaldo", () => {
  assert.equal(install().code, 0);
  const s = readJson(settingsPath);
  assert.match(s.statusLine.command, /usage-guard\.mjs" statusline$/);
  assert.equal(guardEntries(s).length, 2);
  assert.equal(s.theme, "dark");
  assert.ok(s.hooks.PreToolUse.some((g) => g.hooks[0].command === "otro.sh"), "conserva hooks ajenos");
  assert.ok(fs.existsSync(path.join(home, ".claude", "hooks", "usage-guard.mjs")));
  assert.ok(fs.existsSync(path.join(home, ".claude", "skills", "manage-plan-usage", "SKILL.md")));
  assert.deepEqual(readJson(path.join(home, ".claude", "hooks", "usage-guard.prev-statusline.json")), OLD.statusLine);
  assert.ok(fs.existsSync(settingsPath + ".bak"));
});

test("reinstalar es idempotente", () => {
  install();
  install("--5h", "80");
  const s = readJson(settingsPath);
  assert.equal(guardEntries(s).length, 2);
  assert.equal(s.env.PLAN_USAGE_MAX_5H, "80");
  assert.deepEqual(readJson(path.join(home, ".claude", "hooks", "usage-guard.prev-statusline.json")), OLD.statusLine);
});

test("desinstalar restaura la configuración previa", () => {
  install("--ctx", "70");
  assert.equal(install("--uninstall").code, 0);
  assert.deepEqual(readJson(settingsPath), OLD);
  assert.ok(!fs.existsSync(path.join(home, ".claude", "hooks", "usage-guard.mjs")));
});

test("un umbral inválido no modifica nada", () => {
  const r = install("--ctx", "150");
  assert.equal(r.code, 1);
  assert.match(r.stderr, /No se modificó nada/);
  assert.deepEqual(readJson(settingsPath), OLD);
});

test("un settings.json inválido aborta sin sobrescribirlo", () => {
  fs.writeFileSync(settingsPath, "{ roto");
  assert.notEqual(install().code, 0);
  assert.equal(fs.readFileSync(settingsPath, "utf8"), "{ roto");
});

test("instalación por proyecto: rutas portables y .gitignore", () => {
  const repo = tmpDir();
  fs.writeFileSync(path.join(repo, ".gitignore"), "node_modules/");
  assert.equal(run(INSTALL, ["--project"], { env, cwd: repo }).code, 0);
  const s = readJson(path.join(repo, ".claude", "settings.json"));
  assert.ok(guardEntries(s).every((h) => h.command.includes("$CLAUDE_PROJECT_DIR")));
  assert.match(fs.readFileSync(path.join(repo, ".gitignore"), "utf8"), /^\.claude\/\.usage\/$/m);
  assert.ok(!fs.existsSync(path.join(home, ".claude", "skills", "manage-plan-usage")), "no toca la config global");
});
