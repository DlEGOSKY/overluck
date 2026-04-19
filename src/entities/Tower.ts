import Phaser from "phaser";
import type { FireOutcome, TowerDefinition, TowerSlot, TowerRoll, TowerSplash, TowerUpgrade } from "@/types";
import type { Enemy } from "./Enemy";
import type { RelicManager } from "@/systems/RelicManager";
import { audio } from "@/systems/AudioManager";
import { dur, ease, palette } from "@/ui/theme";

export interface FireEvent {
  target: Enemy;
  damage: number;
  outcome: FireOutcome;
}

export interface TowerStats {
  damage: number;
  range: number;
  fireRateMs: number;
  projectileSpeed: number;
  roll?: TowerRoll;
  splash?: TowerSplash;
}

export class Tower {
  public readonly definition: TowerDefinition;
  public slot: TowerSlot;

  private readonly scene: Phaser.Scene;
  private readonly base: Phaser.GameObjects.Arc;
  private readonly barrel: Phaser.GameObjects.Rectangle;
  private readonly muzzle: Phaser.GameObjects.Arc;
  private readonly rangeRing: Phaser.GameObjects.Arc;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly visuals: Phaser.GameObjects.Container;
  private readonly tierDecor: Phaser.GameObjects.Graphics;
  private readonly relics: RelicManager | null;
  private readonly random: () => number;

  private cooldownMs = 0;
  private currentTarget: Enemy | null = null;
  private barrelAngle = 0;
  private tier = 0;
  private currentDamage: number;
  private currentRange: number;
  private currentFireRateMs: number;
  private currentProjectileSpeed: number;
  private currentRoll?: TowerRoll;
  private currentSplash?: TowerSplash;
  private fireRateMultiplier: () => number = () => 1;
  private synergyDamageMult: () => number = () => 1;
  private synergyRangeMult: () => number = () => 1;
  private synergyFireRateMult: () => number = () => 1;
  private synergyCritBonus: () => number = () => 0;

  public constructor(
    scene: Phaser.Scene,
    slot: TowerSlot,
    definition: TowerDefinition,
    relics: RelicManager | null = null,
    random: () => number = Math.random,
  ) {
    this.scene = scene;
    this.slot = slot;
    this.definition = definition;
    this.relics = relics;
    this.random = random;

    this.currentDamage = definition.damage;
    this.currentRange = definition.range;
    this.currentFireRateMs = definition.fireRateMs;
    this.currentProjectileSpeed = definition.projectileSpeed;
    this.currentRoll = definition.roll;
    this.currentSplash = definition.splash;

    // Range ring (only visible on hover / selection)
    this.rangeRing = scene.add.circle(slot.x, slot.y, definition.range, definition.color, 0.06);
    this.rangeRing.setStrokeStyle(1, definition.color, 0.3);
    this.rangeRing.setDepth(1);
    this.rangeRing.setVisible(false);

    // Shadow (separate from container so it stays flat on ground)
    this.shadow = scene.add.ellipse(
      slot.x,
      slot.y + definition.baseRadius * 0.55,
      definition.baseRadius * 1.9,
      definition.baseRadius * 0.6,
      0x000000,
      0.45,
    );
    this.shadow.setDepth(5);

    // Outer plate (gold rim)
    const outerPlate = scene.add.circle(0, 0, definition.baseRadius + 6, palette.bgDeep, 1);
    outerPlate.setStrokeStyle(1, palette.goldDeep, 0.7);

    // Inner surface
    const innerPlate = scene.add.circle(0, 0, definition.baseRadius + 3, palette.surface, 1);
    innerPlate.setStrokeStyle(1, definition.color, 0.35);

    // Base ring colored
    this.base = scene.add.circle(0, 0, definition.baseRadius, palette.surfaceElevated);
    this.base.setStrokeStyle(2, definition.color, 1);

    // Accent dashes around base ring
    const dashes = scene.add.graphics();
    dashes.lineStyle(2, definition.color, 0.8);
    for (let i = 0; i < 8; i += 1) {
      const a = (Math.PI / 4) * i;
      const r1 = definition.baseRadius - 2;
      const r2 = definition.baseRadius + 2;
      dashes.beginPath();
      dashes.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
      dashes.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
      dashes.strokePath();
    }

    // Barrel (rotates toward target)
    this.barrel = scene.add.rectangle(0, 0, definition.baseRadius + 6, 6, definition.color);
    this.barrel.setOrigin(0, 0.5);
    this.barrel.setStrokeStyle(1, palette.bgDeep, 0.6);

    // Top detail by tower type
    const topDetail = this.buildTopDetail(scene, definition);

    // Central LED
    const led = scene.add.circle(0, 0, 3.5, 0xffffff, 1);
    scene.tweens.add({
      targets: led,
      alpha: { from: 1, to: 0.3 },
      yoyo: true,
      repeat: -1,
      duration: 750,
      ease: "Sine.InOut",
    });

    // Muzzle flash
    this.muzzle = scene.add.circle(definition.baseRadius + 6, 0, 5, 0xffffff, 1);
    this.muzzle.setVisible(false);

    // Tier decor layer (drawn on top of the tower, under the barrel)
    this.tierDecor = scene.add.graphics();

    this.visuals = scene.add.container(slot.x, slot.y, [
      outerPlate,
      innerPlate,
      dashes,
      this.base,
      this.tierDecor,
      this.barrel,
      topDetail,
      led,
      this.muzzle,
    ]);
    this.visuals.setDepth(6);

    this.redrawTierDecor();
  }

