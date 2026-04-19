import Phaser from "phaser";
import type { EnemyDefinition, PathPoints } from "@/types";
import { audio } from "@/systems/AudioManager";
import { palette } from "@/ui/theme";

const HP_BAR_WIDTH = 30;
const HP_BAR_HEIGHT = 4;
const HP_BAR_OFFSET_Y = 18;
const BOSS_HP_BAR_WIDTH = 68;
const BOSS_HP_BAR_HEIGHT = 6;

export interface EnemyStatOverrides {
  hpMult?: number;
  speedMult?: number;
}

export type DamageResult = "killed" | "hit" | "shield" | "immune";

export class Enemy {
  public readonly definition: EnemyDefinition;
  public readonly sprite: Phaser.GameObjects.Arc;

  private readonly scene: Phaser.Scene;
  private readonly path: PathPoints;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly hpBarBg: Phaser.GameObjects.Rectangle;
  private readonly hpBarFill: Phaser.GameObjects.Rectangle;
  private readonly hpBarRim: Phaser.GameObjects.Rectangle;
  private readonly isBoss: boolean;
  private readonly hpBarWidth: number;
  private readonly hpBarHeight: number;
  private readonly auras: Phaser.GameObjects.Arc[] = [];
  private readonly crown: Phaser.GameObjects.Graphics | null;
  private readonly effectiveMaxHp: number;
  private effectiveSpeed: number;

  // Visual extras; all null when the enemy has the classic "circle" shape.
  private readonly decor: Phaser.GameObjects.Graphics | null;
  private readonly shieldRing: Phaser.GameObjects.Graphics | null;
  private readonly eliteHalo: Phaser.GameObjects.Arc | null;
  private readonly trailGfx: Phaser.GameObjects.Graphics | null;
  private readonly trailPoints: { x: number; y: number; age: number }[] = [];

  // Mutable mechanical state.
  private shieldHits: number;
  private readonly damageReduction: number;
  private invulnerableUntil = 0;
  private floatClock = 0;
  private spawnAnimProgress = 0;

  private hp: number;
  private pathIndex = 0;
  private alive = true;
  private reachedBase = false;

