import type { WaveModifierCatalog, WaveModifierDefinition, WaveModifierId } from "@/types";

/**
 * Tracks which modifier is active for the upcoming wave, and exposes
 * multipliers that EnemyManager / TowerManager / ChipManager consult at
 * runtime.
 *
 * Convention:
 *   - `null` active modifier means vanilla gameplay (all multipliers = 1).
 *   - `clear()` resets after a wave completes so the next one starts fresh
 *     unless a new modifier is accepted.
 */
export class WaveModifierManager {
  private readonly catalog: WaveModifierCatalog;
  private active: WaveModifierDefinition | null = null;
  private readonly listeners = new Set<(mod: WaveModifierDefinition | null) => void>();

  public constructor(catalog: WaveModifierCatalog) {
    this.catalog = catalog;
  }

  public get activeModifier(): WaveModifierDefinition | null {
    return this.active;
  }

  public apply(id: WaveModifierId): WaveModifierDefinition | null {
    const def = this.catalog[id];
    if (!def) return null;
    this.active = def;
    this.emit();
    return def;
  }

  public clear(): void {
    if (!this.active) return;
    this.active = null;
    this.emit();
  }

  public onChange(cb: (mod: WaveModifierDefinition | null) => void): () => void {
    this.listeners.add(cb);
    cb(this.active);
    return () => this.listeners.delete(cb);
  }

  // --- Query API consumed by managers ------------------------------------

  public enemyHpMult(): number {
    return this.active?.effects.enemyHpMult ?? 1;
  }

  public enemySpeedMult(): number {
    return this.active?.effects.enemySpeedMult ?? 1;
  }

  public chipRewardMult(): number {
    return this.active?.effects.chipRewardMult ?? 1;
  }

  public towerDamageMult(): number {
    return this.active?.effects.towerDamageMult ?? 1;
  }

  public towerFireRateMult(): number {
    return this.active?.effects.towerFireRateMult ?? 1;
  }

  public extraEnemiesPerGroup(): number {
    return this.active?.effects.extraEnemiesPerGroup ?? 0;
  }

  public pickOffering(
    rng: () => number = Math.random,
    count = 3,
    opts: { rareBias?: number } = {},
  ): WaveModifierDefinition[] {
    // Return `count` distinct modifiers biased toward commons but always
    // including at least one rare when possible. `rareBias` raises the chance
    // a second rare replaces one of the commons (used by Amuleto del Crupier).
    const rareBias = Math.max(0, opts.rareBias ?? 0);
    const all = Object.values(this.catalog);
    const commons = all.filter((m) => m.rarity === "common");
    const rares = all.filter((m) => m.rarity === "rare");
    const pickRandom = <T,>(pool: T[]): T => pool[Math.floor(rng() * pool.length)];

    const picked: WaveModifierDefinition[] = [];
    const seen = new Set<WaveModifierId>();

    // First: one rare if available
    if (rares.length > 0) {
      const rare = pickRandom(rares);
      picked.push(rare);
      seen.add(rare.id);

      // Optional: a second rare under bias — but only if another rare exists.
      const secondRarePool = rares.filter((m) => !seen.has(m.id));
      if (secondRarePool.length > 0 && rng() < rareBias / (1 + rareBias)) {
        const second = pickRandom(secondRarePool);
        picked.push(second);
        seen.add(second.id);
      }
    }

    // Remaining commons until count reached
    const commonPool = commons.filter((m) => !seen.has(m.id));
    while (picked.length < count && commonPool.length > 0) {
      const idx = Math.floor(rng() * commonPool.length);
      const [mod] = commonPool.splice(idx, 1);
      picked.push(mod);
      seen.add(mod.id);
    }

    // Fallback: any remaining
    const rest = all.filter((m) => !seen.has(m.id));
    while (picked.length < count && rest.length > 0) {
      const idx = Math.floor(rng() * rest.length);
      const [mod] = rest.splice(idx, 1);
      picked.push(mod);
      seen.add(mod.id);
    }

    return picked;
  }

  private emit(): void {
    for (const cb of this.listeners) cb(this.active);
  }
}
