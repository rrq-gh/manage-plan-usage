import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { SKILL_DIR, tmpDir, run, readJson, inSeconds } from "./helpers.mjs";

let project, guard, env;

beforeEach(() => {
  project = tmpDir();
  const hooks = path.join(project, ".claude", "hooks");
  fs.mkdirSync(hooks, { recursive: true });
  guard = path.join(hooks, "usage-guard.mjs");
  fs.copyFileSync(path.join(SKILL_DIR, "usage-guard.mjs"), guard);
  env = { CLAUDE_PROJECT_DIR: project };
});

const status = (rl, ctx, session = "s1") =>
  run(guard, ["statusline"], { env, input: { session_id: session, model: { display_name: "Opus" }, rate_limits: rl, context_window: { used_percentage: ctx } } });
const pretool = (session = "s1", extraEnv = {}) =>
  run(guard, ["pretool"], { env: { ...env, ...extraEnv }, input: { session_id: session, tool_name: "Bash" } });
const win = (pct, s = 3600) => ({ used_percentage: pct, resets_at: inSeconds(s) });

test("statusline muestra las barras y guarda la caché de la sesión", () => {
  const r = status({ five_hour: win(40), seven_day: win(20) }, 30);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /5h .* 40%/);
  assert.match(r.stdout, /7d .* 20%/);
  assert.match(r.stdout, /ctx .* 30%/);
  assert.doesNotMatch(r.stdout, /holgura baja/);
  const cache = readJson(path.join(project, ".claude", ".usage", "s1.json"));
  assert.equal(cache.rate_limits.five_hour.used_percentage, 40);
});

test("pretool no interviene si hay holgura", () => {
  status({ five_hour: win(40), seven_day: win(20) }, 30);
  const r = pretool();
  assert.equal(r.code, 0);
  assert.equal(r.stdout, "");
});

test("pretool pide confirmación si se supera un umbral", () => {
  status({ five_hour: win(92), seven_day: win(20) }, 88);
  const out = JSON.parse(pretool().stdout).hookSpecificOutput;
  assert.equal(out.permissionDecision, "ask");
  assert.match(out.permissionDecisionReason, /5 h: 92%/);
  assert.match(out.permissionDecisionReason, /contexto: 88%/);
});

test("pretool pide confirmación si no hay datos de la sesión", () => {
  const out = JSON.parse(pretool("otra").stdout).hookSpecificOutput;
  assert.equal(out.permissionDecision, "ask");
  assert.match(out.permissionDecisionReason, /no hay datos/);
});

test("una ventana ya reiniciada no cuenta como consumida", () => {
  status({ five_hour: win(99, -60) }, 10);
  assert.equal(pretool().stdout, "");
});

test("los datos antiguos se tratan como no confiables", () => {
  status({ five_hour: win(10) }, 10);
  const file = path.join(project, ".claude", ".usage", "s1.json");
  const cache = readJson(file);
  cache.savedAt = Date.now() - 60 * 60 * 1000;
  fs.writeFileSync(file, JSON.stringify(cache));
  assert.match(JSON.parse(pretool().stdout).hookSpecificOutput.permissionDecisionReason, /antigüedad/);
});

test("los umbrales se ajustan por variable de entorno", () => {
  status({ five_hour: win(60) }, 10);
  assert.equal(pretool().stdout, "");
  assert.equal(JSON.parse(pretool("s1", { PLAN_USAGE_MAX_5H: "50" }).stdout).hookSpecificOutput.permissionDecision, "ask");
});

test("prompt informa el uso y ordena avisar cuando no hay holgura", () => {
  status({ five_hour: win(40) }, 10);
  const ok = JSON.parse(run(guard, ["prompt"], { env, input: { session_id: "s1" } }).stdout).hookSpecificOutput;
  assert.match(ok.additionalContext, /5 h 40%/);
  assert.doesNotMatch(ok.additionalContext, /ATENCIÓN/);
  status({ five_hour: win(95) }, 10);
  const bad = JSON.parse(run(guard, ["prompt"], { env, input: { session_id: "s1" } }).stdout).hookSpecificOutput;
  assert.match(bad.additionalContext, /ATENCIÓN: holgura insuficiente/);
});

test("la instalación global cede el control si el proyecto tiene la suya", () => {
  const globalHome = tmpDir();
  const globalGuard = path.join(globalHome, "hooks", "usage-guard.mjs");
  fs.mkdirSync(path.dirname(globalGuard), { recursive: true });
  fs.copyFileSync(guard, globalGuard);
  const r = run(globalGuard, ["pretool"], { env, input: { session_id: "x", tool_name: "Read" } });
  assert.equal(r.stdout, "");
  const other = run(globalGuard, ["pretool"], { env: { CLAUDE_PROJECT_DIR: tmpDir() }, input: { session_id: "x" } });
  assert.equal(JSON.parse(other.stdout).hookSpecificOutput.permissionDecision, "ask");
});
