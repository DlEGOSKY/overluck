import type { EnemyId } from "./enemy";

export interface WaveSpawn {
  enemyId: EnemyId;
  count: number;
  spawnIntervalMs: number;
  startDelayMs?: number;
}

export interface WaveDefinition {
  index: number;
  displayName: string;
  spawns: readonly WaveSpawn[];
  chipBonus: number;
}

export type WaveList = readonly WaveDefinition[];
