export type PactId =
  | "lucky_start"
  | "iron_base"
  | "quick_draw"
  | "house_cut"
  | "croupier_eye";

export interface PactDefinition {
  id: PactId;
  displayName: string;
  description: string;
  color: number;
  maxLevel: number;
  /** Gem cost for each level (index 0 = cost of level 1). */
  costs: readonly number[];
  /** Effect value per level (cumulative). */
  effectPerLevel: number;
  effectKind: "extra_chips" | "extra_base_hp" | "tower_fire_rate_mult" | "chip_reward_mult" | "crit_bonus";
}

export type PactCatalog = Readonly<Record<PactId, PactDefinition>>;