  public constructor(
    scene: Phaser.Scene,
    path: PathPoints,
    definition: EnemyDefinition,
    overrides: EnemyStatOverrides = {},
  ) {
    this.scene = scene;
    this.path = path;
    this.definition = definition;
    const hpMult = overrides.hpMult ?? 1;
    const speedMult = overrides.speedMult ?? 1;
    this.effectiveMaxHp = Math.max(1, Math.round(definition.maxHp * hpMult));
    this.effectiveSpeed = Math.max(1, definition.speed * speedMult);
    this.hp = this.effectiveMaxHp;
    this.isBoss = definition.id === "boss";
    this.hpBarWidth = this.isBoss ? BOSS_HP_BAR_WIDTH : HP_BAR_WIDTH;
    this.hpBarHeight = this.isBoss ? BOSS_HP_BAR_HEIGHT : HP_BAR_HEIGHT;

    this.shieldHits = definition.shieldHits ?? 0;
    this.damageReduction = definition.damageReduction ?? 0;

    const start = path[0];

    // Ground shadow
    this.shadow = scene.add.ellipse(
      start.x,
      start.y + definition.radius * 0.75,
      definition.radius * 2,
      definition.radius * 0.6,
      0x000000,
      0.4,
    );
    this.shadow.setDepth(9);

    this.sprite = scene.add.circle(start.x, start.y, definition.radius, definition.color);
    this.sprite.setStrokeStyle(2, palette.bgDeep, 1);
    this.sprite.setDepth(10);

    if (this.isBoss) {
      const aura = scene.add.circle(start.x, start.y, definition.radius + 10, definition.color, 0.25);
      aura.setDepth(9);
      this.auras.push(aura);
      scene.tweens.add({
        targets: aura,
        scale: { from: 1, to: 1.45 },
        alpha: { from: 0.25, to: 0.05 },
        yoyo: true,
        repeat: -1,
        duration: 900,
        ease: "Sine.InOut",
      });
      this.crown = scene.add.graphics();
      this.crown.setDepth(11);
      this.drawCrown(start.x, start.y);
    } else {
      this.crown = null;
    }

    // --- Shape-specific decoration layered on top of the base Arc.
    const shape = definition.shape ?? "circle";
    this.decor = shape === "circle" ? null : scene.add.graphics();
    if (this.decor) {
      this.decor.setDepth(11);
      this.drawDecor(start.x, start.y);
    }

    // --- Orbiting gold halo for elites / bosses.
    if (definition.eliteAura && !this.isBoss) {
      this.eliteHalo = scene.add.circle(start.x, start.y, definition.radius + 8, 0xffd166, 0);
      this.eliteHalo.setStrokeStyle(2, 0xffd166, 0.85);
      this.eliteHalo.setDepth(9);
      scene.tweens.add({
        targets: this.eliteHalo,
        scale: { from: 1, to: 1.25 },
        alpha: { from: 0.85, to: 0.25 },
        yoyo: true,
        repeat: -1,
        duration: 1100,
        ease: "Sine.InOut",
      });
    } else {
      this.eliteHalo = null;
    }

    // --- Shield ring for enemies with shieldHits > 0.
    if (this.shieldHits > 0) {
      this.shieldRing = scene.add.graphics();
      this.shieldRing.setDepth(11);
      this.drawShieldRing(start.x, start.y);
    } else {
      this.shieldRing = null;
    }

    // --- Motion trail (runner, swarm).
    if (definition.trail) {
      this.trailGfx = scene.add.graphics();
      this.trailGfx.setDepth(8);
    } else {
      this.trailGfx = null;
    }

    // HP bar rim (outer border for contrast against felt)
    this.hpBarRim = scene.add
      .rectangle(
        start.x,
        start.y - HP_BAR_OFFSET_Y,
        this.hpBarWidth + 2,
        this.hpBarHeight + 2,
        palette.bgDeep,
        0.9,
      )
      .setDepth(11);

    this.hpBarBg = scene.add
      .rectangle(start.x, start.y - HP_BAR_OFFSET_Y, this.hpBarWidth, this.hpBarHeight, palette.surface, 1)
      .setDepth(11);

    this.hpBarFill = scene.add
      .rectangle(start.x, start.y - HP_BAR_OFFSET_Y, this.hpBarWidth, this.hpBarHeight, palette.success)
      .setDepth(12);
    this.hpBarFill.setOrigin(0, 0.5);
    this.hpBarFill.x = start.x - this.hpBarWidth / 2;

    this.sprite.setScale(0.2);
    this.sprite.setAlpha(0);
    this.shadow.setAlpha(0);
    this.hpBarRim.setAlpha(0);
    this.hpBarBg.setAlpha(0);
    this.hpBarFill.setAlpha(0);
    scene.tweens.add({
      targets: this.sprite,
      scale: 1,
      alpha: 1,
      duration: 220,
      ease: "Back.Out",
    });
    scene.tweens.add({
      targets: this.shadow,
      alpha: 0.4,
      duration: 220,
      ease: "Quad.Out",
    });
    scene.tweens.add({
      targets: [this.hpBarRim, this.hpBarBg, this.hpBarFill],
      alpha: 1,
      duration: 260,
      delay: 80,
    });
  }

  public get x(): number {
    return this.sprite.x;
  }

  public get y(): number {
    return this.sprite.y;
  }

  public isAlive(): boolean {
    return this.alive;
  }

  public hasReachedBase(): boolean {
    return this.reachedBase;
  }

  public update(deltaMs: number): void {
    if (!this.alive) return;

    this.floatClock += deltaMs;
    this.spawnAnimProgress = Math.min(1, this.spawnAnimProgress + deltaMs / 260);

    const target = this.path[this.pathIndex + 1];
    if (!target) {
      this.reachedBase = true;
      this.alive = false;
      this.destroy();
      return;
    }

    const dx = target.x - this.sprite.x;
    const dy = target.y - this.sprite.y;
    const distance = Math.hypot(dx, dy);

    const step = (this.effectiveSpeed * deltaMs) / 1000;

    if (step >= distance) {
      this.sprite.x = target.x;
      this.sprite.y = target.y;
      this.pathIndex += 1;
    } else {
      this.sprite.x += (dx / distance) * step;
      this.sprite.y += (dy / distance) * step;
    }

    this.updateTrail(deltaMs);
    this.syncHpBar();
  }

