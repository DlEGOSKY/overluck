import type { EnemyCatalog } from "@/types";

/**
 * Full enemy roster. Base stats are tuned around a 72 px/s walker; everything
 * else branches off that baseline. New kinds use the optional fields in
 * `EnemyDefinition` (shape, shield, damageReduction, trail, floats, etc.)
 * so the legacy Walker/Runner/Tank/Boss layouts still read as before.
 */
export const ENEMIES: EnemyCatalog = {
  // --- Classic roster --------------------------------------------------
  walker: {
    id: "walker",
    displayName: "Walker",
    maxHp: 32,
    speed: 72,
    damageToBase: 1,
    chipReward: 3,
    color: 0xc8c8d4,
    radius: 14,
    shape: "circle",
  },
  runner: {
    id: "runner",
    displayName: "Runner",
    maxHp: 20,
    speed: 140,
    damageToBase: 1,
    chipReward: 4,
    color: 0xff7a59,
    radius: 11,
    shape: "circle",
    trail: true,
  },
  tank: {
    id: "tank",
    displayName: "Tank",
    maxHp: 140,
    speed: 48,
    damageToBase: 3,
    chipReward: 12,
    color: 0x6a6f8a,
    radius: 19,
    shape: "circle",
  },

  // --- New enemies ------------------------------------------------------
  swarm: {
    id: "swarm",
    displayName: "Enjambre",
    maxHp: 10,
    speed: 160,
    damageToBase: 1,
    chipReward: 2,
    color: 0xf28b4a,
    radius: 8,
    shape: "triangle",
    trail: true,
  },
  shielded: {
    id: "shielded",
    displayName: "Escolta",
    maxHp: 55,
    speed: 62,
    damageToBase: 2,
    chipReward: 7,
    color: 0x6fa3c8,
    radius: 14,
    shape: "circle",
    shieldHits: 1,
  },
  armored: {
    id: "armored",
    displayName: "Blindado",
    maxHp: 60,
    speed: 58,
    damageToBase: 2,
    chipReward: 8,
    color: 0x8a8f6f,
    radius: 15,
    shape: "plate",
    damageReduction: 3,
  },
  wisp: {
    id: "wisp",
    displayName: "Espectro",
    maxHp: 28,
    speed: 110,
    damageToBase: 1,
    chipReward: 6,
    color: 0x78e2d0,
    radius: 10,
    shape: "wisp",
    floats: true,
    ignoresSplash: true,
  },
  elite: {
    id: "elite",
    displayName: "Mano de Oro",
    maxHp: 260,
    speed: 54,
    damageToBase: 4,
    chipReward: 28,
    color: 0xd4a24c,
    radius: 20,
    shape: "diamond",
    eliteAura: true,
    damageReduction: 1,
  },

  // --- Boss (reworked with phases + abilities) --------------------------
  boss: {
    id: "boss",
    displayName: "Crupier Mayor",
    maxHp: 900,
    speed: 40,
    damageToBase: 10,
    chipReward: 120,
    color: 0xc04090,
    radius: 28,
    shape: "boss",
    eliteAura: true,
    fullscreenHpBar: true,
    phases: [
      {
        label: "FASE I · ENTRA EN MESA",
        hpStart: 1,
        color: 0xc04090,
        flavor: "La banca abre la noche.",
      },
      {
        label: "FASE II · EL CRUPIER SE IMPACIENTA",
        hpStart: 0.66,
        color: 0xffb454,
        flavor: "Llama refuerzos. Las apuestas suben.",
      },
      {
        label: "FASE III · LA CASA NO PIERDE",
        hpStart: 0.33,
        color: 0xff5c6c,
        flavor: "Acelera. Ya no hay reglas.",
      },
    ],
    abilities: [
      {
        kind: "summon",
        hpTrigger: 0.66,
        summonId: "swarm",
        summonCount: 4,
      },
      {
        kind: "shieldPulse",
        hpTrigger: 0.5,
        durationMs: 2600,
      },
      {
        kind: "speedBoost",
        hpTrigger: 0.33,
        speedMult: 1.55,
      },
    ],
  },

  // --- Dealer Boss (casino mechanics against the player) ----------------
  dealer: {
    id: "dealer",
    displayName: "El Gran Crupier",
    maxHp: 1600,
    speed: 32,
    damageToBase: 15,
    chipReward: 250,
    color: 0xffd700,
    radius: 32,
    shape: "boss",
    eliteAura: true,
    fullscreenHpBar: true,
    shieldHits: 2,
    damageReduction: 2,
    phases: [
      {
        label: "FASE I · REPARTE LA MANO",
        hpStart: 1,
        color: 0xffd700,
        flavor: "Las cartas caen. La banca juega primero.",
      },
      {
        label: "FASE II · MESA CALIENTE",
        hpStart: 0.65,
        color: 0xff8c00,
        flavor: "La casa sube la apuesta. Tus fichas desaparecen.",
      },
      {
        label: "FASE III · ALL IN",
        hpStart: 0.35,
        color: 0xdc143c,
        flavor: "Sin reglas. Sin piedad. Todo o nada.",
      },
    ],
    abilities: [
      {
        kind: "chipDrain",
        hpTrigger: 0.70,
        chipDrainFraction: 0.20,
      },
      {
        kind: "summon",
        hpTrigger: 0.60,
        summonId: "elite",
        summonCount: 2,
      },
      {
        kind: "towerJam",
        hpTrigger: 0.50,
        jamDurationMs: 3500,
      },
      {
        kind: "shieldPulse",
        hpTrigger: 0.40,
        durationMs: 3000,
      },
      {
        kind: "houseEdge",
        hpTrigger: 0.35,
        critPenalty: 0.15,
      },
      {
        kind: "summon",
        hpTrigger: 0.25,
        summonId: "shielded",
        summonCount: 3,
      },
      {
        kind: "speedBoost",
        hpTrigger: 0.15,
        speedMult: 1.70,
      },
    ],
  },
};
