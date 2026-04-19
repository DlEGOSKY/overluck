import { describe, it, expect, vi, beforeEach } from "vitest";
import { BossController, type BossControllerEvents } from "../BossController";
import type { Enemy } from "@/entities/Enemy";
import type { EnemyDefinition, BossPhaseDefinition, BossAbilityDefinition } from "@/types";

// Minimal mock enemy that satisfies what BossController reads.
function mockEnemy(opts: {
  hpRatio?: number;
  alive?: boolean;
  reached?: boolean;
  phases?: readonly BossPhaseDefinition[];
  abilities?: readonly BossAbilityDefinition[];
}): Enemy {
  const def: Partial<EnemyDefinition> = {
    id: "dealer",
    fullscreenHpBar: true,
    phases: opts.phases ?? [],
    abilities: opts.abilities ?? [],
  };
  return {
    definition: def as EnemyDefinition,
    isAlive: vi.fn(() => opts.alive ?? true),
    hasReachedBase: vi.fn(() => opts.reached ?? false),
    getHpRatio: vi.fn(() => opts.hpRatio ?? 1),
    setInvulnerable: vi.fn(),
    multiplySpeed: vi.fn(),
  } as unknown as Enemy;
}

function mockScene(): Phaser.Scene {
  return {
    time: {
      delayedCall: (_delay: number, cb: () => void) => { cb(); },
    },
  } as unknown as Phaser.Scene;
}

function allEvents(): BossControllerEvents {
  return {
    onPhaseEnter: vi.fn(),
    onSummon: vi.fn(),
    onShieldPulse: vi.fn(),
    onSpeedBoost: vi.fn(),
    onChipDrain: vi.fn(),
    onTowerJam: vi.fn(),
    onHouseEdge: vi.fn(),
    onBossDefeated: vi.fn(),
    onBossEscaped: vi.fn(),
  };
}

