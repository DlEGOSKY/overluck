import { storage } from "./StorageManager";
import { UNLOCKS } from "@/data/unlocks";
import type { UnlockDefinition, UnlockId } from "@/types";

/**
 * Evaluates unlock conditions against the persistent profile. Emits one event
 * per unlock the first time it becomes true so the UI can celebrate it.
 *
 * The manager trusts the profile as the source of truth: once an id is in
 * `profile.unlocks`, the check is skipped forever (even if stats regress).
 */
export interface UnlockEvents {
  onUnlocked: (def: UnlockDefinition) => void;
}

export class UnlockManager {
  private readonly catalog: readonly UnlockDefinition[];
  private readonly events: UnlockEvents;

  public constructor(events: UnlockEvents, catalog: readonly UnlockDefinition[] = UNLOCKS) {
    this.catalog = catalog;
    this.events = events;
  }

  public isUnlocked(id: UnlockId): boolean {
    const profile = storage.load();
    return profile.unlocks.includes(id);
  }

  public getAll(): readonly UnlockDefinition[] {
    return this.catalog;
  }

  public getUnlocked(): UnlockDefinition[] {
    const profile = storage.load();
    return this.catalog.filter((u) => profile.unlocks.includes(u.id));
  }

  public getPending(): UnlockDefinition[] {
    const profile = storage.load();
    return this.catalog.filter((u) => !profile.unlocks.includes(u.id));
  }

  /**
   * Run condition checks and emit onUnlocked for anything that newly passes.
   * Safe to call many times — already-unlocked ids are skipped.
   */
  public check(): UnlockDefinition[] {
    const profile = storage.load();
    const newly: UnlockDefinition[] = [];
    for (const def of this.catalog) {
      if (profile.unlocks.includes(def.id)) continue;
      if (!def.check(profile)) continue;
      storage.update((p) => {
        if (!p.unlocks.includes(def.id)) p.unlocks.push(def.id);
      });
      newly.push(def);
      this.events.onUnlocked(def);
    }
    if (newly.length > 0) storage.flushNow();
    return newly;
  }
}
