import type { RelicManager } from "./RelicManager";
import { storage } from "./StorageManager";
import type { RelicPayload, RewardOffer, RewardTemplate } from "@/types";

export interface RewardFactoryDeps {
  templates: readonly RewardTemplate[];
  relics: RelicManager;
  random?: () => number;
}

export class RewardFactory {
  private readonly templates: readonly RewardTemplate[];
  private readonly relics: RelicManager;
  private readonly random: () => number;

  public constructor(deps: RewardFactoryDeps) {
    this.templates = deps.templates;
    this.relics = deps.relics;
    this.random = deps.random ?? Math.random;
  }

  public roll(count: number): RewardOffer[] {
    const pool = this.filterAvailable(this.templates);
    const offers: RewardOffer[] = [];
    const used = new Set<RewardTemplate>();

    for (let i = 0; i < count; i += 1) {
      const remaining = pool.filter((t) => !used.has(t));
      if (remaining.length === 0) break;
      const pick = this.weightedPick(remaining);
      used.add(pick);
      offers.push({
        id: `${pick.kind}-${i}-${Math.floor(this.random() * 1e6)}`,
        template: pick,
      });
    }

    return offers;
  }

  private filterAvailable(templates: readonly RewardTemplate[]): RewardTemplate[] {
    const unlocks = storage.load().unlocks;
    return templates.filter((t) => {
      // Hide templates locked behind an unlock the player hasn't earned yet.
      if (t.requiresUnlock && !unlocks.includes(t.requiresUnlock)) return false;
      if (t.kind !== "relic") return true;
      const payload = t.payload as RelicPayload;
      return !this.relics.has(payload.relicId);
    });
  }

  private weightedPick(templates: readonly RewardTemplate[]): RewardTemplate {
    const totalWeight = templates.reduce((sum, t) => sum + t.weight, 0);
    let roll = this.random() * totalWeight;
    for (const t of templates) {
      roll -= t.weight;
      if (roll <= 0) return t;
    }
    return templates[templates.length - 1];
  }
}
