import type { EnemyId, RelicId, TowerId, WaveModifierId, WaveModifierRarity } from "@/types";

/**
 * Persistent profile stored in localStorage. Every field is optional-friendly
 * via a `migrate()` step so bumping the schema version never wipes saves.
 *
 * Keep this shape additive — never rename keys. Deprecated fields should be
 * left in place and ignored instead of removed, to preserve old saves.
 */

export const PROFILE_SCHEMA_VERSION = 1;
export const PROFILE_STORAGE_KEY = "overluck:profile:v1";

export interface ProfileSettings {
  masterVolume: number; // 0..1
  sfxVolume: number; // 0..1
  muted: boolean;
  screenShake: "off" | "low" | "high";
  reducedFlashes: boolean;
}

export interface RunHistoryEntry {
  startedAtMs: number;
  endedAtMs: number;
  durationMs: number;
  waveReached: number;
  waveCleared: number;
  won: boolean;
  chipsEarned: number;
  kills: number;
  modifiersAccepted: number;
  modifiersSkipped: number;
  relicsAcquired: number;
}

export interface ProfileData {
  schemaVersion: number;
  // --- Lifetime totals -------------------------------------------------
  totalChipsEarned: number;
  totalKills: number;
  killsByEnemyType: Partial<Record<EnemyId, number>>;
  runsPlayed: number;
  runsWon: number;
  highestWaveReached: number;
  highestWaveCleared: number;
  bestRunDurationMs: number;
  towersPlaced: number;
  towersPlacedByType: Partial<Record<TowerId, number>>;
  upgradesApplied: number;

  // --- Casino counters -------------------------------------------------
  modifiersAccepted: number;
  modifiersSkipped: number;
  modifiersByRarity: Partial<Record<WaveModifierRarity, number>>;
  modifiersById: Partial<Record<WaveModifierId, number>>;
  slotsPlayed: number;
  roulettePlayed: number;
  cardsPlayed: number;
  chipsLostInSlots: number;

  // --- Relics / content ------------------------------------------------
  relicsAcquired: Partial<Record<RelicId, number>>;

  // --- Achievements / unlocks ------------------------------------------
  unlocks: string[];
  achievements: string[];

  // --- Run history (last N) --------------------------------------------
  recentRuns: RunHistoryEntry[];

  // --- Settings --------------------------------------------------------
  settings: ProfileSettings;
}

export function makeDefaultProfile(): ProfileData {
  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    totalChipsEarned: 0,
    totalKills: 0,
    killsByEnemyType: {},
    runsPlayed: 0,
    runsWon: 0,
    highestWaveReached: 0,
    highestWaveCleared: 0,
    bestRunDurationMs: 0,
    towersPlaced: 0,
    towersPlacedByType: {},
    upgradesApplied: 0,
    modifiersAccepted: 0,
    modifiersSkipped: 0,
    modifiersByRarity: {},
    modifiersById: {},
    slotsPlayed: 0,
    roulettePlayed: 0,
    cardsPlayed: 0,
    chipsLostInSlots: 0,
    relicsAcquired: {},
    unlocks: [],
    achievements: [],
    recentRuns: [],
    settings: {
      masterVolume: 0.8,
      sfxVolume: 0.8,
      muted: false,
      screenShake: "high",
      reducedFlashes: false,
    },
  };
}
