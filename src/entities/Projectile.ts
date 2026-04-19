import Phaser from "phaser";
import type { FireOutcome, ProjectileConfig, SplashConfig } from "@/types";
import type { Enemy } from "./Enemy";
import { audio } from "@/systems/AudioManager";
import { colorToHex, dur, ease, hex, palette } from "@/ui/theme";

export interface ImpactResult {
  hit: boolean;
  killed: boolean;
  splash?: {
    x: number;
    y: number;
    radius: number;
    falloff: number;
    damage: number;
    primaryTarget: Enemy;
    color: number;
  };
}

const TRAIL_SEGMENTS = 5;
const TRAIL_SPAWN_MS = 20;

export class Projectile {
  public readonly sprite: Phaser.GameObjects.Arc;

  private readonly scene: Phaser.Scene;
  private readonly damage: number;
  private readonly speed: number;
  private readonly color: number;
  private readonly outcome: FireOutcome;
  private readonly splash: SplashConfig | null;
  private readonly target: Enemy;
  private readonly glow: Phaser.GameObjects.Arc;

  private alive = true;
  private trailTimer = 0;
  private readonly trail: { node: Phaser.GameObjects.Arc; life: number; maxLife: number }[] = [];

  public constructor(scene: Phaser.Scene, config: ProjectileConfig, target: Enemy) {
    this.scene = scene;
    this.damage = config.damage;
    this.speed = config.speed;
    this.color = config.color;
    this.outcome = config.outcome;
    this.splash = config.splash ?? null;
    this.target = target;

    // Outer glow
    this.glow = scene.add.circle(config.x, config.y, config.radius + 4, config.color, 0.22);
    this.glow.setDepth(19);

    // Core projectile
    this.sprite = scene.add.circle(config.x, config.y, config.radius, config.color);
    this.sprite.setDepth(21);
    this.sprite.setStrokeStyle(1, 0xffffff, 0.75);
  }

  public isAlive(): boolean {
    return this.alive;
  }

  public update(deltaMs: number): ImpactResult {
    if (!this.alive) return { hit: false, killed: false };

    if (!this.target.isAlive()) {
      this.cleanup();
      return { hit: false, killed: false };
    }

    this.updateTrail(deltaMs);

    const dx = this.target.x - this.sprite.x;
    const dy = this.target.y - this.sprite.y;
    const distance = Math.hypot(dx, dy);
    const step = (this.speed * deltaMs) / 1000;

    if (step >= distance) {
      const impactX = this.target.x;
      const impactY = this.target.y;
      const damageResult = this.target.applyDamage(this.damage);
      const killed = damageResult === "killed";
      this.spawnImpact();
      this.cleanup();

      if (this.splash) {
        return {
          hit: true,
          killed,
          splash: {
            x: impactX,
            y: impactY,
            radius: this.splash.radius,
            falloff: this.splash.falloff,
            damage: this.damage,
            primaryTarget: this.target,
            color: this.color,
          },
        };
      }

      return { hit: true, killed };
    }

    this.sprite.x += (dx / distance) * step;
    this.sprite.y += (dy / distance) * step;
    this.glow.x = this.sprite.x;
    this.glow.y = this.sprite.y;
    return { hit: false, killed: false };
  }

  public destroy(): void {
    this.cleanup();
  }

  private cleanup(): void {
    this.alive = false;
    this.sprite.destroy();
    this.glow.destroy();
    for (const t of this.trail) t.node.destroy();
    this.trail.length = 0;
  }

  private updateTrail(deltaMs: number): void {
    this.trailTimer -= deltaMs;
    if (this.trailTimer <= 0) {
      this.trailTimer = TRAIL_SPAWN_MS;
      const segment = this.scene.add.circle(this.sprite.x, this.sprite.y, this.sprite.radius * 0.85, this.color, 0.6);
      segment.setDepth(18);
      const maxLife = 180;
      this.trail.push({ node: segment, life: maxLife, maxLife });
      if (this.trail.length > TRAIL_SEGMENTS) {
        const first = this.trail.shift();
        if (first) first.node.destroy();
      }
    }

    for (let i = this.trail.length - 1; i >= 0; i -= 1) {
      const t = this.trail[i];
      t.life -= deltaMs;
      if (t.life <= 0) {
        t.node.destroy();
        this.trail.splice(i, 1);
        continue;
      }
      const k = t.life / t.maxLife;
      t.node.setAlpha(k * 0.6);
      t.node.setScale(k * 0.9 + 0.1);
    }
  }

