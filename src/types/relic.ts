export type RelicId =
  | "loaded_chip"
  | "hot_hand"
  | "steady_hand"
  | "sparkplug"
  | "greased_dice"
  | "amuleto_crupier"
  | "ficha_marcada";

export type RelicEffectKind =
  | "chip_reward_multiplier"
  | "gambler_crit_bonus"
  | "gambler_misfire_reduction"
  | "shock_splash_bonus"
  | "rare_modifier_bias";

export interface RelicEffect {
  kind: RelicEffectKind;
  value: number;
}

export interface RelicDefinition {
  id: RelicId;
  displayName: string;
  description: string;
  color: number;
  effects: readonly RelicEffect[];
}

export type RelicCatalog = Readonly<Record<RelicId, RelicDefinition>>;
