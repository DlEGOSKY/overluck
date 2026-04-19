import { ACHIEVEMENTS, type AchievementDefinition } from "@/data/achievements";
import { stats } from "./StatsRecorder";
import { storage } from "./StorageManager";

/**
 * Evaluates achievement predicates on demand. The host scene calls `check()`
 * after notable events (kills, wave clears, run finalize, casino plays). Newly
 * unlocked achievements are appended to the profile and forwarded via the
 * `onUnlocked` callback so the UI can surface a toast.
 *
 * Idempotent: a given achievement id is only awarded once per profile.
 */
export interface AchievementManagerOptions {
  onUnlocked: (def: AchievementDefinition) => void;
}

export class AchievementManager {
  private readonly opts: AchievementManagerOptions;

  public constructor(opts: AchievementManagerOptions) {
    this.opts = opts;
  }

  public check(): void {
    const profile = storage.load();
    const run = stats.getRun();
    const earned = new Set(profile.achievements);
    const newlyEarned: AchievementDefinition[] = [];

    for (const def of ACHIEVEMENTS) {
      if (earned.has(def.id)) continue;
      if (def.check(profile, run)) {
        newlyEarned.push(def);
      }
    }
    if (newlyEarned.length === 0) return;

    storage.update((p) => {
      for (const def of newlyEarned) {
        if (!p.achievements.includes(def.id)) p.achievements.push(def.id);
      }
    });
    storage.flushNow();

    for (const def of newlyEarned) {
      this.opts.onUnlocked(def);
    }
  }
}
