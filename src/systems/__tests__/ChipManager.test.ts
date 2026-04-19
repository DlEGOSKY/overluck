import { describe, it, expect, vi } from "vitest";
import { ChipManager } from "../ChipManager";

describe("ChipManager", () => {
  it("starts with initial chips", () => {
    const cm = new ChipManager(100);
    expect(cm.value).toBe(100);
  });

  it("add() increases chips", () => {
    const cm = new ChipManager(50);
    cm.add(30);
    expect(cm.value).toBe(80);
  });

  it("add(0) and add(negative) are no-ops", () => {
    const cm = new ChipManager(50);
    cm.add(0);
    cm.add(-10);
    expect(cm.value).toBe(50);
  });

  it("canAfford() checks correctly", () => {
    const cm = new ChipManager(20);
    expect(cm.canAfford(20)).toBe(true);
    expect(cm.canAfford(21)).toBe(false);
    expect(cm.canAfford(0)).toBe(true);
  });

  it("spend() deducts and returns true when affordable", () => {
    const cm = new ChipManager(50);
    expect(cm.spend(30)).toBe(true);
    expect(cm.value).toBe(20);
  });

  it("spend() returns false and does not deduct when unaffordable", () => {
    const cm = new ChipManager(10);
    expect(cm.spend(20)).toBe(false);
    expect(cm.value).toBe(10);
  });

  it("onChange() fires immediately with current value and on each mutation", () => {
    const cm = new ChipManager(100);
    const fn = vi.fn();
    cm.onChange(fn);
    expect(fn).toHaveBeenCalledWith(100);

    cm.add(10);
    expect(fn).toHaveBeenCalledWith(110);

    cm.spend(5);
    expect(fn).toHaveBeenCalledWith(105);
  });

  it("unsubscribe stops further notifications", () => {
    const cm = new ChipManager(100);
    const fn = vi.fn();
    const unsub = cm.onChange(fn);
    fn.mockClear();

    unsub();
    cm.add(50);
    expect(fn).not.toHaveBeenCalled();
  });
});
