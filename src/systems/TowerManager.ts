import Phaser from "phaser";
import { Tower } from "@/entities/Tower";
import type { Enemy } from "@/entities/Enemy";
import type { ProjectileManager } from "./ProjectileManager";
import type { ChipManager } from "./ChipManager";
import type { RelicManager } from "./RelicManager";
import type { WaveModifierManager } from "./WaveModifierManager";
import { audio } from "./AudioManager";
import type { TowerCatalog, TowerDefinition, TowerId, TowerSlot } from "@/types";
import { ease, palette } from "@/ui/theme";

const SLOT_RADIUS = 16;

export class TowerManager {
  private readonly scene: Phaser.Scene;
  private readonly catalog: TowerCatalog;
  private readonly chips: ChipManager;
  private readonly projectiles: ProjectileManager;
  private readonly relics: RelicManager;
  private readonly waveModifiers: WaveModifierManager | null;

  private readonly slots: readonly TowerSlot[];
  private readonly slotMarkers: Phaser.GameObjects.Arc[] = [];
  private readonly occupied = new Map<number, Tower>();
  private readonly towers: Tower[] = [];

  private selectedTowerId: TowerId = "blaster";
  private hoverRangePreview: Phaser.GameObjects.Arc | null = null;
  private towerClickHandler: ((tower: Tower) => void) | null = null;
  private towerPlacedHandler: ((tower: Tower) => void) | null = null;
  private readonly towerHits: Phaser.GameObjects.Arc[] = [];

  public constructor(
    scene: Phaser.Scene,
    slots: readonly TowerSlot[],
    catalog: TowerCatalog,
    chips: ChipManager,
    projectiles: ProjectileManager,
    relics: RelicManager,
    waveModifiers: WaveModifierManager | null = null,
  ) {
    this.scene = scene;
    this.slots = slots;
    this.catalog = catalog;
    this.chips = chips;
    this.projectiles = projectiles;
    this.relics = relics;
    this.waveModifiers = waveModifiers;

    this.renderSlots();
  }

  public getSelectedDefinition(): TowerDefinition {
    return this.catalog[this.selectedTowerId];
  }

  public getSelectedId(): TowerId {
    return this.selectedTowerId;
  }

  public selectTower(id: TowerId): void {
    this.selectedTowerId = id;
  }

  public onTowerClicked(cb: (tower: Tower) => void): void {
    this.towerClickHandler = cb;
  }

  public onTowerPlaced(cb: (tower: Tower) => void): void {
    this.towerPlacedHandler = cb;
  }

  public update(deltaMs: number, enemies: readonly Enemy[]): void {
    const damageMult = this.waveModifiers?.towerDamageMult() ?? 1;

    for (const tower of this.towers) {
      const fire = tower.update(deltaMs, enemies);
      if (fire) {
        const def = tower.definition;
        const stats = tower.getStats();
        const color =
          fire.outcome === "crit"
            ? 0xffd166
            : fire.outcome === "misfire"
              ? 0xff5c6c
              : def.color;
        const splash = stats.splash
          ? {
              radius: stats.splash.radius * (1 + this.relics.shockSplashBonus()),
              falloff: stats.splash.falloff,
            }
          : undefined;

        this.projectiles.spawn(
          {
            x: tower.x,
            y: tower.y,
            damage: Math.max(1, Math.round(fire.damage * damageMult)),
            speed: stats.projectileSpeed,
            color,
            radius: fire.outcome === "crit" ? 7 : 5,
            outcome: fire.outcome,
            splash,
          },
          fire.target,
        );
      }
    }
  }

  public getTowerAt(x: number, y: number, tolerance = 24): Tower | null {
    for (const tower of this.towers) {
      const dx = tower.x - x;
      const dy = tower.y - y;
      if (Math.hypot(dx, dy) <= tolerance) return tower;
    }
    return null;
  }

  public tryUpgradeTower(tower: Tower): boolean {
    const next = tower.getNextUpgrade();
    if (!next) return false;
    if (!this.chips.spend(next.cost)) return false;
    return tower.applyUpgrade();
  }

  public clear(): void {
    for (const tower of this.towers) tower.destroy();
    this.towers.length = 0;
    this.occupied.clear();
    for (const marker of this.slotMarkers) marker.destroy();
    this.slotMarkers.length = 0;
    for (const hit of this.towerHits) hit.destroy();
    this.towerHits.length = 0;
    this.renderSlots();
  }

