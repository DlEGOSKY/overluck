export type EnemyId =
  | "walker"
  | "runner"
  | "tank"
  | "swarm"
  | "shielded"
  | "armored"
  | "wisp"
  | "elite"
  | "boss"
  | "dealer";

/**
 * Visual form of the enemy. All forms still use an Arc as the underlying
 * hitbox/position; the shape just decides what ornament is layered on top
 * via a Graphics decoration.
 */
export type EnemyShape = "circle" | "triangle" | "diamond" | "plate" | "wisp" | "boss";

export interface BossAbilityDefinition {
  kind: "summon" | "shieldPulse" | "speedBoost" | "chipDrain" | "towerJam" | "houseEdge";
  /** HP ratio (0..1) at which this ability triggers once. */
  hpTrigger: number;
  /** For summon: enemy id to summon and how many. */
  summonId?: EnemyId;
  summonCount?: number;
  /** For shieldPulse: how long the invulnerability lasts (ms). */
  durationMs?: number;
  /** For speedBoost: multiplicative boost applied for the remainder. */
  speedMult?: number;
  /** For chipDrain: fraction of current chips stolen (0..1). */
  chipDrainFraction?: number;
  /** For towerJam: duration towers stop firing (ms). */
  jamDurationMs?: number;
  /** For houseEdge: crit chance reduction applied for the rest of the fight. */
  critPenalty?: number;
}

export interface BossPhaseDefinition {
  /** Label shown in the phase callout. Use sparingly — all caps reads well. */
  label: string;
  /** HP ratio (0..1) where this phase starts. First phase must be 1. */
  hpStart: number;
  /** Accent color used for callout + grading during the phase. */
  color: number;
  /** Flavor line printed in the callout subtitle. */
  flavor: string;
}

export interface EnemyDefinition {
  id: EnemyId;
  displayName: string;
  maxHp: number;
  speed: number;
  damageToBase: number;
  chipReward: number;
  color: number;
  radius: number;

  // --- Visual variants (all optional; default = circle/walker look) -----
  shape?: EnemyShape;
  /** Draws a faint tail behind the enemy while it moves. */
  trail?: boolean;
  /** Orbiting gold aura (elites / minibosses). */
  eliteAura?: boolean;
  /** Floats up and down gently across the path (wisps). */
  floats?: boolean;

  // --- Mechanical modifiers (all optional) ------------------------------
  /** Absorbs N whole shots before popping. First-hit immunity if 1. */
  shieldHits?: number;
  /** Flat damage reduction per incoming shot (final damage clamped to 1). */
  damageReduction?: number;
  /** Splash/AOE ignores this enemy (wisps float above the blast). */
  ignoresSplash?: boolean;

  // --- Boss config (only on boss-tier enemies) --------------------------
  phases?: readonly BossPhaseDefinition[];
  abilities?: readonly BossAbilityDefinition[];
  /** Display a fullscreen HP bar on top of the screen while alive. */
  fullscreenHpBar?: boolean;
}

export type EnemyCatalog = Readonly<Record<EnemyId, EnemyDefinition>>;