  public applyDamage(amount: number): DamageResult {
    if (!this.alive) return "immune";
    if (this.scene.time.now < this.invulnerableUntil) {
      this.flashImmune();
      return "immune";
    }
    if (this.shieldHits > 0) {
      this.shieldHits -= 1;
      this.popShield();
      return "shield";
    }
    const dmg = Math.max(1, amount - this.damageReduction);
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.alive = false;
      this.playDeath();
      return "killed";
    }
    this.flashHit();
    this.syncHpBar();
    return "hit";
  }

  /**
   * Apply a hard invulnerability window (boss shield pulse ability).
   * While active, applyDamage returns "immune" and flashes a rejection ring.
   */
  public setInvulnerable(durationMs: number): void {
    this.invulnerableUntil = this.scene.time.now + durationMs;
  }

  /** Used by boss speed-boost ability. */
  public multiplySpeed(mult: number): void {
    this.effectiveSpeed = Math.max(1, this.effectiveSpeed * mult);
  }

  public getHpRatio(): number {
    return Phaser.Math.Clamp(this.hp / this.effectiveMaxHp, 0, 1);
  }

  public isInvulnerable(): boolean {
    return this.scene.time.now < this.invulnerableUntil;
  }

  public destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
    this.hpBarRim.destroy();
    this.hpBarBg.destroy();
    this.hpBarFill.destroy();
    this.decor?.destroy();
    this.shieldRing?.destroy();
    this.eliteHalo?.destroy();
    this.trailGfx?.destroy();
    this.destroyExtras();
  }

  private flashHit(): void {
    const originalColor = this.definition.color;
    this.sprite.setFillStyle(0xffffff);
    this.scene.time.delayedCall(60, () => {
      if (this.sprite.active) this.sprite.setFillStyle(originalColor);
    });
  }

  private playDeath(): void {
    audio.playEnemyDeath(this.isBoss);

    this.hpBarRim.destroy();
    this.hpBarBg.destroy();
    this.hpBarFill.destroy();
    this.destroyExtras();

    // Burst ring
    const burst = this.scene.add.circle(this.sprite.x, this.sprite.y, this.definition.radius * 0.9, palette.primary, 0.85);
    burst.setDepth(15);
    this.scene.tweens.add({
      targets: burst,
      scale: { from: 0.6, to: 2.2 },
      alpha: { from: 0.85, to: 0 },
      duration: 280,
      ease: "Quad.Out",
      onComplete: () => burst.destroy(),
    });

    // Outer shockwave
    const ring = this.scene.add.circle(this.sprite.x, this.sprite.y, this.definition.radius, 0x000000, 0);
    ring.setStrokeStyle(2, palette.primary, 0.9);
    ring.setDepth(15);
    this.scene.tweens.add({
      targets: ring,
      scale: { from: 1, to: 2.6 },
      alpha: { from: 1, to: 0 },
      duration: 420,
      ease: "Quad.Out",
      onComplete: () => ring.destroy(),
    });

    // Spark particles (color-coded from enemy)
    const sparkCount = this.isBoss ? 12 : 6;
    for (let i = 0; i < sparkCount; i += 1) {
      const angle = (Math.PI * 2 * i) / sparkCount + Math.random() * 0.3;
      const dist = this.definition.radius * (1.6 + Math.random() * 0.8);
      const spark = this.scene.add.circle(
        this.sprite.x,
        this.sprite.y,
        2,
        this.definition.color,
        1,
      );
      spark.setDepth(16);
      this.scene.tweens.add({
        targets: spark,
        x: this.sprite.x + Math.cos(angle) * dist,
        y: this.sprite.y + Math.sin(angle) * dist,
        alpha: { from: 1, to: 0 },
        scale: { from: 1.2, to: 0.4 },
        duration: 360 + Math.random() * 140,
        ease: "Quad.Out",
        onComplete: () => spark.destroy(),
      });
    }

    // Gold chip particles: 3-5 tiny coins that arc + fall with gravity,
    // reinforcing the casino payout metaphor for every kill.
    const chipCount = this.isBoss ? 10 : 3;
    for (let i = 0; i < chipCount; i += 1) {
      const chip = this.scene.add.circle(this.sprite.x, this.sprite.y, 3, palette.gold, 1);
      chip.setStrokeStyle(1, palette.goldDeep, 1);
      chip.setDepth(17);
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
      const velocity = 70 + Math.random() * 60;
      const vx = Math.cos(angle) * velocity;
      const vy = Math.sin(angle) * velocity;
      const startX = this.sprite.x;
      const startY = this.sprite.y;
      const duration = 520 + Math.random() * 260;

      // Parametric flight: x = linear, y = projectile (gravity).
      // Animate a dummy `t` from 0 → 1 and project.
      const state = { t: 0 } as { t: number };
      this.scene.tweens.add({
        targets: state,
        t: 1,
        duration,
        ease: "Quad.Out",
        onUpdate: () => {
          const tSec = (state.t * duration) / 1000;
          chip.x = startX + vx * tSec;
          chip.y = startY + vy * tSec + 220 * tSec * tSec;
          chip.scaleX = 1 - 0.4 * Math.abs(Math.sin(state.t * Math.PI * 3));
          chip.alpha = 1 - Math.max(0, state.t - 0.6) / 0.4;
        },
        onComplete: () => chip.destroy(),
      });
    }

    // Shadow fade
    this.scene.tweens.add({
      targets: this.shadow,
      alpha: 0,
      scale: 0.3,
      duration: 180,
      ease: "Quad.In",
      onComplete: () => this.shadow.destroy(),
    });

    this.scene.tweens.add({
      targets: this.sprite,
      scale: { from: 1, to: 0.1 },
      alpha: { from: 1, to: 0 },
      duration: 180,
      ease: "Quad.In",
      onComplete: () => this.sprite.destroy(),
    });
  }

  private syncHpBar(): void {
    // Hide the stock per-enemy HP bar on bosses that use the fullscreen bar.
    if (this.definition.fullscreenHpBar) {
      this.hpBarRim.setVisible(false);
      this.hpBarBg.setVisible(false);
      this.hpBarFill.setVisible(false);
    }

    // Floating enemies bob up and down slightly around the path line.
    const floatOffset = this.definition.floats ? Math.sin(this.floatClock / 260) * 6 : 0;
    this.sprite.y += 0; // path already moved the sprite; floatOffset applied to visuals only
    const visualY = this.sprite.y + floatOffset;

    const ratio = Phaser.Math.Clamp(this.hp / this.effectiveMaxHp, 0, 1);
    const offset = this.isBoss ? HP_BAR_OFFSET_Y + 10 : HP_BAR_OFFSET_Y;

    this.hpBarRim.x = this.sprite.x;
    this.hpBarRim.y = visualY - offset;
    this.hpBarBg.x = this.sprite.x;
    this.hpBarBg.y = visualY - offset;
    this.hpBarFill.x = this.sprite.x - this.hpBarWidth / 2;
    this.hpBarFill.y = visualY - offset;
    this.hpBarFill.width = this.hpBarWidth * ratio;
    this.hpBarFill.fillColor = ratio > 0.5 ? palette.success : ratio > 0.25 ? palette.warn : palette.danger;

    this.shadow.x = this.sprite.x;
    this.shadow.y = this.sprite.y + this.definition.radius * 0.75;
    if (this.definition.floats) {
      // Keep the shadow anchored to the ground even as the body floats.
      this.shadow.setAlpha(0.25);
    }

    for (const aura of this.auras) {
      aura.x = this.sprite.x;
      aura.y = visualY;
    }
    if (this.crown) this.drawCrown(this.sprite.x, visualY);

    // Apply the float offset to the visible body too.
    if (this.definition.floats) {
      // We shift sprite visually without modifying the authoritative position
      // by using displayOriginY adjustments. Simpler: translate sprite visual.
    }
    // Decor / shield ring / halo / trail all follow the visualY.
    if (this.decor) this.drawDecor(this.sprite.x, visualY);
    if (this.shieldRing) this.drawShieldRing(this.sprite.x, visualY);
    if (this.eliteHalo) {
      this.eliteHalo.x = this.sprite.x;
      this.eliteHalo.y = visualY;
    }

    // Keep the base sprite aligned with visuals for floating enemies.
    // We do this after everything else so the next frame's pathing math still
    // uses the authoritative sprite position; only the displayed y is tweaked
    // via the decor/halo/bar offsets above. The base circle stays on the
    // path line — on floating types we hide the base circle and the decor
    // fully carries the visual.
    if (this.definition.floats) {
      this.sprite.setAlpha(0);
    }
  }

  // --- Decor drawing (shape-specific ornaments) -------------------------

  private drawDecor(x: number, y: number): void {
    if (!this.decor) return;
    const g = this.decor;
    const r = this.definition.radius;
    const color = this.definition.color;
    const stroke = palette.bgDeep;
    g.clear();
    g.lineStyle(2, stroke, 1);

    switch (this.definition.shape) {
      case "triangle": {
        // Sharp arrowhead pointing along travel direction (approx. right/up).
        g.fillStyle(color, 1);
        g.beginPath();
        g.moveTo(x + r, y);
        g.lineTo(x - r * 0.8, y - r * 0.8);
        g.lineTo(x - r * 0.5, y);
        g.lineTo(x - r * 0.8, y + r * 0.8);
        g.closePath();
        g.fillPath();
        g.strokePath();
        break;
      }
      case "diamond": {
        g.fillStyle(color, 1);
        g.beginPath();
        g.moveTo(x, y - r);
        g.lineTo(x + r, y);
        g.lineTo(x, y + r);
        g.lineTo(x - r, y);
        g.closePath();
        g.fillPath();
        g.strokePath();
        // Inner gem facet
        g.lineStyle(1, 0xffffff, 0.4);
        g.beginPath();
        g.moveTo(x, y - r * 0.5);
        g.lineTo(x + r * 0.5, y);
        g.lineTo(x, y + r * 0.5);
        g.lineTo(x - r * 0.5, y);
        g.closePath();
        g.strokePath();
        break;
      }
      case "plate": {
        // Octagonal armored plate with rivets.
        g.fillStyle(color, 1);
        g.beginPath();
        const step = r * 0.55;
        g.moveTo(x - step, y - r);
        g.lineTo(x + step, y - r);
        g.lineTo(x + r, y - step);
        g.lineTo(x + r, y + step);
        g.lineTo(x + step, y + r);
        g.lineTo(x - step, y + r);
        g.lineTo(x - r, y + step);
        g.lineTo(x - r, y - step);
        g.closePath();
        g.fillPath();
        g.strokePath();
        // Rivets
        g.fillStyle(stroke, 0.9);
        for (const [dx, dy] of [
          [-r * 0.6, -r * 0.6],
          [r * 0.6, -r * 0.6],
          [-r * 0.6, r * 0.6],
          [r * 0.6, r * 0.6],
        ]) {
          g.fillCircle(x + dx, y + dy, 1.8);
        }
        break;
      }
      case "wisp": {
        // Glowing orb with two smaller satellite lights.
        g.fillStyle(color, 0.8);
        g.fillCircle(x, y, r);
        g.lineStyle(1, 0xffffff, 0.6);
        g.strokeCircle(x, y, r);
        const phase = this.floatClock / 220;
        g.fillStyle(0xffffff, 0.85);
        g.fillCircle(x + Math.cos(phase) * r * 1.4, y + Math.sin(phase) * r * 1.4, r * 0.28);
        g.fillCircle(x + Math.cos(phase + Math.PI) * r * 1.4, y + Math.sin(phase + Math.PI) * r * 1.4, r * 0.22);
        break;
      }
      case "boss": {
        // Layered star + crown ring for the boss (on top of the base arc).
        g.fillStyle(color, 1);
        g.lineStyle(2, 0xffd166, 0.9);
        const points = 5;
        const inner = r * 0.55;
        g.beginPath();
        for (let i = 0; i < points * 2; i += 1) {
          const radius = i % 2 === 0 ? r : inner;
          const angle = -Math.PI / 2 + (Math.PI * i) / points;
          const px = x + Math.cos(angle) * radius;
          const py = y + Math.sin(angle) * radius;
          if (i === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.closePath();
        g.fillPath();
        g.strokePath();
        break;
      }
      default:
        break;
    }
  }

  private drawShieldRing(x: number, y: number): void {
    if (!this.shieldRing) return;
    const g = this.shieldRing;
    g.clear();
    if (this.shieldHits <= 0) return;
    const r = this.definition.radius + 4;
    const breathing = 1 + Math.sin(this.floatClock / 180) * 0.05;
    g.lineStyle(2, 0x8ec5ff, 0.9);
    g.strokeCircle(x, y, r * breathing);
    // Two arc segments on top to suggest a directional shield
    g.lineStyle(3, 0xe6f1ff, 0.85);
    g.beginPath();
    g.arc(x, y, r + 2, -Math.PI * 0.15, Math.PI * 0.15, false);
    g.strokePath();
  }

  private popShield(): void {
    audio.playImpact(true);
    // Shield ring flashes bright white, expands, then fades.
    const ring = this.scene.add.circle(this.sprite.x, this.sprite.y, this.definition.radius + 6, 0x8ec5ff, 0);
    ring.setStrokeStyle(3, 0xffffff, 1);
    ring.setDepth(15);
    this.scene.tweens.add({
      targets: ring,
      scale: { from: 1, to: 1.9 },
      alpha: { from: 1, to: 0 },
      duration: 360,
      ease: "Quad.Out",
      onComplete: () => ring.destroy(),
    });
    // Shard sparks
    for (let i = 0; i < 8; i += 1) {
      const angle = (Math.PI * 2 * i) / 8;
      const spark = this.scene.add.rectangle(this.sprite.x, this.sprite.y, 3, 8, 0xe6f1ff, 1);
      spark.setAngle(Phaser.Math.RadToDeg(angle));
      spark.setDepth(16);
      const dist = this.definition.radius * 2;
      this.scene.tweens.add({
        targets: spark,
        x: this.sprite.x + Math.cos(angle) * dist,
        y: this.sprite.y + Math.sin(angle) * dist,
        alpha: { from: 1, to: 0 },
        duration: 320,
        ease: "Quad.Out",
        onComplete: () => spark.destroy(),
      });
    }
    this.syncHpBar();
  }

  private flashImmune(): void {
    // Small rejection ripple tinted gold when a shielded pulse is up.
    const ring = this.scene.add.circle(this.sprite.x, this.sprite.y, this.definition.radius + 4, 0xffd166, 0);
    ring.setStrokeStyle(2, 0xffd166, 1);
    ring.setDepth(15);
    this.scene.tweens.add({
      targets: ring,
      scale: { from: 0.8, to: 1.6 },
      alpha: { from: 1, to: 0 },
      duration: 260,
      ease: "Quad.Out",
      onComplete: () => ring.destroy(),
    });
  }

  private updateTrail(_deltaMs: number): void {
    if (!this.trailGfx) return;
    this.trailPoints.push({ x: this.sprite.x, y: this.sprite.y, age: 0 });
    for (const p of this.trailPoints) p.age += _deltaMs;
    while (this.trailPoints.length > 10) this.trailPoints.shift();

    const g = this.trailGfx;
    g.clear();
    for (let i = 0; i < this.trailPoints.length - 1; i += 1) {
      const p = this.trailPoints[i];
      const alpha = 0.4 * (1 - p.age / 360);
      if (alpha <= 0) continue;
      g.fillStyle(this.definition.color, alpha);
      const size = (this.definition.radius * 0.5 * (i + 1)) / this.trailPoints.length;
      g.fillCircle(p.x, p.y, size);
    }
  }

  private drawCrown(x: number, y: number): void {
    if (!this.crown) return;
    const g = this.crown;
    g.clear();
    g.fillStyle(0xffd166, 1);
    g.lineStyle(1, 0x2b1d00, 1);
    const top = y - this.definition.radius - 8;
    const baseWidth = this.definition.radius * 1.4;
    const left = x - baseWidth / 2;
    const right = x + baseWidth / 2;
    g.beginPath();
    g.moveTo(left, top + 8);
    g.lineTo(left, top + 2);
    g.lineTo(left + baseWidth * 0.2, top + 8);
    g.lineTo(left + baseWidth * 0.35, top - 4);
    g.lineTo(left + baseWidth * 0.5, top + 6);
    g.lineTo(left + baseWidth * 0.65, top - 4);
    g.lineTo(left + baseWidth * 0.8, top + 8);
    g.lineTo(right, top + 2);
    g.lineTo(right, top + 8);
    g.closePath();
    g.fillPath();
    g.strokePath();
  }

  public destroyExtras(): void {
    for (const aura of this.auras) aura.destroy();
    this.crown?.destroy();
  }
}
