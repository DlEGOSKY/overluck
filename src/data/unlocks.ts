import type { UnlockDefinition } from "@/types";

/**
 * Unlock catalog. Conditions are intentionally shallow so checks stay cheap
 * (they may run every wave clear). Flavor copy is casino-themed to match the
 * overall voice.
 *
 * Ordering matters only for UI — the first items shown in the menu's "near
 * next unlock" track will be the earliest in this array whose condition is
 * not yet met.
 */
export const UNLOCKS: readonly UnlockDefinition[] = [
  {
    id: "scene_cards",
    kind: "scene",
    displayName: "Mesa de Cartas",
    description: "Abre el Blackjack del crupier entre oleadas.",
    flavor: "Cuando la casa te conoce, te invita a jugar más.",
    color: 0x78d2a6,
    check: (p) => p.highestWaveCleared >= 4,
    progress: (p) => ({ current: Math.min(4, p.highestWaveCleared), target: 4 }),
  },
  {
    id: "tower_sniper",
    kind: "tower",
    displayName: "Torre · Francotirador",
    description: "Alcance extremo, daño quirúrgico.",
    flavor: "Un trato silencioso vale más que cien tiros.",
    color: 0xb07aff,
    check: (p) => p.totalKills >= 50,
    progress: (p) => ({ current: Math.min(50, p.totalKills), target: 50 }),
  },
  {
    id: "relic_amuleto_crupier",
    kind: "relic",
    displayName: "Reliquia · Amuleto del Crupier",
    description: "Los pactos raros aparecen el doble.",
    flavor: "Lo que el crupier toca, se multiplica.",
    color: 0xd4a24c,
    check: (p) => (p.modifiersByRarity.rare ?? 0) >= 5,
    progress: (p) => ({
      current: Math.min(5, p.modifiersByRarity.rare ?? 0),
      target: 5,
    }),
  },
  {
    id: "tower_conduit",
    kind: "tower",
    displayName: "Torre · Conducto",
    description: "Estabiliza la mesa. Apoyo a torres cercanas.",
    flavor: "Ganar una vez no es suerte. Es un método.",
    color: 0x78d2a6,
    check: (p) => p.runsWon >= 1,
    progress: (p) => ({ current: Math.min(1, p.runsWon), target: 1 }),
  },
  {
    id: "relic_ficha_marcada",
    kind: "relic",
    displayName: "Reliquia · Ficha Marcada",
    description: "+10% crit del Gambler.",
    flavor: "La casa siempre deja una marca en tus fichas.",
    color: 0xff5c6c,
    check: (p) => p.chipsLostInSlots >= 500,
    progress: (p) => ({
      current: Math.min(500, p.chipsLostInSlots),
      target: 500,
    }),
  },
  {
    id: "rare_modifiers_full",
    kind: "content",
    displayName: "Pactos Raros Expandidos",
    description: "Acceso completo al catálogo de pactos raros.",
    flavor: "Has probado lo suficiente. La banca te abre la cripta.",
    color: 0xffb454,
    check: (p) => p.highestWaveCleared >= 5,
    progress: (p) => ({ current: Math.min(5, p.highestWaveCleared), target: 5 }),
  },
];