  private spawnImpact(): void {
    audio.playImpact(this.outcome === "crit");

    const size = this.outcome === "crit" ? 10 : 6;
    const scaleTo = this.outcome === "crit" ? 3 : 2.2;
    const impact = this.scene.add.circle(this.sprite.x, this.sprite.y, size, this.color, 0.9);
    impact.setDepth(22);
    this.scene.tweens.add({
      targets: impact,
      scale: { from: 0.8, to: scaleTo },
      alpha: { from: 0.9, to: 0 },
      duration: this.outcome === "crit" ? 260 : 180,
      ease: ease.out,
      onComplete: () => impact.destroy(),
    });

    // Shockwave ring on crits
    if (this.outcome === "crit") {
      const ring = this.scene.add.circle(this.sprite.x, this.sprite.y, 4, 0x000000, 0);
      ring.setStrokeStyle(2, palette.primary, 0.95);
      ring.setDepth(22);
      this.scene.tweens.add({
        targets: ring,
        scale: { from: 1, to: 4 },
        alpha: { from: 1, to: 0 },
        duration: 360,
        ease: ease.out,
        onComplete: () => ring.destroy(),
      });
    }

    // Small spark particles
    const sparkCount = this.outcome === "crit" ? 5 : 3;
    for (let i = 0; i < sparkCount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 80;
      const spark = this.scene.add.circle(this.sprite.x, this.sprite.y, 1.5, this.color, 1);
      spark.setDepth(22);
      this.scene.tweens.add({
        targets: spark,
        x: spark.x + Math.cos(angle) * speed * 0.3,
        y: spark.y + Math.sin(angle) * speed * 0.3,
        alpha: { from: 1, to: 0 },
        duration: 260 + Math.random() * 120,
        ease: ease.out,
        onComplete: () => spark.destroy(),
      });
    }

    this.spawnPopup();
  }

  /**
   * Floating damage number. Scale + jitter + drift up then fade.
   * - crit: big gold "CRIT ·N"
   * - misfire: red "MISS ·N"
   * - normal: small white "N"
   */
  private spawnPopup(): void {
    const isCrit = this.outcome === "crit";
    const isMiss = this.outcome === "misfire";
    const label = isCrit ? `CRIT·${this.damage}` : isMiss ? `MISS·${this.damage}` : `${this.damage}`;
    const color = isCrit ? hex.primary : isMiss ? hex.danger : hex.text;
    const fontSize = isCrit ? "16px" : isMiss ? "12px" : "11px";
    const jitterX = (Math.random() - 0.5) * 16;

    const text = this.scene.add.text(this.sprite.x + jitterX, this.sprite.y - 14, label, {
      fontFamily: '"Inter", "SF Pro Text", "Segoe UI", system-ui, sans-serif',
      fontSize,
      color,
      fontStyle: "bold",
    });
    text.setOrigin(0.5, 1);
    text.setDepth(23);
    text.setLetterSpacing(isCrit ? 2 : 0.5);
    text.setScale(0.6);

    this.scene.tweens.add({
      targets: text,
      scale: isCrit ? 1.1 : 1,
      duration: dur.quick,
      ease: ease.snap,
    });

    this.scene.tweens.add({
      targets: text,
      y: text.y - (isCrit ? 36 : 24),
      alpha: { from: 1, to: 0 },
      duration: isCrit ? 800 : 560,
      ease: ease.out,
      onComplete: () => text.destroy(),
    });

    if (isCrit) {
      text.setStroke(colorToHex(palette.bgDeep), 3);
    }
  }
}
