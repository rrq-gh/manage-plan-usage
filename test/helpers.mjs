import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "skills", "manage-plan-usage");

export function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mpu-"));
}

// Ejecuta un script con stdin JSON y un entorno aislado (sin heredar CLAUDE_PROJECT_DIR ni umbrales).
export function run(script, args, { input = {}, env = {}, cwd } = {}) {
  const base = { ...process.env };
  for (const k of Object.keys(base)) if (k.startsWith("PLAN_USAGE_") || k === "CLAUDE_PROJECT_DIR") delete base[k];
  const res = spawnSync(process.execPath, [script, ...args], {
    input: JSON.stringify(input),
    env: { ...base, ...env },
    cwd,
    encoding: "utf8",
  });
  return { code: res.status, stdout: res.stdout, stderr: res.stderr };
}

export function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

export const inSeconds = (s) => Math.floor(Date.now() / 1000) + s;
