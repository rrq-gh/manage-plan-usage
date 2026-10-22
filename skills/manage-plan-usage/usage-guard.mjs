#!/usr/bin/env node
// Control de holgura de uso de Claude Code (límites de 5 h, 7 días y contexto).
//
// Los hooks no reciben el uso del plan; el statusline sí. Por eso:
//   statusline → muestra las barras y guarda el uso en .claude/.usage/<session_id>.json
//   prompt     → (UserPromptSubmit) informa el uso a Claude antes de cada tarea
//   pretool    → (PreToolUse) si se supera un umbral o no hay datos, pide decisión al usuario
//
// Umbrales (porcentaje usado) configurables por variable de entorno:
//   PLAN_USAGE_MAX_5H (85) · PLAN_USAGE_MAX_7D (90) · PLAN_USAGE_MAX_CTX (85)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SELF = fileURLToPath(import.meta.url);
const CACHE_DIR = path.resolve(path.dirname(SELF), "..", ".usage");
const STALE_MS = 30 * 60 * 1000;

const LIMITS = {
  fiveHour: Number(process.env.PLAN_USAGE_MAX_5H ?? 85),
  sevenDay: Number(process.env.PLAN_USAGE_MAX_7D ?? 90),
  context: Number(process.env.PLAN_USAGE_MAX_CTX ?? 85),
};

function readStdin() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
}

function cacheFile(sessionId) {
  return path.join(CACHE_DIR, `${String(sessionId || "sin-sesion").replace(/[^\w-]/g, "_")}.json`);
}

// Si la ventana ya se reinició, el porcentaje guardado ya no aplica.
function windowPct(win) {
  if (!win || win.used_percentage == null) return null;
  let resets = Number(win.resets_at);
  if (resets && resets < 1e12) resets *= 1000;
  if (resets && resets < Date.now()) return 0;
  return Number(win.used_percentage);
}

function resetText(win) {
  let resets = Number(win?.resets_at);
  if (!resets) return "";
  if (resets < 1e12) resets *= 1000;
  const d = new Date(resets);
  return ` (se reinicia ${d.toLocaleString("es-PE", { weekday: "short", hour: "2-digit", minute: "2-digit" })})`;
}

function evaluate(sessionId) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(cacheFile(sessionId), "utf8"));
  } catch {
    return { known: false, problems: ["no hay datos de uso todavía (el statusline aún no los registró)"], summary: "uso desconocido" };
  }
  const age = Date.now() - (data.savedAt ?? 0);
  const rl = data.rate_limits ?? {};
  const metrics = [
    { label: "5 h", pct: windowPct(rl.five_hour), max: LIMITS.fiveHour, extra: resetText(rl.five_hour) },
    { label: "7 días", pct: windowPct(rl.seven_day), max: LIMITS.sevenDay, extra: resetText(rl.seven_day) },
    { label: "contexto", pct: data.context_window?.used_percentage ?? null, max: LIMITS.context, extra: "" },
  ];
  const problems = metrics
    .filter((m) => m.pct != null && m.pct >= m.max)
    .map((m) => `${m.label}: ${Math.round(m.pct)}% usado (umbral ${m.max}%)${m.extra}`);
  if (age > STALE_MS) problems.push(`los datos de uso tienen ${Math.round(age / 60000)} min de antigüedad`);
  const summary = metrics
    .map((m) => `${m.label} ${m.pct == null ? "s/d" : Math.round(m.pct) + "%"}${m.extra}`)
    .join(" · ");
  return { known: true, problems, summary };
}

function bar(label, pct) {
  const p = Math.min(Math.max(Number(pct), 0), 100);
  const n = Math.round(p / 10);
  return `${label} ${"█".repeat(n)}${"░".repeat(10 - n)} ${Math.round(p)}%`;
}

function statusline(input) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(
      cacheFile(input.session_id),
      JSON.stringify({ savedAt: Date.now(), rate_limits: input.rate_limits ?? null, context_window: input.context_window ?? null }),
    );
  } catch {
    // El statusline nunca debe fallar por la caché.
  }
  const e = "\x1b";
  let out = `${e}[36m${input.model?.display_name ?? "Claude"}${e}[0m`;
  const rl = input.rate_limits;
  if (rl?.five_hour?.used_percentage != null) {
    out += ` ${e}[34m${bar("5h", rl.five_hour.used_percentage)}`;
    if (rl.seven_day?.used_percentage != null) out += ` ${bar("7d", rl.seven_day.used_percentage)}`;
    out += `${e}[0m`;
  }
  const ctx = input.context_window?.used_percentage;
  if (ctx != null) out += ` ${e}[33m${bar("ctx", ctx)}${e}[0m`;
  const { problems } = evaluate(input.session_id);
  if (problems.length) out += ` ${e}[31m⚠ holgura baja${e}[0m`;
  process.stdout.write(out);
}

function prompt(input) {
  const { problems, summary } = evaluate(input.session_id);
  let ctx = `[Control de uso] ${summary}.`;
  if (problems.length) {
    ctx +=
      ` ATENCIÓN: holgura insuficiente — ${problems.join("; ")}.` +
      " Antes de ejecutar cualquier acción, avisa al usuario de esta situación, estima el costo de la tarea" +
      " y pregúntale cómo proceder (continuar, reducir el alcance, esperar el reinicio o compactar). Decide el usuario, no tú.";
  }
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: ctx } }));
}

function pretool(input) {
  const { problems } = evaluate(input.session_id);
  if (!problems.length) return;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: `Control de uso: ${problems.join("; ")}. ¿Ejecutar ${input.tool_name ?? "la acción"} de todos modos?`,
      },
    }),
  );
}

// Si el proyecto trae su propio usage-guard, la instalación global le cede el control
// (el statusline del proyecto ya tiene prioridad sobre el global).
function deferToProject(input) {
  const dir = process.env.CLAUDE_PROJECT_DIR || input.cwd;
  if (!dir) return false;
  const local = path.resolve(dir, ".claude", "hooks", "usage-guard.mjs");
  if (!fs.existsSync(local)) return false;
  // realpath: en macOS /var → /private/var; un enlace simbólico no debe hacer que el control se ceda a sí mismo.
  const same = (a, b) => fs.realpathSync(a).toLowerCase() === fs.realpathSync(b).toLowerCase();
  return !same(local, SELF);
}

const mode = process.argv[2];
const input = readStdin();
if (mode !== "statusline" && deferToProject(input)) process.exit(0);
try {
  if (mode === "statusline") statusline(input);
  else if (mode === "prompt") prompt(input);
  else if (mode === "pretool") pretool(input);
} catch (err) {
  // Ante un error del control, se pide decisión en lugar de dejar pasar en silencio.
  if (mode === "pretool") {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "ask",
          permissionDecisionReason: `No se pudo verificar el uso (${err.message}). ¿Continuar?`,
        },
      }),
    );
  }
}
