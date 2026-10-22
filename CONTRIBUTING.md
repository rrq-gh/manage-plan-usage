# Cómo contribuir

¡Gracias por tu interés! Este proyecto es pequeño a propósito: cero dependencias y un solo objetivo.

1. Abre primero un *issue* para discutir cambios de comportamiento.
2. Crea una rama corta desde `main` (`feat/...`, `fix/...`, `docs/...`).
3. Escribe o ajusta una prueba en `test/` que describa el cambio.
4. Ejecuta `npm test` y `npm run check`.
5. Usa [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/) y actualiza `CHANGELOG.md`.
6. Abre el *pull request* con la plantilla y espera a que el CI quede en verde. Se integra con *squash merge*.

## Trabajo asistido por IA

Se aceptan contribuciones hechas con agentes de IA, con estas condiciones:

- El agente sigue `AGENTS.md`; Claude Code lo carga mediante `CLAUDE.md`.
- La persona que abre el PR **revisa y entiende** cada línea y responde por ella.
- Marca en el PR que hubo asistencia de IA y qué herramienta se usó.
- No pegues en *prompts*, *issues* ni pruebas datos reales de configuración que incluyan secretos.

## Pruebas manuales

Para probar el instalador sin tocar tu configuración, apunta `HOME` y `USERPROFILE` a una carpeta temporal:

```bash
HOME=/tmp/mpu USERPROFILE=/tmp/mpu node skills/manage-plan-usage/install.mjs
```
