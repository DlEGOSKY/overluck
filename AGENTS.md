# AGENTS.md — OVERLUCK

## Propósito
Construir OVERLUCK como un tower defense roguelite donde el casino afecta de verdad la estrategia.

## Fuente de verdad
Leer y respetar:
- README.md
- PROJECT_RULES.md
- PROMPT_WINDSURF.md
- docs/ARCHITECTURE.md
- docs/COMBAT_SYSTEM.md
- docs/WAVE_SYSTEM.md
- docs/CASINO_SYSTEM.md
- docs/ROGUELITE_SYSTEM.md
- docs/UI_SYSTEM.md
- docs/ROADMAP.md

## Filosofía
- primero loop de combate, luego capa casino
- primero sistemas base, luego efectos complejos
- primero TypeScript y datos claros, luego espectáculo
- no sobrecargar la Fase 1 con todo el metajuego

## Reglas
- todo vive dentro de Phaser
- no agregar dependencias nuevas
- data/ define contenido, systems/ ejecuta
- no meter casino completo antes de validar wave/tower/enemy loop
- mantener TypeScript estricto
