import type { EnemyStatOverrides } from "@/entities/Enemy";
import type { EnemyManager } from "./EnemyManager";
import type { WaveDefinition, WaveList } from "@/types";

export type WaveStatus = "idle" | "spawning" | "clearing" | "completed";

export interface WaveManagerEvents {
  onWaveStart: (wave: WaveDefinition) => void;
  onWaveCleared: (wave: WaveDefinition) => void;
  onAllWavesCleared: () => void;
}

export interface WaveSpawnModifiers {
  getOverrides: () => EnemyStatOverrides;
  extraEnemiesPerGroup: () => number;
}

interface ScheduledSpawn {
  enemyId: WaveDefinition["spawns"][number]["enemyId"];
  dueAt: number;
}

export class WaveManager {
  private readonly waves: WaveList;
  private readonly enemies: EnemyManager;
  private readonly events: WaveManagerEvents;
  private modifiers: WaveSpawnModifiers | null = null;

  private currentIndex = -1;
  private status: WaveStatus = "idle";
  private elapsedMs = 0;
  private schedule: ScheduledSpawn[] = [];

  public constructor(waves: WaveList, enemies: EnemyManager, events: WaveManagerEvents) {
    this.waves = waves;
    this.enemies = enemies;
    this.events = events;
  }

  public setModifiers(modifiers: WaveSpawnModifiers): void {
    this.modifiers = modifiers;
  }

  public getStatus(): WaveStatus {
    return this.status;
  }

  public getCurrentWave(): WaveDefinition | null {
    if (this.currentIndex < 0 || this.currentIndex >= this.waves.length) return null;
    return this.waves[this.currentIndex];
  }

  public getCurrentIndex(): number {
    return Math.max(0, this.currentIndex);
  }

  public getTotalWaves(): number {
    return this.waves.length;
  }

  public canStartNext(): boolean {
    return (
      (this.status === "idle" || this.status === "completed") &&
      this.currentIndex + 1 < this.waves.length
    );
  }

  public startNext(spawnDelayMs = 1800): boolean {
    if (!this.canStartNext()) return false;
    this.currentIndex += 1;
    const wave = this.waves[this.currentIndex];
    // Offset elapsed so first spawn occurs after the countdown finishes.
    this.elapsedMs = -spawnDelayMs;
    this.schedule = this.buildSchedule(wave);
    this.status = "spawning";
    this.events.onWaveStart(wave);
    return true;
  }

  public update(deltaMs: number): void {
    if (this.status === "idle" || this.status === "completed") return;

    if (this.status === "spawning") {
      this.elapsedMs += deltaMs;
      while (this.schedule.length > 0 && this.schedule[0].dueAt <= this.elapsedMs) {
        const next = this.schedule.shift();
        if (next) {
          const overrides = this.modifiers?.getOverrides() ?? {};
          this.enemies.spawn(next.enemyId, overrides);
        }
      }
      if (this.schedule.length === 0) {
        this.status = "clearing";
      }
    }

    if (this.status === "clearing" && this.enemies.activeCount() === 0) {
      const wave = this.waves[this.currentIndex];
      this.events.onWaveCleared(wave);
      if (this.currentIndex + 1 >= this.waves.length) {
        this.status = "completed";
        this.events.onAllWavesCleared();
      } else {
        this.status = "idle";
      }
    }
  }

  private buildSchedule(wave: WaveDefinition): ScheduledSpawn[] {
    const scheduled: ScheduledSpawn[] = [];
    const extraPerGroup = this.modifiers?.extraEnemiesPerGroup() ?? 0;
    for (const group of wave.spawns) {
      const start = group.startDelayMs ?? 0;
      // Boss groups don't get extra adds - keep the encounter authored.
      const count = group.enemyId === "boss" ? group.count : group.count + extraPerGroup;
      for (let i = 0; i < count; i += 1) {
        scheduled.push({
          enemyId: group.enemyId,
          dueAt: start + i * group.spawnIntervalMs,
        });
      }
    }
    scheduled.sort((a, b) => a.dueAt - b.dueAt);
    return scheduled;
  }
}