  // --- Public tier API ---------------------------------------------------

  public getTier(): number {
    return this.tier;
  }

  public getTierLabel(): string {
    if (this.tier === 0) return "MK I";
    const up = this.definition.upgrades?.[this.tier - 1];
    return up?.tierLabel ?? `MK ${this.tier + 1}`;
  }

  public getStats(): TowerStats {
    return {
      damage: this.currentDamage,
      range: this.currentRange,
      fireRateMs: this.currentFireRateMs,
      projectileSpeed: this.currentProjectileSpeed,
      roll: this.currentRoll,
      splash: this.currentSplash,
    };
  }

  public getNextUpgrade(): TowerUpgrade | null {
    return this.definition.upgrades?.[this.tier] ?? null;
  }

  public canUpgrade(): boolean {
    return this.getNextUpgrade() !== null;
  }

  /** Chips invested so far: base cost + every applied upgrade cost. */
  public getInvestedChips(): number {
    let total = this.definition.cost;
    const ups = this.definition.upgrades ?? [];
    for (let i = 0; i < this.tier && i < ups.length; i += 1) {
      total += ups[i].cost;
    }
    return total;
  }

  public setFireRateMultiplier(fn: () => number): void {
    this.fireRateMultiplier = fn;
  }

  public setSynergyProviders(fns: {
    damageMult?: () => number;
    rangeMult?: () => number;
    fireRateMult?: () => number;
    critBonus?: () => number;
  }): void {
    if (fns.damageMult) this.synergyDamageMult = fns.damageMult;
    if (fns.rangeMult) this.synergyRangeMult = fns.rangeMult;
    if (fns.fireRateMult) this.synergyFireRateMult = fns.fireRateMult;
    if (fns.critBonus) this.synergyCritBonus = fns.critBonus;
  }

  /** Effective range (base × synergy multiplier). */
  public getEffectiveRange(): number {
    return this.currentRange * this.synergyRangeMult();
  }

  /** Force a cooldown on this tower (boss "jam" ability). */
  public jam(durationMs: number): void {
    this.cooldownMs = Math.max(this.cooldownMs, durationMs);
  }

  public applyUpgrade(): boolean {
    const next = this.getNextUpgrade();
    if (!next) return false;

    this.tier += 1;
    if (next.damage !== undefined) this.currentDamage = next.damage;
    if (next.range !== undefined) this.currentRange = next.range;
    if (next.fireRateMs !== undefined) this.currentFireRateMs = next.fireRateMs;
    if (next.projectileSpeed !== undefined) this.currentProjectileSpeed = next.projectileSpeed;
    if (next.roll) this.currentRoll = next.roll;
    if (next.splash) this.currentSplash = next.splash;

    this.rangeRing.setRadius(this.currentRange);
    this.redrawTierDecor();
    this.playUpgradeBurst();
    audio.playUpgrade();
    return true;
  }

