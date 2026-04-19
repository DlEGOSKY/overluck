import type { RelicCatalog, RelicDefinition, RelicId } from "@/types";

export class RelicManager {
  private readonly catalog: RelicCatalog;
  private readonly owned: RelicDefinition[] = [];
  private readonly listeners = new Set<(relics: readonly RelicDefinition[]) => void>();

  public constructor(catalog: RelicCatalog) {
    this.catalog = catalog;
  }

  public get active(): readonly RelicDefinition[] {
    return this.owned;
  }

  public has(id: RelicId): boolean {
    return this.owned.some((r) => r.id === id);
  }

  public acquire(id: RelicId): RelicDefinition | null {
    if (this.has(id)) return null;
    const def = this.catalog[id];
    this.owned.push(def);
    this.emit();
    return def;
  }

  public onChange(listener: (relics: readonly RelicDefinition[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.owned);
    return () => this.listeners.delete(listener);
  }

  public chipRewardMultiplier(): number {
    return 1 + this.sumEffect("chip_reward_multiplier");
  }

  public gamblerCritBonus(): number {
    return this.sumEffect("gambler_crit_bonus");
  }

  public gamblerMisfireReduction(): number {
    return this.sumEffect("gambler_misfire_reduction");
  }

  public shockSplashBonus(): number {
    return this.sumEffect("shock_splash_bonus");
  }

  /** +N rare weight multiplier (e.g. 1.0 = double rare odds). */
  public rareModifierBias(): number {
    return this.sumEffect("rare_modifier_bias");
  }

  /** Flat chips granted when a wave is cleared. */
  public waveClearChipBonus(): number {
    return this.sumEffect("wave_clear_chip_bonus");
  }

  /** Number of death cards granted by relics (resurrection uses). */
  public deathCardCount(): number {
    return this.sumEffect("death_card");
  }

  private sumEffect(kind: string): number {
    let total = 0;
    for (const relic of this.owned) {
      for (const effect of relic.effects) {
        if (effect.kind === kind) total += effect.value;
      }
    }
    return total;
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.owned);
  }
}
