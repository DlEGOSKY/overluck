import { describe, it, expect } from "vitest";
import { Rng, dailySeed, seedFromString } from "../Rng";

describe("Rng", () => {
  it("produces deterministic sequences from the same seed", () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("produces values in [0, 1)", () => {
    const r = new Rng(999);
    for (let i = 0; i < 500; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("different seeds produce different sequences", () => {
    const a = new Rng(1);
    const b = new Rng(2);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it("int() returns values within bounds", () => {
    const r = new Rng(123);
    for (let i = 0; i < 200; i++) {
      const v = r.int(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("chance(0) always false, chance(1) always true", () => {
    const r = new Rng(77);
    for (let i = 0; i < 50; i++) {
      expect(r.chance(0)).toBe(false);
      expect(r.chance(1)).toBe(true);
    }
  });

  it("pick() returns elements from the array", () => {
    const r = new Rng(55);
    const pool = ["a", "b", "c"];
    for (let i = 0; i < 50; i++) {
      expect(pool).toContain(r.pick(pool));
    }
  });

  it("shuffle() returns same array reference with same elements", () => {
    const r = new Rng(10);
    const arr = [1, 2, 3, 4, 5];
    const ref = r.shuffle(arr);
    expect(ref).toBe(arr);
    expect(arr.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("seed() resets the sequence", () => {
    const r = new Rng(42);
    const first = r.next();
    r.seed(42);
    expect(r.next()).toBe(first);
  });

  it("weightedPick respects weights", () => {
    const r = new Rng(1);
    const items = ["rare", "common"];
    const weights = [0, 100];
    for (let i = 0; i < 50; i++) {
      expect(r.weightedPick(items, weights)).toBe("common");
    }
  });
});

describe("dailySeed", () => {
  it("returns a positive 32-bit integer", () => {
    const s = dailySeed();
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(0xffffffff);
    expect(Number.isInteger(s)).toBe(true);
  });

  it("is deterministic within the same call context", () => {
    expect(dailySeed()).toBe(dailySeed());
  });
});

describe("seedFromString", () => {
  it("produces same seed for same string", () => {
    expect(seedFromString("hello")).toBe(seedFromString("hello"));
  });

  it("different strings produce different seeds", () => {
    expect(seedFromString("abc")).not.toBe(seedFromString("xyz"));
  });

  it("returns a positive 32-bit integer", () => {
    const s = seedFromString("test");
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(0xffffffff);
  });
});
