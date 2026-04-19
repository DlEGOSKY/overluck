import Phaser from "phaser";
import { Enemy, type EnemyStatOverrides } from "@/entities/Enemy";
import type { EnemyCatalog, EnemyId, PathPoints } from "@/types";

export interface EnemyManagerEvents {
  onEnemyKilled: (enemy: Enemy) => void;
  onEnemyReachedBase: (enemy: Enemy) => void;
}

export class EnemyManager {
  private readonly scene: Phaser.Scene;
  private readonly path: PathPoints;
  private readonly catalog: EnemyCatalog;
  private readonly events: EnemyManagerEvents;
  private readonly spawnListeners = new Set<(enemy: Enemy) => void>();

  private readonly enemies: Enemy[] = [];

  public constructor(
    scene: Phaser.Scene,
    path: PathPoints,
    catalog: EnemyCatalog,
    events: EnemyManagerEvents,
  ) {
    this.scene = scene;
    this.path = path;
    this.catalog = catalog;
    this.events = events;
  }

  public spawn(enemyId: EnemyId, overrides: EnemyStatOverrides = {}): Enemy {
    const definition = this.catalog[enemyId];
    const enemy = new Enemy(this.scene, this.path, definition, overrides);
    this.enemies.push(enemy);
    for (const cb of this.spawnListeners) cb(enemy);
    return enemy;
  }

  public onSpawn(cb: (enemy: Enemy) => void): () => void {
    this.spawnListeners.add(cb);
    return () => this.spawnListeners.delete(cb);
  }

  public update(deltaMs: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = this.enemies[i];
      const wasAlive = enemy.isAlive();
      enemy.update(deltaMs);

      if (!enemy.isAlive()) {
        this.enemies.splice(i, 1);
        if (enemy.hasReachedBase()) {
          this.events.onEnemyReachedBase(enemy);
        } else if (wasAlive) {
          this.events.onEnemyKilled(enemy);
        }
      }
    }
  }

  public get active(): readonly Enemy[] {
    return this.enemies;
  }

  public activeCount(): number {
    return this.enemies.length;
  }

  public clear(): void {
    for (const enemy of this.enemies) enemy.destroy();
    this.enemies.length = 0;
  }
}
