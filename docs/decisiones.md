# Registro de decisiones

Formato breve de ADR: contexto, decisión y alternativas descartadas.

## ADR-01 — El statusline como fuente del uso del plan

- **Contexto:** los hooks de Claude Code no reciben el uso del plan. El statusline sí recibe
  `rate_limits.five_hour`, `rate_limits.seven_day` (`used_percentage` y `resets_at`) y `context_window`.
- **Decisión:** el statusline guarda esos datos en `<base>/.usage/<session_id>.json` y los hooks los leen.
- **Descartado:** consultar una API de uso (no existe una pública y estable para el plan, y añadiría red y
  credenciales); estimar el uso contando tokens del transcript (impreciso y no refleja otras sesiones).

## ADR-02 — Pedir confirmación (`ask`) en lugar de bloquear (`deny`)

- **Contexto:** el usuario quiere decidir él mismo qué hacer cuando no hay holgura.
- **Decisión:** `PreToolUse` responde `permissionDecision: "ask"` con el motivo. `UserPromptSubmit` añade
  contexto para que el agente avise **antes** de empezar la tarea.
- **Descartado:** `deny`, porque quitaría la decisión a la persona; solo informar, porque el agente podría ignorarlo.

## ADR-03 — Fallar de forma segura

- **Decisión:** ante la falta de datos, datos con más de 30 minutos o un error interno, se pide confirmación.
  Una ventana cuyo `resets_at` ya pasó cuenta como reiniciada, para no molestar sin motivo.

## ADR-04 — Instalador idempotente en lugar de un plugin

- **Contexto:** un plugin puede traer hooks, pero no configurar el statusline, que es la fuente de datos (ADR-01).
- **Decisión:** `install.mjs` fusiona la configuración en `settings.json`, global o por proyecto. Respalda
  el statusline anterior para restaurarlo y no duplica entradas al reinstalar.

## ADR-05 — Prioridad del proyecto sobre la instalación global

- **Contexto:** un repo de equipo puede versionar su propia instalación (`--project`). Si además existe la
  global, se ejecutarían dos controles.
- **Decisión:** la copia global no actúa si `$CLAUDE_PROJECT_DIR/.claude/hooks/usage-guard.mjs` existe. El
  statusline del proyecto ya tiene prioridad sobre el global por la precedencia de settings.

## ADR-06 — Skill con `disable-model-invocation`

- **Decisión:** la skill solo invoca al instalador y no se anuncia al modelo, para no consumir contexto en
  cada sesión. Se usa con `/manage-plan-usage` o ejecutando `install.mjs` directamente, sin gastar tokens.
