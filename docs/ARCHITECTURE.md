# ARCHITECTURE.md — OVERLUCK

## Núcleo
- scenes/ controla flujo de juego
- systems/ ejecuta combate, economía y recompensas
- entities/ define clases base
- data/ define contenido
- types/ define contratos TypeScript
- audio/ y ui/ van después del núcleo

## Principios
- systems leen data y aplican reglas
- entities no contienen todo el juego
- scenes orquestan, no hardcodean contenido
- casino y shop van después del core de defensa
