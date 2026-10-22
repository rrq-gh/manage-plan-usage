# Política de seguridad

## Alcance

- `install.mjs` modifica `~/.claude/settings.json`, o `.claude/settings.json` del proyecto, y copia scripts
  en `.claude/hooks/` y `.claude/skills/`.
- `usage-guard.mjs` se ejecuta en cada mensaje, en cada uso de herramienta y en cada refresco del statusline.
- No realiza llamadas de red ni lee credenciales. La caché (`.claude/.usage/`) solo contiene porcentajes,
  contadores de tokens de contexto y marcas de tiempo.

## Recomendaciones

- Revisa el código antes de instalarlo: los hooks se ejecutan con tus permisos.
- En la instalación por proyecto, el `settings.json` versionado ejecuta código en la máquina de quien clone
  el repo. Claude Code pide confiar en la carpeta antes de cargarlo.

## Reportar una vulnerabilidad

No abras un *issue* público. Usa
[GitHub Private Vulnerability Reporting](https://github.com/rrq-gh/manage-plan-usage/security/advisories/new).
Se responde en un plazo de 7 días.