  private redrawTierDecor(): void {
    const g = this.tierDecor;
    g.clear();
    if (this.tier === 0) return;

    const r = this.definition.baseRadius;
    const gold = palette.gold;
    const goldDeep = palette.goldDeep;

    // Tier 1: single gold outer ring + two pips at top
    g.lineStyle(1, gold, 0.85);
    g.strokeCircle(0, 0, r + 8);

    // Ornamental pips around the ring
    const pipCount = this.tier === 1 ? 4 : 6;
    g.fillStyle(gold, 1);
    for (let i = 0; i < pipCount; i += 1) {
      const a = (Math.PI * 2 * i) / pipCount - Math.PI / 2;
      g.fillCircle(Math.cos(a) * (r + 8), Math.sin(a) * (r + 8), 1.8);
    }

    if (this.tier >= 2) {
      // Tier 2: add a second outer ring and a crown on top
      g.lineStyle(1, goldDeep, 0.7);
      g.strokeCircle(0, 0, r + 12);

      // Crown: 3 ascending triangles above the tower
      g.fillStyle(gold, 1);
      const crownY = -r - 10;
      for (let i = -1; i <= 1; i += 1) {
        const h = i === 0 ? 6 : 4;
        g.beginPath();
        g.moveTo(i * 4 - 2, crownY);
        g.lineTo(i * 4 + 2, crownY);
        g.lineTo(i * 4, crownY - h);
        g.closePath();
        g.fillPath();
      }
    }
  }

  private playUpgradeBurst(): void {
    // Expanding golden ring in world space
    const ring = this.scene.add.circle(this.slot.x, this.slot.y, this.definition.baseRadius + 10, 0x000000, 0);
    ring.setStrokeStyle(2, palette.gold, 1);
    ring.setDepth(14);
    this.scene.tweens.add({
      targets: ring,
      scale: { from: 1, to: 2.4 },
      alpha: { from: 1, to: 0 },
      duration: 520,
      ease: ease.out,
      onComplete: () => ring.destroy(),
    });

    // Tower pop
    this.scene.tweens.add({
      targets: this.visuals,
      scale: { from: 1.15, to: 1 },
      duration: dur.base,
      ease: ease.snap,
    });

    // Sparkle particles
    for (let i = 0; i < 8; i += 1) {
      const angle = (Math.PI * 2 * i) / 8 + this.random() * 0.3;
      const dist = this.definition.baseRadius + 14 + this.random() * 16;
      const spark = this.scene.add.circle(this.slot.x, this.slot.y, 2, palette.gold, 1);
      spark.setDepth(14);
      this.scene.tweens.add({
        targets: spark,
        x: this.slot.x + Math.cos(angle) * dist,
        y: this.slot.y + Math.sin(angle) * dist,
        alpha: { from: 1, to: 0 },
        duration: 520,
        ease: ease.out,
        onComplete: () => spark.destroy(),
      });
    }
  }

