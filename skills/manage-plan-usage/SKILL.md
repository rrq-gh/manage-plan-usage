---
name: manage-plan-usage
description: Instala, ajusta o desinstala el control de holgura de uso del plan (5 h, 7 días y contexto) que pide confirmación antes de actuar cuando se supera un umbral.
disable-model-invocation: true
argument-hint: "[--project] [--uninstall] [--5h N] [--7d N] [--ctx N]"
---

Ejecuta exactamente este comando, con `<dir>` = directorio base de esta skill, y no hagas nada más:

`node "<dir>/install.mjs" $ARGUMENTS`

Luego responde en una línea con lo que imprimió. Si falló, muestra el error tal cual.