describe("BossController", () => {
  let scene: Phaser.Scene;
  let events: BossControllerEvents;
  let ctrl: BossController;

  beforeEach(() => {
    scene = mockScene();
    events = allEvents();
    ctrl = new BossController(scene, events);
  });

  it("ignores non-boss enemies (no phases/abilities)", () => {
    const enemy = mockEnemy({ phases: undefined, abilities: undefined });
    // Strip phases/abilities from definition so register is a no-op
    (enemy.definition as unknown as Record<string, unknown>).phases = undefined;
    (enemy.definition as unknown as Record<string, unknown>).abilities = undefined;
    ctrl.register(enemy);
    ctrl.update(16);
    expect(events.onPhaseEnter).not.toHaveBeenCalled();
  });

  it("fires phase enter on register for first phase", () => {
    const phases: BossPhaseDefinition[] = [
      { label: "PHASE 1", hpStart: 1, color: 0xff0000, flavor: "test" },
    ];
    const enemy = mockEnemy({ phases, abilities: [] });
    ctrl.register(enemy);
    expect(events.onPhaseEnter).toHaveBeenCalledWith(phases[0], 0);
  });

  it("advances phases as HP drops", () => {
    const phases: BossPhaseDefinition[] = [
      { label: "P1", hpStart: 1, color: 0xff0000, flavor: "a" },
      { label: "P2", hpStart: 0.5, color: 0x00ff00, flavor: "b" },
    ];
    const enemy = mockEnemy({ hpRatio: 0.4, phases, abilities: [] });
    ctrl.register(enemy);
    ctrl.update(16);
    expect(events.onPhaseEnter).toHaveBeenCalledWith(phases[1], 1);
  });

  it("fires chipDrain ability", () => {
    const abilities: BossAbilityDefinition[] = [
      { kind: "chipDrain", hpTrigger: 0.8, chipDrainFraction: 0.25 },
    ];
    const enemy = mockEnemy({ hpRatio: 0.7, phases: [], abilities });
    ctrl.register(enemy);
    ctrl.update(16);
    expect(events.onChipDrain).toHaveBeenCalledWith(0.25);
  });

  it("fires towerJam ability", () => {
    const abilities: BossAbilityDefinition[] = [
      { kind: "towerJam", hpTrigger: 0.5, jamDurationMs: 4000 },
    ];
    const enemy = mockEnemy({ hpRatio: 0.3, phases: [], abilities });
    ctrl.register(enemy);
    ctrl.update(16);
    expect(events.onTowerJam).toHaveBeenCalledWith(4000);
  });

  it("fires houseEdge ability", () => {
    const abilities: BossAbilityDefinition[] = [
      { kind: "houseEdge", hpTrigger: 0.4, critPenalty: 0.12 },
    ];
    const enemy = mockEnemy({ hpRatio: 0.35, phases: [], abilities });
    ctrl.register(enemy);
    ctrl.update(16);
    expect(events.onHouseEdge).toHaveBeenCalledWith(0.12);
  });

  it("fires shieldPulse ability and sets invulnerable on boss", () => {
    const abilities: BossAbilityDefinition[] = [
      { kind: "shieldPulse", hpTrigger: 0.6, durationMs: 2000 },
    ];
    const enemy = mockEnemy({ hpRatio: 0.5, phases: [], abilities });
    ctrl.register(enemy);
    ctrl.update(16);
    expect(events.onShieldPulse).toHaveBeenCalledWith(2000);
    expect(enemy.setInvulnerable).toHaveBeenCalledWith(2000);
  });

  it("fires summon ability", () => {
    const abilities: BossAbilityDefinition[] = [
      { kind: "summon", hpTrigger: 0.7, summonId: "swarm", summonCount: 3 },
    ];
    const enemy = mockEnemy({ hpRatio: 0.6, phases: [], abilities });
    ctrl.register(enemy);
    ctrl.update(16);
    expect(events.onSummon).toHaveBeenCalledWith("swarm", 3);
  });

  it("fires speedBoost ability and multiplies boss speed", () => {
    const abilities: BossAbilityDefinition[] = [
      { kind: "speedBoost", hpTrigger: 0.3, speedMult: 1.5 },
    ];
    const enemy = mockEnemy({ hpRatio: 0.2, phases: [], abilities });
    ctrl.register(enemy);
    ctrl.update(16);
    expect(events.onSpeedBoost).toHaveBeenCalledWith(1.5);
    expect(enemy.multiplySpeed).toHaveBeenCalledWith(1.5);
  });

  it("does not fire the same ability twice", () => {
    const abilities: BossAbilityDefinition[] = [
      { kind: "chipDrain", hpTrigger: 0.8, chipDrainFraction: 0.1 },
    ];
    const enemy = mockEnemy({ hpRatio: 0.5, phases: [], abilities });
    ctrl.register(enemy);
    ctrl.update(16);
    ctrl.update(16);
    ctrl.update(16);
    expect(events.onChipDrain).toHaveBeenCalledTimes(1);
  });

  it("fires onBossDefeated when boss dies", () => {
    const enemy = mockEnemy({ hpRatio: 0, phases: [], abilities: [] });
    ctrl.register(enemy);
    // Boss still "alive" on register; now simulate death
    (enemy.isAlive as ReturnType<typeof vi.fn>).mockReturnValue(false);
    ctrl.update(16);
    expect(events.onBossDefeated).toHaveBeenCalled();
  });

  it("fires onBossEscaped when boss reaches base", () => {
    const enemy = mockEnemy({ hpRatio: 0, phases: [], abilities: [] });
    ctrl.register(enemy);
    (enemy.isAlive as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (enemy.hasReachedBase as ReturnType<typeof vi.fn>).mockReturnValue(true);
    ctrl.update(16);
    expect(events.onBossEscaped).toHaveBeenCalled();
    expect(events.onBossDefeated).not.toHaveBeenCalled();
  });

  it("clear() removes all tracked bosses", () => {
    const enemy = mockEnemy({ hpRatio: 0.5, phases: [], abilities: [] });
    ctrl.register(enemy);
    ctrl.clear();
    expect(ctrl.hasActiveBoss()).toBe(false);
  });
});
