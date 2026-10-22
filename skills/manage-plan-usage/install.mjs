#!/usr/bin/env node
// Instala o desinstala el control de holgura de uso de Claude Code (usage-guard.mjs).
//
//   node install.mjs                      → global (~/.claude), aplica a todos tus proyectos
//   node install.mjs --project            → solo el proyecto del directorio actual (se versiona con el repo)
//   node install.mjs --5h 80 --7d 90 --ctx 85   → umbrales en % (se guardan en "env" de settings.json)
//   node install.mjs --uninstall [--project]    → revierte la instalación
//
// Es idempotente: reinstalar reemplaza la configuración anterior sin duplicarla.
// Antes de modificar settings.json deja una copia settings.json.bak.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const thresholds = [["--5h", "PLAN_USAGE_MAX_5H"], ["--7d", "PLAN_USAGE_MAX_7D"], ["--ctx", "PLAN_USAGE_MAX_CTX"]];
for (const [opt] of thresholds) {
  const v = value(opt);
  if (v !== undefined && (!/^\d{1,3}$/.test(v) || Number(v) > 100)) {
    console.error(`Error: ${opt} debe ser un entero entre 0 y 100. No se modificó nada.`);
    process.exit(1);
  }
}

const project = flag("--project");
const uninstall = flag("--uninstall");
const base = project ? path.resolve(process.cwd(), ".claude") : path.join(os.homedir(), ".claude");
const hooksDir = path.join(base, "hooks");
const settingsPath = path.join(base, "settings.json");
const prevStatusPath = path.join(hooksDir, "usage-guard.prev-statusline.json");
const MARK = "usage-guard.mjs";

// Global: ruta absoluta (funciona en bash y PowerShell). Proyecto: relativa al repo, válida para todo el equipo.
const scriptRef = project
  ? '"$CLAUDE_PROJECT_DIR/.claude/hooks/usage-guard.mjs"'
  : `"${path.join(hooksDir, "usage-guard.mjs").replace(/\\/g, "/")}"`;
const statusRef = project ? '"${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/usage-guard.mjs"' : scriptRef;

const readJson = (p, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    console.error(`Error: ${p} no es JSON válido; corrígelo antes de instalar (${err.message}). No se modificó nada.`);
    process.exit(1);
  }
};

const settings = readJson(settingsPath, {});
if (fs.existsSync(settingsPath)) fs.copyFileSync(settingsPath, settingsPath + ".bak");

// Quita cualquier hook previo de usage-guard (idempotencia y desinstalación).
settings.hooks ??= {};
for (const event of Object.keys(settings.hooks)) {
  settings.hooks[event] = settings.hooks[event]
    .map((group) => ({ ...group, hooks: (group.hooks ?? []).filter((h) => !String(h.command ?? "").includes(MARK)) }))
    .filter((group) => group.hooks.length);
  if (!settings.hooks[event].length) delete settings.hooks[event];
}

const ownsStatus = String(settings.statusLine?.command ?? "").includes(MARK);

if (uninstall) {
  if (ownsStatus) {
    const prev = readJson(prevStatusPath, null);
    if (prev) settings.statusLine = prev;
    else delete settings.statusLine;
  }
  for (const k of ["PLAN_USAGE_MAX_5H", "PLAN_USAGE_MAX_7D", "PLAN_USAGE_MAX_CTX"]) delete settings.env?.[k];
  if (settings.env && !Object.keys(settings.env).length) delete settings.env;
  if (!Object.keys(settings.hooks).length) delete settings.hooks;
  for (const f of [path.join(hooksDir, "usage-guard.mjs"), prevStatusPath]) fs.rmSync(f, { force: true });
  fs.rmSync(path.join(base, ".usage"), { recursive: true, force: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
  console.log(`Control de uso desinstalado de ${settingsPath}`);
  process.exit(0);
}

const srcDir = path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(hooksDir, { recursive: true });
fs.copyFileSync(path.join(srcDir, "usage-guard.mjs"), path.join(hooksDir, "usage-guard.mjs"));

// En la instalación global desde un clon del repo, registra también la skill /manage-plan-usage.
const skillDir = path.join(base, "skills", "manage-plan-usage");
if (!project && path.resolve(srcDir).toLowerCase() !== path.resolve(skillDir).toLowerCase()) {
  fs.mkdirSync(skillDir, { recursive: true });
  for (const f of ["SKILL.md", "install.mjs", "usage-guard.mjs"]) fs.copyFileSync(path.join(srcDir, f), path.join(skillDir, f));
}

// El statusline alimenta los datos de uso: se reemplaza y el anterior se guarda para restaurarlo.
if (settings.statusLine && !ownsStatus) fs.writeFileSync(prevStatusPath, JSON.stringify(settings.statusLine, null, 2));
settings.statusLine = { type: "command", command: `node ${statusRef} statusline` };

const hook = (mode) => ({ type: "command", command: `node ${scriptRef} ${mode}`, timeout: 10 });
(settings.hooks.UserPromptSubmit ??= []).push({ hooks: [hook("prompt")] });
(settings.hooks.PreToolUse ??= []).push({ matcher: "*", hooks: [hook("pretool")] });

for (const [opt, key] of thresholds) {
  const v = value(opt);
  if (v !== undefined) (settings.env ??= {})[key] = v;
}

fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");

if (project) {
  const gi = path.resolve(process.cwd(), ".gitignore");
  const content = fs.existsSync(gi) ? fs.readFileSync(gi, "utf8") : "";
  if (!content.split(/\r?\n/).includes(".claude/.usage/"))
    fs.writeFileSync(gi, content + (content && !content.endsWith("\n") ? "\n" : "") + ".claude/.usage/\n");
}

console.log(`Control de uso instalado en ${settingsPath}` + (fs.existsSync(prevStatusPath) ? ` (statusline anterior guardado en ${prevStatusPath})` : ""));
console.log("Si la sesión ya estaba abierta, abre /hooks una vez o reinicia Claude Code para activarlo.");