  private buildTopDetail(
    scene: Phaser.Scene,
    definition: TowerDefinition,
  ): Phaser.GameObjects.Container {
    const container = scene.add.container(0, 0);

    if (definition.id === "blaster") {
      // Two small side vents
      const vent1 = scene.add.rectangle(-definition.baseRadius * 0.45, -definition.baseRadius * 0.5, 4, 4, definition.color, 0.85);
      const vent2 = scene.add.rectangle(definition.baseRadius * 0.45, -definition.baseRadius * 0.5, 4, 4, definition.color, 0.85);
      container.add([vent1, vent2]);
    } else if (definition.id === "gambler") {
      // Casino chip on top rotating
      const chip = scene.add.circle(0, -definition.baseRadius * 0.15, definition.baseRadius * 0.4, palette.primary, 1);
      chip.setStrokeStyle(1, palette.goldDeep, 1);
      const chipDot = scene.add.circle(0, -definition.baseRadius * 0.15, definition.baseRadius * 0.16, palette.bgDeep, 1);
      scene.tweens.add({
        targets: chip,
        scale: { from: 0.9, to: 1.05 },
        yoyo: true,
        repeat: -1,
        duration: 1400,
        ease: "Sine.InOut",
      });
      container.add([chip, chipDot]);
    } else if (definition.id === "shock") {
      // Small lightning arcs around the top
      const coil = scene.add.graphics();
      coil.lineStyle(1.5, definition.color, 0.85);
      for (let i = 0; i < 3; i += 1) {
        const a = (Math.PI * 2 * i) / 3 - Math.PI / 2;
        const r = definition.baseRadius * 0.55;
        coil.beginPath();
        coil.moveTo(Math.cos(a) * (r - 3), Math.sin(a) * (r - 3));
        coil.lineTo(Math.cos(a) * (r + 3), Math.sin(a) * (r + 3));
        coil.strokePath();
      }
      const nucleus = scene.add.circle(0, 0, definition.baseRadius * 0.25, definition.color, 0.6);
      scene.tweens.add({
        targets: nucleus,
        scale: { from: 0.9, to: 1.3 },
        alpha: { from: 0.6, to: 0.2 },
        yoyo: true,
        repeat: -1,
        duration: 900,
        ease: "Sine.InOut",
      });
      container.add([coil, nucleus]);
    }

    return container;
  }

  public get rootVisuals(): Phaser.GameObjects.Container {
    return this.visuals;
  }

  /** Relocate visuals + interactable positions to a new slot. */
  public moveTo(newSlot: TowerSlot): void {
    this.slot = newSlot;
    this.visuals.setPosition(newSlot.x, newSlot.y);
    this.rangeRing.setPosition(newSlot.x, newSlot.y);
    this.shadow.setPosition(newSlot.x, newSlot.y + this.definition.baseRadius * 0.55);
  }

  public get x(): number {
    return this.slot.x;
  }

  public get y(): number {
    return this.slot.y;
  }

  public setRangeVisible(visible: boolean): void {
    this.rangeRing.setVisible(visible);
  }

  public update(deltaMs: number, enemies: readonly Enemy[]): FireEvent | null {
    this.cooldownMs = Math.max(0, this.cooldownMs - deltaMs);

    if (!this.currentTarget || !this.currentTarget.isAlive() || !this.isInRange(this.currentTarget)) {
      this.currentTarget = this.acquireTarget(enemies);
    }

    if (this.currentTarget) {
      this.aimAt(this.currentTarget);
      if (this.cooldownMs <= 0) {
        this.cooldownMs = this.currentFireRateMs * this.fireRateMultiplier() * this.synergyFireRateMult();
        const shot = this.rollShot(this.currentTarget);
        this.flashMuzzle(shot.outcome);
        return shot;
      }
    }

    return null;
  }

  private rollShot(target: Enemy): FireEvent {
    const dmgMult = this.synergyDamageMult();
    const baseDamage = Math.max(1, Math.round(this.currentDamage * dmgMult));
    const roll = this.currentRoll;
    if (!roll) {
      return { target, damage: baseDamage, outcome: "normal" };
    }

    const critBonus = (this.relics?.gamblerCritBonus() ?? 0) + this.synergyCritBonus();
    const misfireReduction = this.relics?.gamblerMisfireReduction() ?? 0;
    const critChance = Math.min(0.95, roll.critChance + critBonus);
    const misfireChance = Math.max(0, roll.misfireChance - misfireReduction);

    const dice = this.random();
    if (dice < critChance) {
      return {
        target,
        damage: Math.round(baseDamage * roll.critMultiplier),
        outcome: "crit",
      };
    }
    if (dice < critChance + misfireChance) {
      return {
        target,
        damage: Math.max(1, Math.round(baseDamage * roll.misfireMultiplier)),
        outcome: "misfire",
      };
    }
    return { target, damage: baseDamage, outcome: "normal" };
  }

