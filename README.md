# manage-plan-usage

[![CI](https://github.com/rrq-gh/manage-plan-usage/actions/workflows/ci.yml/badge.svg)](https://github.com/rrq-gh/manage-plan-usage/actions/workflows/ci.yml)
[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-blue.svg)](LICENSE)

Control de **holgura de uso del plan** para [Claude Code](https://code.claude.com). Antes de cada acción,
comprueba cuánto llevas consumido de la ventana de **5 horas**, de la de **7 días** y del **contexto** de la
sesión. Si se supera un umbral, Claude Code **te pide confirmación** y Claude recibe la instrucción de
avisarte y esperar tu decisión.

> Decide la persona, no el agente.

```text
Opus 5h ████████░░ 86%  7d ███░░░░░░░ 31%  ctx ██░░░░░░░░ 22%  ⚠ holgura baja
```

## Por qué

En sesiones largas es fácil agotar el límite del plan a mitad de una tarea y dejar el trabajo en un estado
inconsistente. Este control hace visible la holgura y obliga a decidir **antes** de seguir consumiendo:
continuar, reducir el alcance, esperar el reinicio de la ventana o compactar el contexto.

## Requisitos

- Claude Code con sesión iniciada en un **plan Claude** (Pro, Max, Team o Enterprise). Con API key no hay
  datos de `rate_limits`, así que el control pediría confirmación en cada acción por falta de datos.
- **Node.js ≥ 22** en el `PATH`.
- Para la instalación **por proyecto** en Windows: Git Bash, porque el hook usa `$CLAUDE_PROJECT_DIR`.

Sin dependencias: solo se usan módulos nativos de Node.

## Instalación

```bash
git clone https://github.com/rrq-gh/manage-plan-usage.git
node manage-plan-usage/skills/manage-plan-usage/install.mjs
```

Reinicia Claude Code, o abre `/hooks` una vez, para activarlo. La instalación global también registra la
skill `/manage-plan-usage`, de modo que después puedes administrarla desde Claude Code.

| Comando | Efecto |
|---|---|
| `node install.mjs` | Global (`~/.claude`): aplica a todos tus proyectos |
| `node install.mjs --project` | Solo el repositorio actual; se versiona y llega a todo el equipo |
| `node install.mjs --5h 80 --7d 90 --ctx 85` | Fija los umbrales (en %) |
| `node install.mjs --uninstall [--project]` | Revierte la instalación y restaura el statusline anterior |
| `/manage-plan-usage [opciones]` | Lo mismo, desde Claude Code |

> **Ahorro de tokens:** si ejecutas el instalador directamente, o con `!` dentro de Claude Code, no gastas
> tokens. La skill usa `disable-model-invocation: true`, así que no ocupa espacio en el contexto de cada
> sesión.

## Cómo funciona

```text
            ┌──────────── statusline (recibe rate_limits y context_window) ──────────────┐
            │  muestra las barras · guarda .claude/.usage/<session_id>.json              │
            └───────────────────────────────┬─────────────────────────────────────────────┘
                                            │ lee
        ┌───────────────────────────────────┴─────────────────────────────────┐
UserPromptSubmit                                                          PreToolUse (*)
añade el uso al contexto de Claude                       sin holgura o sin datos → "ask" (te pide confirmación)
y, sin holgura, le ordena avisar y esperar               con holgura → no interviene
```

- Los hooks de Claude Code **no reciben** el uso del plan; el statusline sí. Por eso el instalador reemplaza
  el statusline: muestra lo mismo que uno típico (modelo, 5h, 7d, ctx) y además guarda los datos.
- Una ventana cuyo `resets_at` ya pasó se considera reiniciada.
- Los datos con más de 30 minutos de antigüedad se tratan como no confiables y se pide confirmación.
- Si el control falla, pide confirmación en lugar de dejar pasar la acción.
- Si un proyecto tiene su propia instalación (`--project`), la global le cede el control y no se duplican
  las confirmaciones.

Las decisiones de diseño y sus alternativas están en [`docs/decisiones.md`](docs/decisiones.md).

## Configuración

| Variable (en `env` de `settings.json`) | Por defecto | Significado |
|---|---|---|
| `PLAN_USAGE_MAX_5H` | `85` | % máximo de la ventana de 5 h |
| `PLAN_USAGE_MAX_7D` | `90` | % máximo de la ventana de 7 días |
| `PLAN_USAGE_MAX_CTX` | `85` | % máximo del contexto de la sesión |

Para ajustar los umbrales solo en tu máquina dentro de un repo con instalación `--project`, usa el `env` de
`.claude/settings.local.json`.

## Seguridad y privacidad

Todo corre en local: no hay llamadas de red y la caché solo contiene porcentajes y marcas de tiempo.
Antes de cada cambio en `settings.json` el instalador deja una copia `settings.json.bak`. Más detalles en
[`SECURITY.md`](SECURITY.md).

## Desarrollo

```bash
npm test        # pruebas con node:test (sin dependencias)
npm run check   # verificación de sintaxis
```

Lee [`CONTRIBUTING.md`](CONTRIBUTING.md). Si trabajas con un agente de IA, sus reglas están en
[`AGENTS.md`](AGENTS.md).

## Licencia

[MIT](LICENSE)
