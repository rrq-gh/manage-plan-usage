# AGENTS.md — manage-plan-usage

Instrucciones para cualquier agente de IA que trabaje en este repositorio (Claude Code, Codex, Cursor,
Copilot, Gemini, etc.). Es la **fuente única** de reglas; `CLAUDE.md` solo lo importa.

## Qué es

Una skill de Claude Code y su instalador. Agrega un statusline y dos hooks (`UserPromptSubmit` y
`PreToolUse`) que piden confirmación al usuario cuando el uso del plan (5 h, 7 días o contexto) supera un
umbral. Contexto y decisiones: `README.md` y `docs/decisiones.md`.

## Mapa

- `skills/manage-plan-usage/usage-guard.mjs`: el control. Modos `statusline`, `prompt` y `pretool`.
- `skills/manage-plan-usage/install.mjs`: instala o desinstala, de forma global o por proyecto.
- `skills/manage-plan-usage/SKILL.md`: skill `/manage-plan-usage`, que solo invoca al instalador.
- `test/`: pruebas con `node:test`; aíslan `HOME`, `USERPROFILE` y `CLAUDE_PROJECT_DIR` en directorios temporales.

## Reglas no negociables

1. **Cero dependencias.** Solo módulos nativos de Node ≥ 22. No agregues `node_modules`.
2. **Nunca romper la configuración del usuario.** Toda escritura en `settings.json` es idempotente,
   conserva las claves y los hooks ajenos, deja `settings.json.bak` y aborta sin escribir si la entrada es inválida.
3. **Fallar de forma segura.** Ante un error o la falta de datos, `pretool` responde `"ask"`; nunca deja
   pasar en silencio. El statusline jamás debe fallar por la caché.
4. **Decide la persona.** El control informa y pide confirmación; no niega acciones ni las ejecuta por su cuenta.
5. **Multiplataforma.** Windows (Git Bash o PowerShell), macOS y Linux. La instalación global usa rutas
   absolutas con `/`; la de proyecto, `$CLAUDE_PROJECT_DIR`.
6. **Sin red ni datos sensibles.** La caché solo guarda porcentajes, contadores de contexto y marcas de tiempo.
7. **Mínimo costo de tokens.** `SKILL.md` es breve y lleva `disable-model-invocation: true`; el texto que se
   inyecta por mensaje es una sola línea mientras haya holgura.
8. **Idioma.** Mensajes al usuario, documentación y commits en español neutro con tuteo.

## Flujo de trabajo

- Antes de cambiar el comportamiento, agrega o ajusta una prueba en `test/` que lo describa.
- Ejecuta `npm test` y `npm run check`; ambos deben pasar antes de proponer un commit.
- Ramas cortas y *pull request* con CI en verde. *Conventional Commits* (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
- Un cambio visible para el usuario actualiza `CHANGELOG.md` (sección *Sin publicar*) y, si aplica, `README.md`.
- Una decisión de diseño nueva o revertida se registra en `docs/decisiones.md`.
- No inventes campos de Claude Code: verifica en la documentación oficial los nombres de eventos,
  `hookSpecificOutput` y los campos del statusline (`rate_limits`, `context_window`).