  private flashMuzzle(outcome: FireOutcome): void {
    audio.playFire(outcome);

    // Muzzle glow (stays in barrel-local space via container)
    const isCrit = outcome === "crit";
    const isMiss = outcome === "misfire";
    const flashColor = isCrit ? palette.primary : isMiss ? palette.danger : 0xffffff;

    this.muzzle.setFillStyle(flashColor, 1);
    this.muzzle.setVisible(true);
    this.muzzle.setScale(isCrit ? 2.2 : 1.8);
    this.muzzle.setAlpha(1);
    this.scene.tweens.add({
      targets: this.muzzle,
      scale: 0.5,
      alpha: 0,
      duration: isCrit ? 180 : 140,
      ease: "Quad.Out",
      onComplete: () => this.muzzle.setVisible(false),
    });

    // Barrel kickback (recoil)
    this.scene.tweens.add({
      targets: this.barrel,
      scaleX: { from: 0.78, to: 1 },
      duration: 140,
      ease: "Quad.Out",
    });

    // World-space muzzle sparks and concussion ring
    const muzzleX = this.slot.x + Math.cos(this.barrelAngle) * (this.definition.baseRadius + 10);
    const muzzleY = this.slot.y + Math.sin(this.barrelAngle) * (this.definition.baseRadius + 10);

    // Concussion halo
    const halo = this.scene.add.circle(muzzleX, muzzleY, 8, flashColor, 0.45);
    halo.setDepth(15);
    this.scene.tweens.add({
      targets: halo,
      scale: { from: 0.6, to: isCrit ? 2.4 : 1.6 },
      alpha: { from: 0.6, to: 0 },
      duration: 220,
      ease: "Quad.Out",
      onComplete: () => halo.destroy(),
    });

    // Directional sparks in a cone
    const sparkCount = isCrit ? 6 : isMiss ? 2 : 4;
    const coneSpread = isCrit ? 0.35 : 0.25;
    for (let i = 0; i < sparkCount; i += 1) {
      const jitter = (this.random() - 0.5) * 2 * coneSpread;
      const sparkAngle = this.barrelAngle + jitter;
      const dist = 18 + this.random() * (isCrit ? 24 : 14);
      const spark = this.scene.add.circle(muzzleX, muzzleY, 1.6, flashColor, 1);
      spark.setDepth(15);
      this.scene.tweens.add({
        targets: spark,
        x: muzzleX + Math.cos(sparkAngle) * dist,
        y: muzzleY + Math.sin(sparkAngle) * dist,
        alpha: { from: 1, to: 0 },
        duration: 220 + this.random() * 120,
        ease: "Quad.Out",
        onComplete: () => spark.destroy(),
      });
    }
  }

  public destroy(): void {
    this.visuals.destroy();
    this.rangeRing.destroy();
    this.shadow.destroy();
  }

  private acquireTarget(enemies: readonly Enemy[]): Enemy | null {
    let closest: Enemy | null = null;
    let closestDist = Number.POSITIVE_INFINITY;
    for (const enemy of enemies) {
      if (!enemy.isAlive()) continue;
      const dx = enemy.x - this.slot.x;
      const dy = enemy.y - this.slot.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= this.getEffectiveRange() && dist < closestDist) {
        closest = enemy;
        closestDist = dist;
      }
    }
    return closest;
  }

  private isInRange(enemy: Enemy): boolean {
    const dx = enemy.x - this.slot.x;
    const dy = enemy.y - this.slot.y;
    return Math.hypot(dx, dy) <= this.getEffectiveRange();
  }

  private aimAt(enemy: Enemy): void {
    const targetAngle = Phaser.Math.Angle.Between(this.slot.x, this.slot.y, enemy.x, enemy.y);
    // Smoothly interpolate barrel rotation toward the target (lerp on shortest path)
    this.barrelAngle = Phaser.Math.Angle.RotateTo(this.barrelAngle, targetAngle, 0.35);
    this.barrel.rotation = this.barrelAngle;
    this.muzzle.x = Math.cos(this.barrelAngle) * (this.definition.baseRadius + 6);
    this.muzzle.y = Math.sin(this.barrelAngle) * (this.definition.baseRadius + 6);
  }
}
