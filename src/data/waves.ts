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
    displayName: "Oleada 7 · Avalancha",
    chipBonus: 80,
    spawns: [
      { enemyId: "swarm", count: 20, spawnIntervalMs: 180 },
      { enemyId: "armored", count: 3, spawnIntervalMs: 1800, startDelayMs: 3800 },
      { enemyId: "runner", count: 10, spawnIntervalMs: 360, startDelayMs: 7200 },
      { enemyId: "shielded", count: 3, spawnIntervalMs: 1600, startDelayMs: 11000 },
    ],
  },
  {
    index: 8,
    displayName: "Oleada 8 · Espejos rotos",
    chipBonus: 95,
    spawns: [
      { enemyId: "walker", count: 8, spawnIntervalMs: 500 },
      { enemyId: "wisp", count: 8, spawnIntervalMs: 700, startDelayMs: 1800 },
      { enemyId: "shielded", count: 5, spawnIntervalMs: 1500, startDelayMs: 5600 },
      { enemyId: "elite", count: 1, spawnIntervalMs: 1, startDelayMs: 12000 },
    ],
  },
  {
    index: 9,
    displayName: "Oleada 9 · Penúltima prueba",
    chipBonus: 115,
    spawns: [
      { enemyId: "armored", count: 5, spawnIntervalMs: 1600 },
      { enemyId: "wisp", count: 6, spawnIntervalMs: 800, startDelayMs: 2400 },
      { enemyId: "swarm", count: 16, spawnIntervalMs: 200, startDelayMs: 6000 },
      { enemyId: "tank", count: 3, spawnIntervalMs: 2600, startDelayMs: 10500 },
      { enemyId: "elite", count: 2, spawnIntervalMs: 3500, startDelayMs: 14500 },
    ],
  },
  {
    index: 10,
    displayName: "Final · El Crupier Mayor",
    chipBonus: 180,
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
  {
    index: 11,
    displayName: "Epílogo · El Gran Crupier",
    chipBonus: 250,
    spawns: [
      { enemyId: "elite", count: 2, spawnIntervalMs: 1200 },
      { enemyId: "armored", count: 4, spawnIntervalMs: 1600, startDelayMs: 3000 },
      { enemyId: "shielded", count: 4, spawnIntervalMs: 1400, startDelayMs: 6000 },
      { enemyId: "wisp", count: 5, spawnIntervalMs: 800, startDelayMs: 9000 },
      { enemyId: "runner", count: 10, spawnIntervalMs: 350, startDelayMs: 12000 },
      { enemyId: "elite", count: 2, spawnIntervalMs: 1, startDelayMs: 16000 },
      { enemyId: "dealer", count: 1, spawnIntervalMs: 1, startDelayMs: 20000 },
    ],
  },
];
