import type { WaveList } from "@/types";

/**
 * Hand-authored progression. Pacing goals:
 *   W1-W2: teach the base loop (Walker/Runner/Tank).
 *   W3-W4: introduce one new enemy per wave (Swarm, Shielded).
 *   W5-W6: stack pressure with Armored + Wisp (ignoresSplash) + Elite.
 *   W7: Final showdown — 3-phase boss with summons, shield pulse, speed boost.
 */
export const WAVES: WaveList = [
  {
    index: 1,
    displayName: "Oleada 1 · Entrada",
    chipBonus: 12,
    spawns: [
      { enemyId: "walker", count: 5, spawnIntervalMs: 1000 },
    ],
  },
  {
    index: 2,
    displayName: "Oleada 2 · Corre la voz",
    chipBonus: 18,
    spawns: [
      { enemyId: "walker", count: 8, spawnIntervalMs: 850 },
      { enemyId: "runner", count: 2, spawnIntervalMs: 700, startDelayMs: 3000 },
    ],
  },
  {
    index: 3,
    displayName: "Oleada 3 · El enjambre",
    chipBonus: 25,
    spawns: [
      { enemyId: "walker", count: 6, spawnIntervalMs: 800 },
      { enemyId: "swarm", count: 10, spawnIntervalMs: 260, startDelayMs: 2800 },
      { enemyId: "runner", count: 4, spawnIntervalMs: 600, startDelayMs: 7200 },
      { enemyId: "tank", count: 1, spawnIntervalMs: 1, startDelayMs: 11500 },
    ],
  },
  {
    index: 4,
    displayName: "Oleada 4 · Escolta",
    chipBonus: 35,
    spawns: [
      { enemyId: "walker", count: 6, spawnIntervalMs: 700 },
      { enemyId: "shielded", count: 3, spawnIntervalMs: 2400, startDelayMs: 1500 },
      { enemyId: "runner", count: 8, spawnIntervalMs: 500, startDelayMs: 4200 },
      { enemyId: "tank", count: 2, spawnIntervalMs: 3500, startDelayMs: 8200 },
    ],
  },
  {
    index: 5,
    displayName: "Oleada 5 · Blindaje",
    chipBonus: 48,
    spawns: [
      { enemyId: "walker", count: 8, spawnIntervalMs: 650 },
      { enemyId: "armored", count: 4, spawnIntervalMs: 2200, startDelayMs: 1800 },
      { enemyId: "shielded", count: 3, spawnIntervalMs: 2000, startDelayMs: 5600 },
      { enemyId: "runner", count: 6, spawnIntervalMs: 450, startDelayMs: 9200 },
    ],
  },
  {
    index: 6,
    displayName: "Oleada 6 · Espectros",
    chipBonus: 65,
    spawns: [
      { enemyId: "walker", count: 10, spawnIntervalMs: 550 },
      { enemyId: "wisp", count: 6, spawnIntervalMs: 900, startDelayMs: 2200 },
      { enemyId: "swarm", count: 14, spawnIntervalMs: 220, startDelayMs: 5800 },
      { enemyId: "elite", count: 1, spawnIntervalMs: 1, startDelayMs: 11000 },
      { enemyId: "tank", count: 2, spawnIntervalMs: 2800, startDelayMs: 13000 },
    ],
  },
  {
    index: 7,
    displayName: "Final · El Crupier Mayor",
    chipBonus: 150,
    spawns: [
      { enemyId: "walker", count: 10, spawnIntervalMs: 600 },
      { enemyId: "shielded", count: 3, spawnIntervalMs: 1800, startDelayMs: 2500 },
      { enemyId: "armored", count: 3, spawnIntervalMs: 2200, startDelayMs: 5200 },
      { enemyId: "wisp", count: 4, spawnIntervalMs: 900, startDelayMs: 8200 },
      { enemyId: "runner", count: 8, spawnIntervalMs: 420, startDelayMs: 11000 },
      { enemyId: "elite", count: 1, spawnIntervalMs: 1, startDelayMs: 14500 },
      { enemyId: "boss", count: 1, spawnIntervalMs: 1, startDelayMs: 18000 },
    ],
  },
];
