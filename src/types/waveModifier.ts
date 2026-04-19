/**
 * Wave modifiers are "pactos" offered by the casino. Each one slants the
 * upcoming wave: usually an upside + a downside. Effects are additive
 * multipliers applied at spawn / damage / chip payout time.
 */
export type WaveModifierId =
  | "doble_o_nada"
  | "mesa_caliente"
  | "mano_firme"
  | "pacto_sangriento"
  | "velocidad_suicida"
  | "tiro_preciso"
  | "casa_gorda"
  | "arrancada_lenta";

export type WaveModifierRarity = "common" | "rare";

export interface WaveModifierEffects {
  /** 1.25 = +25% enemy HP; 0.85 = -15%. */
  enemyHpMult?: number;
  /** 1.25 = +25% enemy speed. */
  enemySpeedMult?: number;
  /** 1.25 = +25% chips on kill. */
  chipRewardMult?: number;
  /** 1.25 = +25% tower damage. */
  towerDamageMult?: number;
  /** Additive number of extra enemies per spawn group. */
  extraEnemiesPerGroup?: number;
  /** 0.85 = -15% tower fire rate cooldown (faster). */
  towerFireRateMult?: number;
  /** Flat chip grant the moment the modifier is accepted. */
  immediateChips?: number;
  /** Flat HP damage the moment the modifier is accepted. */
  immediateBaseDamage?: number;
}

export interface WaveModifierDefinition {
  id: WaveModifierId;
  displayName: string;
  description: string;
  flavor: string;
  rarity: WaveModifierRarity;
  color: number;
  /** Short tag for the HUD chip. */
  shortLabel: string;
  effects: WaveModifierEffects;
}

export type WaveModifierCatalog = Readonly<Record<WaveModifierId, WaveModifierDefinition>>;
