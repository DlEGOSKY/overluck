import type { PactCatalog, PactDefinition, PactId, ProfileData } from "@/types";

/**
 * Reads the player's purchased pact levels from the profile and exposes
 * cumulative bonuses that GameScene applies at the start of each run.
 * Also handles purchasing new pact levels by spending gems.
 */
export class PactManager {
  private readonly catalog: PactCatalog;
  private levels: Partial<Record<PactId, number>>;

  public constructor(catalog: PactCatalog, profile: ProfileData) {
    this.catalog = catalog;
    this.levels = { ...profile.pacts };
  }

  public getLevel(id: PactId): number {
    return this.levels[id] ?? 0;
  }

  public getDef(id: PactId): PactDefinition {
    return this.catalog[id];
  }

  public canUpgrade(id: PactId, gems: number): boolean {
    const def = this.catalog[id];
    const level = this.getLevel(id);
    if (level >= def.maxLevel) return false;
    return gems >= def.costs[level];
  }

  /** Buy one level. Returns gem cost spent, or 0 if not possible. */
  public upgrade(id: PactId, gems: number): number {
    if (!this.canUpgrade(id, gems)) return 0;
    const def = this.catalog[id];
    const level = this.getLevel(id);
    const cost = def.costs[level];
    this.levels[id] = level + 1;
    return cost;
  }

  /** Snapshot of all pact levels (for writing back to profile). */
  public snapshot(): Partial<Record<PactId, number>> {
    return { ...this.levels };
  }

  // --- Cumulative bonuses ------------------------------------------------

  public extraChips(): number {
    return this.sumEffect("extra_chips");
  }

  public extraBaseHp(): number {
    return this.sumEffect("extra_base_hp");
  }

  /** Returns multiplier (< 1 means faster). */
  public towerFireRateMult(): number {
    return 1 - this.sumEffect("tower_fire_rate_mult");
  }

  public chipRewardMult(): number {
    return this.sumEffect("chip_reward_mult");
  }

  public critBonus(): number {
    return this.sumEffect("crit_bonus");
  }

  private sumEffect(kind: string): number {
    let total = 0;
    for (const id of Object.keys(this.catalog) as PactId[]) {
      const def = this.catalog[id];
      if (def.effectKind !== kind) continue;
      total += this.getLevel(id) * def.effectPerLevel;
    }
    return total;
  }
}
