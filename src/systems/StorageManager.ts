import {
  makeDefaultProfile,
  PROFILE_SCHEMA_VERSION,
  PROFILE_STORAGE_KEY,
} from "@/types";
import type { ProfileData } from "@/types";

/**
 * Thin wrapper over `localStorage` that loads/migrates/persists the player
 * profile. Never throws: any parse/read failure falls back to a default
 * profile so the game keeps running even on corrupted saves.
 *
 * The singleton is intentionally stateless except for an in-memory cache
 * which is flushed on every `save()`. `flush()` is also debounced to avoid
 * hammering localStorage during rapid stat updates.
 */

const FLUSH_DEBOUNCE_MS = 250;

export class StorageManager {
  private static instance: StorageManager | null = null;

  public static get(): StorageManager {
    if (!StorageManager.instance) StorageManager.instance = new StorageManager();
    return StorageManager.instance;
  }

  private cached: ProfileData | null = null;
  private flushTimer: number | null = null;

  private constructor() {}

  public load(): ProfileData {
    if (this.cached) return this.cached;
    this.cached = this.readFromDisk();
    return this.cached;
  }

  public save(next: ProfileData): void {
    this.cached = next;
    this.scheduleFlush();
  }

  public update(mutator: (profile: ProfileData) => void): ProfileData {
    const current = this.load();
    mutator(current);
    this.save(current);
    return current;
  }

  public reset(): ProfileData {
    this.cached = makeDefaultProfile();
    this.writeNow(this.cached);
    return this.cached;
  }

  public flushNow(): void {
    if (!this.cached) return;
    if (this.flushTimer !== null) {
      window.clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.writeNow(this.cached);
  }

  // --- Internals --------------------------------------------------------

  private scheduleFlush(): void {
    if (this.flushTimer !== null) window.clearTimeout(this.flushTimer);
    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = null;
      if (this.cached) this.writeNow(this.cached);
    }, FLUSH_DEBOUNCE_MS);
  }

  private writeNow(profile: ProfileData): void {
    try {
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Quota / private-mode — silently drop. Game continues with in-memory state.
    }
  }

  private readFromDisk(): ProfileData {
    try {
      const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
      if (!raw) return makeDefaultProfile();
      const parsed = JSON.parse(raw) as Partial<ProfileData>;
      return this.migrate(parsed);
    } catch {
      return makeDefaultProfile();
    }
  }

  /**
   * Forward-compatible merge of a possibly-older saved profile into the
   * current default shape. New fields fill in from defaults; unknown legacy
   * fields are preserved under the current key when present.
   */
  private migrate(saved: Partial<ProfileData>): ProfileData {
    const base = makeDefaultProfile();
    const merged: ProfileData = {
      ...base,
      ...saved,
      schemaVersion: PROFILE_SCHEMA_VERSION,
      killsByEnemyType: { ...base.killsByEnemyType, ...(saved.killsByEnemyType ?? {}) },
      towersPlacedByType: { ...base.towersPlacedByType, ...(saved.towersPlacedByType ?? {}) },
      modifiersByRarity: { ...base.modifiersByRarity, ...(saved.modifiersByRarity ?? {}) },
      modifiersById: { ...base.modifiersById, ...(saved.modifiersById ?? {}) },
      relicsAcquired: { ...base.relicsAcquired, ...(saved.relicsAcquired ?? {}) },
      unlocks: Array.isArray(saved.unlocks) ? [...saved.unlocks] : [],
      achievements: Array.isArray(saved.achievements) ? [...saved.achievements] : [],
      recentRuns: Array.isArray(saved.recentRuns) ? saved.recentRuns.slice(-10) : [],
      settings: { ...base.settings, ...(saved.settings ?? {}) },
    };
    return merged;
  }
}

// Convenience singleton (matches the pattern used by `audio` / `theme`).
export const storage = StorageManager.get();
