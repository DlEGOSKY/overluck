export type TowerId = "blaster" | "gambler" | "shock" | "sniper" | "conduit";

export interface TowerRoll {
  critChance: number;
  critMultiplier: number;
  misfireChance: number;
  misfireMultiplier: number;
}

export interface TowerSplash {
  radius: number;
  falloff: number;
}

/**
 * Incremental upgrade applied on top of the previous tier's stats.
 * Any field that is undefined inherits from the current tier.
 */
export interface TowerUpgrade {
  tierLabel: string;
  cost: number;
  damage?: number;
  range?: number;
  fireRateMs?: number;
  projectileSpeed?: number;
  roll?: TowerRoll;
  splash?: TowerSplash;
  summary: string;
}

export interface TowerDefinition {
  id: TowerId;
  displayName: string;
  description: string;
  cost: number;
  range: number;
  fireRateMs: number;
  damage: number;
  projectileSpeed: number;
  color: number;
  baseRadius: number;
  roll?: TowerRoll;
  splash?: TowerSplash;
  upgrades?: readonly TowerUpgrade[];
}

export type TowerCatalog = Readonly<Record<TowerId, TowerDefinition>>;

export interface TowerSlot {
  x: number;
  y: number;
}
