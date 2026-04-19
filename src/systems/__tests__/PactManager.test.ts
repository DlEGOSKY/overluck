import { describe, it, expect } from "vitest";
import { PactManager } from "../PactManager";
import { PACTS } from "@/data/pacts";
import { makeDefaultProfile } from "@/types";

describe("PactManager", () => {
  it("returns zero bonuses with a fresh profile", () => {
    const pm = new PactManager(PACTS, makeDefaultProfile());
    expect(pm.extraChips()).toBe(0);
    expect(pm.extraBaseHp()).toBe(0);
    expect(pm.towerFireRateMult()).toBe(1);
    expect(pm.chipRewardMult()).toBe(0);
    expect(pm.critBonus()).toBe(0);
  });

  it("getLevel returns 0 for un-purchased pacts", () => {
    const pm = new PactManager(PACTS, makeDefaultProfile());
    expect(pm.getLevel("lucky_start")).toBe(0);
  });

  it("canUpgrade returns true when gems are sufficient", () => {
    const pm = new PactManager(PACTS, makeDefaultProfile());
    const cost = PACTS.lucky_start.costs[0]; // 3
    expect(pm.canUpgrade("lucky_start", cost)).toBe(true);
    expect(pm.canUpgrade("lucky_start", cost - 1)).toBe(false);
  });

  it("upgrade() spends cost and increments level", () => {
    const pm = new PactManager(PACTS, makeDefaultProfile());
    const cost = PACTS.lucky_start.costs[0]; // 3
    const spent = pm.upgrade("lucky_start", cost);
    expect(spent).toBe(cost);
    expect(pm.getLevel("lucky_start")).toBe(1);
  });

  it("upgrade() returns 0 when not enough gems", () => {
    const pm = new PactManager(PACTS, makeDefaultProfile());
    expect(pm.upgrade("lucky_start", 0)).toBe(0);
    expect(pm.getLevel("lucky_start")).toBe(0);
  });

  it("upgrade() respects maxLevel", () => {
    const profile = makeDefaultProfile();
    profile.pacts = { lucky_start: 3 }; // max
    const pm = new PactManager(PACTS, profile);
    expect(pm.canUpgrade("lucky_start", 999)).toBe(false);
    expect(pm.upgrade("lucky_start", 999)).toBe(0);
  });

  it("extraChips stacks with level", () => {
    const profile = makeDefaultProfile();
    profile.pacts = { lucky_start: 2 };
    const pm = new PactManager(PACTS, profile);
    expect(pm.extraChips()).toBe(20); // 2 * 10
  });

  it("towerFireRateMult decreases with quick_draw levels", () => {
    const profile = makeDefaultProfile();
    profile.pacts = { quick_draw: 3 };
    const pm = new PactManager(PACTS, profile);
    expect(pm.towerFireRateMult()).toBeCloseTo(0.91); // 1 - 3*0.03
  });

  it("critBonus stacks from croupier_eye", () => {
    const profile = makeDefaultProfile();
    profile.pacts = { croupier_eye: 2 };
    const pm = new PactManager(PACTS, profile);
    expect(pm.critBonus()).toBeCloseTo(0.04); // 2 * 0.02
  });

  it("snapshot() returns current levels", () => {
    const profile = makeDefaultProfile();
    profile.pacts = { lucky_start: 1, iron_base: 2 };
    const pm = new PactManager(PACTS, profile);
    pm.upgrade("lucky_start", 100); // level 1 → 2
    const snap = pm.snapshot();
    expect(snap.lucky_start).toBe(2);
    expect(snap.iron_base).toBe(2);
  });
});
