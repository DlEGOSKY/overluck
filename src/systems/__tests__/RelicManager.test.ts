import { describe, it, expect, vi } from "vitest";
import { RelicManager } from "../RelicManager";
import type { RelicCatalog } from "@/types";

const CATALOG: RelicCatalog = {
  loaded_chip: {
    id: "loaded_chip",
    displayName: "Ficha Trucada",
    description: "+20 % fichas",
    color: 0xffd700,
    effects: [{ kind: "chip_reward_multiplier", value: 0.2 }],
  },
  hot_hand: {
    id: "hot_hand",
    displayName: "Mano Caliente",
    description: "+5 % crit",
    color: 0xff4444,
    effects: [{ kind: "gambler_crit_bonus", value: 0.05 }],
  },
  steady_hand: {
    id: "steady_hand",
    displayName: "Mano Firme",
    description: "-10 % misfire",
    color: 0x44ff44,
    effects: [{ kind: "gambler_misfire_reduction", value: 0.10 }],
  },
  sparkplug: {
    id: "sparkplug",
    displayName: "Bujía",
    description: "+splash",
    color: 0x4488ff,
    effects: [{ kind: "shock_splash_bonus", value: 5 }],
  },
  greased_dice: {
    id: "greased_dice",
    displayName: "Dado Engrasado",
    description: "+rare modifier bias",
    color: 0x88ff44,
    effects: [{ kind: "rare_modifier_bias", value: 1.0 }],
  },
  amuleto_crupier: {
    id: "amuleto_crupier",
    displayName: "Amuleto del Crupier",
    description: "+10 fichas al limpiar wave",
    color: 0xcc44cc,
    effects: [{ kind: "wave_clear_chip_bonus", value: 10 }],
  },
  ficha_marcada: {
    id: "ficha_marcada",
    displayName: "Ficha Marcada",
    description: "+15 % fichas",
    color: 0xddaa00,
    effects: [{ kind: "chip_reward_multiplier", value: 0.15 }],
  },
  corona_casa: {
    id: "corona_casa",
    displayName: "Corona de la Casa",
    description: "+3 % crit, +5 fichas wave",
    color: 0xff88ff,
    effects: [
      { kind: "gambler_crit_bonus", value: 0.03 },
      { kind: "wave_clear_chip_bonus", value: 5 },
    ],
  },
  carta_muerte: {
    id: "carta_muerte",
    displayName: "Carta de Muerte",
    description: "Resucita 1 vez",
    color: 0x9c27b0,
    effects: [{ kind: "death_card", value: 1 }],
  },
};

describe("RelicManager", () => {
  it("starts with no relics", () => {
    const rm = new RelicManager(CATALOG);
    expect(rm.active).toHaveLength(0);
  });

  it("acquire() adds a relic and returns definition", () => {
    const rm = new RelicManager(CATALOG);
    const def = rm.acquire("loaded_chip");
    expect(def).not.toBeNull();
    expect(def!.id).toBe("loaded_chip");
    expect(rm.active).toHaveLength(1);
    expect(rm.has("loaded_chip")).toBe(true);
  });

  it("acquire() same relic twice returns null (no duplicate)", () => {
    const rm = new RelicManager(CATALOG);
    rm.acquire("hot_hand");
    expect(rm.acquire("hot_hand")).toBeNull();
    expect(rm.active).toHaveLength(1);
  });

  it("has() returns false for unowned relics", () => {
    const rm = new RelicManager(CATALOG);
    expect(rm.has("sparkplug")).toBe(false);
  });

  it("chipRewardMultiplier() stacks across multiple relics", () => {
    const rm = new RelicManager(CATALOG);
    expect(rm.chipRewardMultiplier()).toBe(1);
    rm.acquire("loaded_chip");
    expect(rm.chipRewardMultiplier()).toBeCloseTo(1.2);
    rm.acquire("ficha_marcada");
    expect(rm.chipRewardMultiplier()).toBeCloseTo(1.35);
  });

  it("gamblerCritBonus() sums correctly", () => {
    const rm = new RelicManager(CATALOG);
    rm.acquire("hot_hand");
    rm.acquire("corona_casa");
    expect(rm.gamblerCritBonus()).toBeCloseTo(0.08);
  });

  it("waveClearChipBonus() sums correctly", () => {
    const rm = new RelicManager(CATALOG);
    rm.acquire("amuleto_crupier");
    rm.acquire("corona_casa");
    expect(rm.waveClearChipBonus()).toBe(15);
  });

  it("onChange() fires on acquire", () => {
    const rm = new RelicManager(CATALOG);
    const fn = vi.fn();
    rm.onChange(fn);
    expect(fn).toHaveBeenCalledTimes(1); // immediate call

    rm.acquire("sparkplug");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("unsubscribe stops listener", () => {
    const rm = new RelicManager(CATALOG);
    const fn = vi.fn();
    const unsub = rm.onChange(fn);
    fn.mockClear();

    unsub();
    rm.acquire("hot_hand");
    expect(fn).not.toHaveBeenCalled();
  });
});
