import Phaser from "phaser";
import { Projectile } from "@/entities/Projectile";
import type { Enemy } from "@/entities/Enemy";
import type { ProjectileConfig } from "@/types";

export interface ProjectileDeps {
  onEnemyKilled?: (enemy: Enemy) => void;
}

export class ProjectileManager {
  private readonly scene: Phaser.Scene;
  private readonly projectiles: Projectile[] = [];
  private readonly deps: ProjectileDeps;

  public constructor(scene: Phaser.Scene, deps: ProjectileDeps = {}) {
    this.scene = scene;
    this.deps = deps;
  }

  public spawn(config: ProjectileConfig, target: Enemy): void {
    this.projectiles.push(new Projectile(this.scene, config, target));
  }

  public update(deltaMs: number, enemies: readonly Enemy[]): void {
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      const projectile = this.projectiles[i];
      const result = projectile.update(deltaMs);
      if (result.splash) {
        this.applySplash(result.splash, enemies);
      }
      if (!projectile.isAlive()) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  private applySplash(
    splash: NonNullable<ReturnType<Projectile["update"]>["splash"]>,
    enemies: readonly Enemy[],
  ): void {
    this.spawnSplashVisual(splash.x, splash.y, splash.radius, splash.color);

    for (const enemy of enemies) {
      if (enemy === splash.primaryTarget) continue;
      if (!enemy.isAlive()) continue;
      // Wisps float above the blast plane — splash can't reach them.
      if (enemy.definition.ignoresSplash) continue;
      const dx = enemy.x - splash.x;
      const dy = enemy.y - splash.y;
      const dist = Math.hypot(dx, dy);
      if (dist > splash.radius) continue;

      const ratio = 1 - dist / splash.radius;
      const dmg = Math.max(1, Math.round(splash.damage * (splash.falloff + (1 - splash.falloff) * ratio)));
      const result = enemy.applyDamage(dmg);
      if (result === "killed" && this.deps.onEnemyKilled) this.deps.onEnemyKilled(enemy);
    }
  }

  private spawnSplashVisual(x: number, y: number, radius: number, color: number): void {
    const ring = this.scene.add.circle(x, y, radius, color, 0.2);
    ring.setStrokeStyle(2, color, 0.9);
    ring.setDepth(21);
    this.scene.tweens.add({
      targets: ring,
      scale: { from: 0.3, to: 1.1 },
      alpha: { from: 0.9, to: 0 },
      duration: 360,
      ease: "Quad.Out",
      onComplete: () => ring.destroy(),
    });
  }

  public clear(): void {
    for (const projectile of this.projectiles) projectile.destroy();
    this.projectiles.length = 0;
  }
}
