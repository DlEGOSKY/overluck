import Phaser from "phaser";
import type { Enemy } from "@/entities/Enemy";
import type {
  BossAbilityDefinition,
  BossPhaseDefinition,
  EnemyId,
} from "@/types";

/**
 * Watches a boss enemy each tick and triggers phase changes + abilities when
 * its HP ratio crosses the configured thresholds.
 *
 * The controller owns no visuals; it dispatches events that the GameScene
 * translates into overlay callouts, color grading, summoning, etc.
 */

export interface BossControllerEvents {
  onPhaseEnter: (phase: BossPhaseDefinition, index: number) => void;
  onSummon: (enemyId: EnemyId, count: number) => void;
  onShieldPulse: (durationMs: number) => void;
  onSpeedBoost: (mult: number) => void;
  onChipDrain: (fraction: number) => void;
  onTowerJam: (durationMs: number) => void;
  onHouseEdge: (critPenalty: number) => void;
  onBossDefeated: (boss: Enemy) => void;
  onBossEscaped: (boss: Enemy) => void;
}

interface BossSlot {
  boss: Enemy;
  phases: readonly BossPhaseDefinition[];
  abilities: readonly BossAbilityDefinition[];
  currentPhaseIndex: number;
  firedAbilityIds: Set<number>;
  wasAlive: boolean;
  wasBaseReached: boolean;
}

export class BossController {
  private readonly scene: Phaser.Scene;
  private readonly events: BossControllerEvents;
  private readonly slots: BossSlot[] = [];

  public constructor(scene: Phaser.Scene, events: BossControllerEvents) {
    this.scene = scene;
    this.events = events;
  }

  /** Call when the enemy manager spawns a new enemy. No-op if not a boss. */
  public register(enemy: Enemy): void {
    const def = enemy.definition;
    if (!def.phases || !def.abilities) return;

    const slot: BossSlot = {
      boss: enemy,
      phases: def.phases,
      abilities: def.abilities,
      currentPhaseIndex: 0,
      firedAbilityIds: new Set(),
      wasAlive: true,
      wasBaseReached: false,
    };
    this.slots.push(slot);

    // Fire phase 1 immediately so the callout appears on entrance.
    if (slot.phases.length > 0) {
      this.scene.time.delayedCall(400, () => {
        if (!enemy.isAlive()) return;
        this.events.onPhaseEnter(slot.phases[0], 0);
      });
    }
  }

  public update(_deltaMs: number): void {
    for (let i = this.slots.length - 1; i >= 0; i -= 1) {
      const slot = this.slots[i];
      const alive = slot.boss.isAlive();
      const reached = slot.boss.hasReachedBase();

      if (!alive) {
        if (slot.wasAlive) {
          slot.wasAlive = false;
          if (reached) this.events.onBossEscaped(slot.boss);
          else this.events.onBossDefeated(slot.boss);
        }
        this.slots.splice(i, 1);
        continue;
      }

      const ratio = slot.boss.getHpRatio();

      // Phase progression (ordered by hpStart descending).
      for (let p = slot.currentPhaseIndex + 1; p < slot.phases.length; p += 1) {
        const phase = slot.phases[p];
        if (ratio <= phase.hpStart) {
          slot.currentPhaseIndex = p;
          this.events.onPhaseEnter(phase, p);
          break;
        }
      }

      // Ability triggers (once each when HP dips below hpTrigger).
      slot.abilities.forEach((ability, idx) => {
        if (slot.firedAbilityIds.has(idx)) return;
        if (ratio > ability.hpTrigger) return;
        slot.firedAbilityIds.add(idx);
        this.fireAbility(slot, ability);
      });
    }
  }

  public clear(): void {
    this.slots.length = 0;
  }

  public hasActiveBoss(): boolean {
    return this.slots.some((s) => s.boss.isAlive() && s.boss.definition.fullscreenHpBar);
  }

  public getPrimaryBoss(): Enemy | null {
    const slot = this.slots.find((s) => s.boss.isAlive() && s.boss.definition.fullscreenHpBar);
    return slot?.boss ?? null;
  }

  public getPrimaryPhase(): BossPhaseDefinition | null {
    const slot = this.slots.find((s) => s.boss.isAlive() && s.boss.definition.fullscreenHpBar);
    if (!slot) return null;
    return slot.phases[slot.currentPhaseIndex] ?? null;
  }

  private fireAbility(slot: BossSlot, ability: BossAbilityDefinition): void {
    switch (ability.kind) {
      case "summon": {
        if (!ability.summonId || !ability.summonCount) break;
        this.events.onSummon(ability.summonId, ability.summonCount);
        break;
      }
      case "shieldPulse": {
        const dur = ability.durationMs ?? 2000;
        slot.boss.setInvulnerable(dur);
        this.events.onShieldPulse(dur);
        break;
      }
      case "speedBoost": {
        const mult = ability.speedMult ?? 1.25;
        slot.boss.multiplySpeed(mult);
        this.events.onSpeedBoost(mult);
        break;
      }
      case "chipDrain": {
        const frac = ability.chipDrainFraction ?? 0.15;
        this.events.onChipDrain(frac);
        break;
      }
      case "towerJam": {
        const dur = ability.jamDurationMs ?? 3000;
        this.events.onTowerJam(dur);
        break;
      }
      case "houseEdge": {
        const penalty = ability.critPenalty ?? 0.10;
        this.events.onHouseEdge(penalty);
        break;
      }
    }
  }
}
