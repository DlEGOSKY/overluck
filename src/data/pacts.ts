import type { PactCatalog } from "@/types";

/**
 * Permanent pacts purchased with gems between runs.
 * Each pact has up to 3 levels with escalating costs.
 */
export const PACTS: PactCatalog = {
  lucky_start: {
    id: "lucky_start",
    displayName: "Inicio Afortunado",
    description: "+10 fichas iniciales por nivel",
    color: 0xffd700,
    maxLevel: 3,
    costs: [3, 6, 12],
    effectPerLevel: 10,
    effectKind: "extra_chips",
  },
  iron_base: {
    id: "iron_base",
    displayName: "Base de Hierro",
    description: "+2 HP base por nivel",
    color: 0x90caf9,
    maxLevel: 3,
    costs: [4, 8, 15],
    effectPerLevel: 2,
    effectKind: "extra_base_hp",
  },
  quick_draw: {
    id: "quick_draw",
    displayName: "Mano Rápida",
    description: "-3 % cadencia torres por nivel",
    color: 0xff8a65,
    maxLevel: 3,
    costs: [5, 10, 18],
    effectPerLevel: 0.03,
    effectKind: "tower_fire_rate_mult",
  },
  house_cut: {
    id: "house_cut",
    displayName: "Tajada de la Casa",
    description: "+5 % fichas por kill por nivel",
    color: 0x66bb6a,
    maxLevel: 3,
    costs: [3, 7, 14],
    effectPerLevel: 0.05,
    effectKind: "chip_reward_mult",
  },
  croupier_eye: {
    id: "croupier_eye",
    displayName: "Ojo del Crupier",
    description: "+2 % crit por nivel",
    color: 0xce93d8,
    maxLevel: 3,
    costs: [4, 9, 16],
    effectPerLevel: 0.02,
    effectKind: "crit_bonus",
  },
};
