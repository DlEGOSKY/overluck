import type { RelicCatalog } from "@/types";

export const RELICS: RelicCatalog = {
  loaded_chip: {
    id: "loaded_chip",
    displayName: "Ficha Cargada",
    description: "+25% fichas por kill.",
    color: 0xffd166,
    effects: [{ kind: "chip_reward_multiplier", value: 0.25 }],
  },
  hot_hand: {
    id: "hot_hand",
    displayName: "Mano Caliente",
    description: "+12% chance de crit del Gambler.",
    color: 0xff7a59,
    effects: [{ kind: "gambler_crit_bonus", value: 0.12 }],
  },
  steady_hand: {
    id: "steady_hand",
    displayName: "Pulso Firme",
    description: "-10% chance de fallo del Gambler.",
    color: 0x6fd3ff,
    effects: [{ kind: "gambler_misfire_reduction", value: 0.1 }],
  },
  sparkplug: {
    id: "sparkplug",
    displayName: "Chispa Extra",
    description: "+30% radio de splash del Shock.",
    color: 0xa97bff,
    effects: [{ kind: "shock_splash_bonus", value: 0.3 }],
  },
  greased_dice: {
    id: "greased_dice",
    displayName: "Dados Pesados",
    description: "+20% fichas por kill.",
    color: 0xffa94d,
    effects: [{ kind: "chip_reward_multiplier", value: 0.2 }],
  },
  amuleto_crupier: {
    id: "amuleto_crupier",
    displayName: "Amuleto del Crupier",
    description: "Los pactos raros aparecen el doble.",
    color: 0xd4a24c,
    effects: [{ kind: "rare_modifier_bias", value: 1.0 }],
  },
  ficha_marcada: {
    id: "ficha_marcada",
    displayName: "Ficha Marcada",
    description: "+10% crit del Gambler. La casa recuerda tu ficha.",
    color: 0xff5c6c,
    effects: [{ kind: "gambler_crit_bonus", value: 0.1 }],
  },
};
