import Phaser from "phaser";
import type { Tower } from "@/entities/Tower";
import type { TowerId } from "@/types";
import { palette } from "@/ui/theme";

/**
 * Adjacency-based tower combos. A synergy activates for a tower when it has
 * another tower within `ADJACENCY_RADIUS`. Multiple synergies stack
 * multiplicatively.
 *
 * Design goals:
 *  - No new dependencies. Just geometric checks every time towers change.
 *  - Cheap: recomputed only on place/sell/move, not every frame.
 *  - Transparent: each tower exposes its active labels so UI/codex can show
 *    them.
 */

const ADJACENCY_RADIUS = 140;

export type SynergyId =
  | "conduit_boost"      // conduit near X -> +15% fire rate to X
  | "gambler_edge"       // gambler + blaster -> +10% crit
  | "focused_barrel"     // sniper + conduit -> +20% range
  | "chain_reaction"     // shock + shock -> +15% damage
  | "double_down"        // same type adjacency -> +5% damage
  | "crossfire";         // blaster + sniper -> +8% fire rate on both

export interface SynergyDefinition {
  id: SynergyId;
  label: string;
  description: string;
  pair: readonly [TowerId, TowerId] | "same" | "has_conduit";
  effects: {
    damageMult?: number;
    rangeMult?: number;
    fireRateMult?: number; // <1 means faster (cooldown is multiplied)
    critBonus?: number;
  };
}

export const SYNERGIES: readonly SynergyDefinition[] = [
  {
    id: "conduit_boost",
    label: "CONDUCTO",
    description: "Conducto adyacente acelera disparo ·15%.",
    pair: "has_conduit",
    effects: { fireRateMult: 0.85 },
  },
  {
    id: "gambler_edge",
    label: "APUESTA DOBLE",
    description: "Gambler + Blaster: +10% crit.",
    pair: ["gambler", "blaster"],
    effects: { critBonus: 0.10 },
  },
  {
    id: "focused_barrel",
    label: "MIRA FOCAL",
    description: "Sniper + Conducto: +20% rango.",
    pair: ["sniper", "conduit"],
    effects: { rangeMult: 1.20 },
  },
  {
    id: "chain_reaction",
    label: "CADENA",
    description: "Shock + Shock: +15% daño.",
    pair: ["shock", "shock"],
    effects: { damageMult: 1.15 },
  },
  {
    id: "crossfire",
    label: "FUEGO CRUZADO",
    description: "Blaster + Sniper: +8% cadencia.",
    pair: ["blaster", "sniper"],
    effects: { fireRateMult: 0.92 },
  },
  {
    id: "double_down",
    label: "DOUBLE DOWN",
    description: "Dos torres iguales cerca: +5% daño.",
    pair: "same",
    effects: { damageMult: 1.05 },
  },
];

// Per-tower cached synergy state.
interface TowerSynergyState {
  active: SynergyId[];
  damageMult: number;
  rangeMult: number;
  fireRateMult: number;
  critBonus: number;
  ring?: Phaser.GameObjects.Graphics;
}

export class SynergyManager {
  private readonly scene: Phaser.Scene;
  private state = new WeakMap<Tower, TowerSynergyState>();
  private changeHandler: (() => void) | null = null;
  private globalCritOffset = 0;

  public constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public onChange(cb: () => void): void {
    this.changeHandler = cb;
  }

  /** Apply a global crit offset (negative = penalty from boss). */
  public setGlobalCritOffset(offset: number): void {
    this.globalCritOffset = offset;
  }

  /** Attach lazy providers so a Tower reads its current synergy multipliers. */
  public bind(tower: Tower): void {
    tower.setSynergyProviders({
      damageMult: () => this.stateOf(tower).damageMult,
      rangeMult: () => this.stateOf(tower).rangeMult,
      fireRateMult: () => this.stateOf(tower).fireRateMult,
      critBonus: () => this.stateOf(tower).critBonus + this.globalCritOffset,
    });
  }

