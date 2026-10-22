# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y
[Versionado Semántico](https://semver.org/lang/es/).

## [Sin publicar]

## [1.0.1] - 2026-10-22

### Corregido

- El control global ya no se cede a sí mismo cuando la ruta del proyecto pasa por un enlace simbólico
  (por ejemplo, `/var` → `/private/var` en macOS).

## [1.0.0] - 2026-10-22

### Agregado

- `usage-guard.mjs` con tres modos: `statusline` (barras de 5h, 7d y ctx más la caché), `prompt` (uso en el
  contexto de Claude) y `pretool` (confirmación si se supera un umbral o faltan datos).
- `install.mjs`: instalación global o por proyecto, idempotente, con respaldo y restauración del statusline,
  umbrales configurables y desinstalación.
- Skill `/manage-plan-usage` con `disable-model-invocation: true`.
- La instalación global cede el control a la del proyecto cuando existe.
- Pruebas con `node:test` y CI en Linux, macOS y Windows con Node 22 y 24.
