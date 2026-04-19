import { storage } from "./StorageManager";
import type {
  EnemyId,
  ProfileData,
  RelicId,
  RunHistoryEntry,
  TowerId,
  WaveModifierDefinition,
} from "@/types";

/**
 * Collects per-run stats in memory and periodically flushes to persistent
 * storage. At the end of a run, `finalizeRun()` writes a history entry and
 * updates lifetime records.
 *
 * All methods are safe to call even if the schema is older — storage's
 * migrate step guarantees every field exists with a sane default.
 */

export interface RunSnapshot {
  startedAtMs: number;
  chipsEarned: number;
  kills: number;
  killsByEnemyType: Partial<Record<EnemyId, number>>;
  towersPlaced: number;
  towersPlacedByType: Partial<Record<TowerId, number>>;
  upgradesApplied: number;
  modifiersAccepted: number;
  modifiersSkipped: number;
  relicsAcquired: number;
  waveReached: number;
  waveCleared: number;
  slotsPlayed: number;
  roulettePlayed: number;
  cardsPlayed: number;
  chipsLostInSlots: number;
}

function emptyRun(startedAtMs: number): RunSnapshot {
  return {
    startedAtMs,
    chipsEarned: 0,
    kills: 0,
    killsByEnemyType: {},
    towersPlaced: 0,
    towersPlacedByType: {},
    upgradesApplied: 0,
    modifiersAccepted: 0,
    modifiersSkipped: 0,
    relicsAcquired: 0,
    waveReached: 0,
    waveCleared: 0,
    slotsPlayed: 0,
    roulettePlayed: 0,
    cardsPlayed: 0,
    chipsLostInSlots: 0,
  };
}

export class StatsRecorder {
  private run: RunSnapshot = emptyRun(0);
  private runActive = false;

  public getProfile(): ProfileData {
    return storage.load();
  }

  public getRun(): Readonly<RunSnapshot> {
    return this.run;
  }

  public startRun(nowMs: number): void {
    this.run = emptyRun(nowMs);
    this.runActive = true;
    storage.update((p) => {
      p.runsPlayed += 1;
    });
  }

  // --- Event hooks ------------------------------------------------------

  public onEnemyKilled(id: EnemyId, chipsGained: number): void {
    if (!this.runActive) return;
    this.run.kills += 1;
    this.run.killsByEnemyType[id] = (this.run.killsByEnemyType[id] ?? 0) + 1;
    this.run.chipsEarned += chipsGained;
    storage.update((p) => {
      p.totalKills += 1;
      p.killsByEnemyType[id] = (p.killsByEnemyType[id] ?? 0) + 1;
      p.totalChipsEarned += chipsGained;
    });
  }

  public onTowerPlaced(id: TowerId): void {
    if (!this.runActive) return;
    this.run.towersPlaced += 1;
    this.run.towersPlacedByType[id] = (this.run.towersPlacedByType[id] ?? 0) + 1;
    storage.update((p) => {
      p.towersPlaced += 1;
      p.towersPlacedByType[id] = (p.towersPlacedByType[id] ?? 0) + 1;
    });
  }

  public onTowerUpgraded(): void {
    if (!this.runActive) return;
    this.run.upgradesApplied += 1;
    storage.update((p) => {
      p.upgradesApplied += 1;
    });
  }

  public onModifierAccepted(mod: WaveModifierDefinition): void {
    if (!this.runActive) return;
    this.run.modifiersAccepted += 1;
    storage.update((p) => {
      p.modifiersAccepted += 1;
      p.modifiersByRarity[mod.rarity] = (p.modifiersByRarity[mod.rarity] ?? 0) + 1;
      p.modifiersById[mod.id] = (p.modifiersById[mod.id] ?? 0) + 1;
    });
  }

  public onModifierSkipped(): void {
    if (!this.runActive) return;
    this.run.modifiersSkipped += 1;
    storage.update((p) => {
      p.modifiersSkipped += 1;
    });
  }

  public onRelicAcquired(id: RelicId): void {
    if (!this.runActive) return;
    this.run.relicsAcquired += 1;
    storage.update((p) => {
      p.relicsAcquired[id] = (p.relicsAcquired[id] ?? 0) + 1;
    });
  }

  public onWaveReached(index: number): void {
    if (!this.runActive) return;
    this.run.waveReached = Math.max(this.run.waveReached, index);
    storage.update((p) => {
      p.highestWaveReached = Math.max(p.highestWaveReached, index);
    });
  }

  public onWaveCleared(index: number): void {
    if (!this.runActive) return;
    this.run.waveCleared = Math.max(this.run.waveCleared, index);
    storage.update((p) => {
      p.highestWaveCleared = Math.max(p.highestWaveCleared, index);
    });
  }

  public onSlotPlayed(lossChips = 0): void {
    if (!this.runActive) return;
    this.run.slotsPlayed += 1;
    this.run.chipsLostInSlots += Math.max(0, lossChips);
    storage.update((p) => {
      p.slotsPlayed += 1;
      p.chipsLostInSlots += Math.max(0, lossChips);
    });
  }

  public onRoulettePlayed(): void {
    if (!this.runActive) return;
    this.run.roulettePlayed += 1;
    storage.update((p) => {
      p.roulettePlayed += 1;
    });
  }

  public onCardsPlayed(): void {
    if (!this.runActive) return;
    this.run.cardsPlayed += 1;
    storage.update((p) => {
      p.cardsPlayed += 1;
    });
  }

  // --- Finalize ---------------------------------------------------------

  public finalizeRun(opts: { nowMs: number; won: boolean }): RunHistoryEntry {
    const duration = Math.max(0, opts.nowMs - this.run.startedAtMs);
    const entry: RunHistoryEntry = {
      startedAtMs: this.run.startedAtMs,
      endedAtMs: opts.nowMs,
      durationMs: duration,
      waveReached: this.run.waveReached,
      waveCleared: this.run.waveCleared,
      won: opts.won,
      chipsEarned: this.run.chipsEarned,
      kills: this.run.kills,
      modifiersAccepted: this.run.modifiersAccepted,
      modifiersSkipped: this.run.modifiersSkipped,
      relicsAcquired: this.run.relicsAcquired,
    };
    storage.update((p) => {
      if (opts.won) p.runsWon += 1;
      if (opts.won && (p.bestRunDurationMs === 0 || duration < p.bestRunDurationMs)) {
        p.bestRunDurationMs = duration;
      }
      p.recentRuns.push(entry);
      if (p.recentRuns.length > 10) p.recentRuns.splice(0, p.recentRuns.length - 10);
    });
    storage.flushNow();
    this.runActive = false;
    return entry;
  }
}

export const stats = new StatsRecorder();