  private renderSlots(): void {
    this.slots.forEach((slot, index) => {
      // Breathing halo to attract attention to empty slots
      const halo = this.scene.add.circle(slot.x, slot.y, SLOT_RADIUS + 4, palette.accent, 0.08);
      halo.setDepth(1.5);
      this.scene.tweens.add({
        targets: halo,
        scale: { from: 1, to: 1.25 },
        alpha: { from: 0.1, to: 0.02 },
        yoyo: true,
        repeat: -1,
        duration: 1600,
        ease: ease.inOut,
      });

      const marker = this.scene.add.circle(slot.x, slot.y, SLOT_RADIUS, palette.surface, 0.55);
      marker.setStrokeStyle(1, palette.accent, 0.55);
      marker.setDepth(2);
      marker.setInteractive(
        new Phaser.Geom.Circle(0, 0, SLOT_RADIUS + 6),
        Phaser.Geom.Circle.Contains,
      );

      // Plus sign inside slot ("add tower here")
      const plus = this.scene.add.graphics();
      plus.setDepth(2.5);
      plus.lineStyle(1.5, palette.accent, 0.7);
      plus.beginPath();
      plus.moveTo(slot.x - 5, slot.y);
      plus.lineTo(slot.x + 5, slot.y);
      plus.moveTo(slot.x, slot.y - 5);
      plus.lineTo(slot.x, slot.y + 5);
      plus.strokePath();

      // Track plus graphic alongside marker for destroy() path
      (marker as unknown as { _plus: Phaser.GameObjects.Graphics })._plus = plus;
      (marker as unknown as { _halo: Phaser.GameObjects.Arc })._halo = halo;

      marker.on("pointerover", () => {
        if (!this.occupied.has(index)) {
          const def = this.getSelectedDefinition();
          const affordable = this.chips.canAfford(def.cost);
          marker.setFillStyle(affordable ? palette.surfaceElevated : 0x3a1a24, 0.85);
          marker.setStrokeStyle(2, affordable ? def.color : palette.danger, 0.95);
          plus.clear();
          plus.lineStyle(2, affordable ? def.color : palette.danger, 1);
          plus.beginPath();
          plus.moveTo(slot.x - 6, slot.y);
          plus.lineTo(slot.x + 6, slot.y);
          plus.moveTo(slot.x, slot.y - 6);
          plus.lineTo(slot.x, slot.y + 6);
          plus.strokePath();
          this.showRangePreview(slot.x, slot.y, def, affordable);
        }
      });
      marker.on("pointerout", () => {
        if (!this.occupied.has(index)) {
          marker.setFillStyle(palette.surface, 0.55);
          marker.setStrokeStyle(1, palette.accent, 0.55);
          plus.clear();
          plus.lineStyle(1.5, palette.accent, 0.7);
          plus.beginPath();
          plus.moveTo(slot.x - 5, slot.y);
          plus.lineTo(slot.x + 5, slot.y);
          plus.moveTo(slot.x, slot.y - 5);
          plus.lineTo(slot.x, slot.y + 5);
          plus.strokePath();
        }
        this.hideRangePreview();
      });
      marker.on("pointerdown", () => this.tryPlaceTower(index));

      this.slotMarkers.push(marker);
    });
  }

  private tryPlaceTower(slotIndex: number): void {
    if (this.occupied.has(slotIndex)) return;
    const def = this.getSelectedDefinition();
    if (!this.chips.spend(def.cost)) return;
    audio.playPlace();

    const slot = this.slots[slotIndex];
    const tower = new Tower(this.scene, slot, def, this.relics);
    if (this.waveModifiers) {
      const wm = this.waveModifiers;
      tower.setFireRateMultiplier(() => wm.towerFireRateMult());
    }
    this.towers.push(tower);
    this.occupied.set(slotIndex, tower);
    this.towerPlacedHandler?.(tower);

    const marker = this.slotMarkers[slotIndex];
    marker.setFillStyle(0x000000, 0);
    marker.setStrokeStyle(0, 0x000000, 0);
    const plus = (marker as unknown as { _plus?: Phaser.GameObjects.Graphics })._plus;
    const halo = (marker as unknown as { _halo?: Phaser.GameObjects.Arc })._halo;
    if (plus) plus.destroy();
    if (halo) halo.destroy();
    this.hideRangePreview();

    // Placement burst
    const burst = this.scene.add.circle(slot.x, slot.y, def.baseRadius + 8, def.color, 0.45);
    burst.setDepth(7);
    this.scene.tweens.add({
      targets: burst,
      scale: { from: 0.6, to: 2.4 },
      alpha: { from: 0.6, to: 0 },
      duration: 420,
      ease: ease.out,
      onComplete: () => burst.destroy(),
    });

    this.scene.tweens.add({
      targets: tower.rootVisuals,
      scale: { from: 0.6, to: 1 },
      ease: "Back.Out",
      duration: 280,
    });

    // Interactive hit area for opening the info panel
    const hit = this.scene.add.circle(slot.x, slot.y, def.baseRadius + 6, 0x000000, 0.001);
    hit.setInteractive({ useHandCursor: true });
    hit.setDepth(8);
    hit.on("pointerover", () => {
      tower.setRangeVisible(true);
    });
    hit.on("pointerout", () => {
      tower.setRangeVisible(false);
    });
    hit.on("pointerdown", (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.towerClickHandler?.(tower);
    });
    this.towerHits.push(hit);
  }

  private showRangePreview(x: number, y: number, def: TowerDefinition, affordable: boolean): void {
    this.hideRangePreview();
    const color = affordable ? def.color : palette.danger;
    const ring = this.scene.add.circle(x, y, def.range, color, 0.06);
    ring.setStrokeStyle(1, color, 0.5);
    ring.setDepth(3);
    this.hoverRangePreview = ring;

    // Gentle breathing on the preview
    this.scene.tweens.add({
      targets: ring,
      scale: { from: 0.98, to: 1.02 },
      yoyo: true,
      repeat: -1,
      duration: 1400,
      ease: ease.inOut,
    });
  }

  private hideRangePreview(): void {
    if (this.hoverRangePreview) {
      this.hoverRangePreview.destroy();
      this.hoverRangePreview = null;
    }
  }
}