  public unbind(tower: Tower): void {
    const s = this.state.get(tower);
    if (s?.ring) s.ring.destroy();
    this.state.delete(tower);
  }

  /** Recompute synergies across all currently placed towers. */
  public recompute(towers: readonly Tower[]): void {
    for (const t of towers) {
      this.state.set(t, this.blank());
    }

    for (let i = 0; i < towers.length; i += 1) {
      for (let j = i + 1; j < towers.length; j += 1) {
        const a = towers[i];
        const b = towers[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        if (Math.hypot(dx, dy) > ADJACENCY_RADIUS) continue;

        for (const syn of SYNERGIES) {
          const match = matchPair(syn, a, b);
          if (!match) continue;
          this.apply(match.left, syn);
          if (match.right) this.apply(match.right, syn);
        }
      }
    }

    for (const t of towers) this.redrawBadge(t);
    this.changeHandler?.();
  }

  public getActive(tower: Tower): readonly SynergyId[] {
    return this.stateOf(tower).active;
  }

  public getActiveLabels(tower: Tower): string[] {
    const ids = this.getActive(tower);
    return ids.map((id) => SYNERGIES.find((s) => s.id === id)?.label ?? id);
  }

  // --- Internals --------------------------------------------------------

  private blank(): TowerSynergyState {
    return {
      active: [],
      damageMult: 1,
      rangeMult: 1,
      fireRateMult: 1,
      critBonus: 0,
    };
  }

  private stateOf(tower: Tower): TowerSynergyState {
    let s = this.state.get(tower);
    if (!s) {
      s = this.blank();
      this.state.set(tower, s);
    }
    return s;
  }

  private apply(tower: Tower, syn: SynergyDefinition): void {
    const s = this.stateOf(tower);
    if (s.active.includes(syn.id)) return;
    s.active.push(syn.id);
    if (syn.effects.damageMult) s.damageMult *= syn.effects.damageMult;
    if (syn.effects.rangeMult) s.rangeMult *= syn.effects.rangeMult;
    if (syn.effects.fireRateMult) s.fireRateMult *= syn.effects.fireRateMult;
    if (syn.effects.critBonus) s.critBonus += syn.effects.critBonus;
  }

  private redrawBadge(tower: Tower): void {
    const s = this.stateOf(tower);
    if (s.ring) { s.ring.destroy(); s.ring = undefined; }
    if (s.active.length === 0) return;

    // Small gold indicator ring around the tower base.
    const ring = this.scene.add.graphics();
    ring.setDepth(6.5);
    ring.lineStyle(2, palette.gold, 0.85);
    const r = tower.definition.baseRadius + 10;
    const dashCount = Math.min(s.active.length + 2, 6);
    const step = (Math.PI * 2) / dashCount;
    for (let i = 0; i < dashCount; i += 1) {
      const start = i * step;
      ring.beginPath();
      ring.arc(tower.x, tower.y, r, start + 0.05, start + step - 0.25, false);
      ring.strokePath();
    }
    s.ring = ring;

    this.scene.tweens.add({
      targets: ring,
      alpha: { from: 0.4, to: 0.9 },
      yoyo: true,
      repeat: -1,
      duration: 1400,
      ease: "Sine.InOut",
    });
  }
}

// ---------------------------------------------------------------------------
// Pair matching
// ---------------------------------------------------------------------------

interface MatchResult {
  left: Tower;
  right?: Tower;
}

function matchPair(syn: SynergyDefinition, a: Tower, b: Tower): MatchResult | null {
  const idA = a.definition.id as TowerId;
  const idB = b.definition.id as TowerId;

  if (syn.pair === "same") {
    return idA === idB ? { left: a, right: b } : null;
  }
  if (syn.pair === "has_conduit") {
    if (idA === "conduit" && idB !== "conduit") return { left: b };
    if (idB === "conduit" && idA !== "conduit") return { left: a };
    return null;
  }
  const [p1, p2] = syn.pair;
  if (idA === p1 && idB === p2) return { left: a, right: b };
  if (idA === p2 && idB === p1) return { left: a, right: b };
  return null;
}
