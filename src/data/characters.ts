import type { CharacterCatalog } from "@/types";

/**
 * Character loadouts. Each character provides a starting relic and passive
 * bonuses that subtly bias the early game without overpowering mid-game
 * choices.
 */
export const CHARACTERS: CharacterCatalog = {
  novato: {
    id: "novato",
    displayName: "El Novato",
    description: "Empieza con fichas extra. Ideal para principiantes.",
    color: 0x66bb6a,
    startingRelic: null,
    passives: [{ kind: "extra_chips", value: 25 }],
  },
  tahur: {
    id: "tahur",
    displayName: "El Tahúr",
    description: "Empieza con Mano Caliente. Más críticos, más riesgo.",
    color: 0xef5350,
    startingRelic: "hot_hand",
    passives: [{ kind: "crit_bonus", value: 0.03 }],
  },
  mecanico: {
    id: "mecanico",
    displayName: "La Mecánica",
    description: "Torres disparan más rápido. Empieza con Bujía.",
    color: 0x42a5f5,
    startingRelic: "sparkplug",
    passives: [{ kind: "tower_fire_rate_mult", value: 0.90 }],
  },
  vidente: {
    id: "vidente",
    displayName: "La Vidente",
    description: "Base más resistente. Empieza con Amuleto del Crupier.",
    color: 0xab47bc,
    startingRelic: "amuleto_crupier",
    passives: [
      { kind: "extra_base_hp", value: 5 },
      { kind: "chip_reward_mult", value: 0.10 },
    ],
  },
};
