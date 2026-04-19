import Phaser from "phaser";
import type { ComboSnapshot } from "@/systems/ComboTracker";
import {
  applyLetterSpacing,
  dur,
  ease,
  hex,
  palette,
  textStyle,
  type,
} from "./theme";

/**
 * Floating chip on the top-right that shows the current kill streak and
 * multiplier. Fades out when the streak breaks. Pulses on milestone tiers.
 */
export class ComboChip {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly streakText: Phaser.GameObjects.Text;
  private readonly multText: Phaser.GameObjects.Text;
  private readonly progress: Phaser.GameObjects.Graphics;
  private lastTierShown = 1;

  public constructor(scene: Phaser.Scene, worldWidth: number) {
    this.scene = scene;
    this.container = scene.add.container(worldWidth - 160, 100);
    this.container.setDepth(105);
    this.container.setVisible(false);

    this.bg = scene.add.graphics();
    this.container.add(this.bg);

    this.streakText = scene.add.text(14, 10, "", textStyle(type.h2, { color: hex.gold }));
    applyLetterSpacing(this.streakText, type.h2);
    this.container.add(this.streakText);

    this.multText = scene.add.text(14, 40, "", textStyle(type.overline, { color: hex.text }));
    applyLetterSpacing(this.multText, type.overline);
    this.container.add(this.multText);

    this.progress = scene.add.graphics();
    this.container.add(this.progress);
  }

  public update(snap: ComboSnapshot): void {
    if (snap.streak < 2) {
      if (this.container.visible) {
        this.scene.tweens.add({
          targets: this.container,
          alpha: 0,
          duration: dur.fast,
          ease: ease.out,
          onComplete: () => this.container.setVisible(false),
        });
      }
      this.lastTierShown = 1;
      return;
    }
    if (!this.container.visible) {
      this.container.setVisible(true);
      this.container.setAlpha(0);
      this.scene.tweens.add({
        targets: this.container,
        alpha: 1,
        duration: dur.fast,
        ease: ease.snap,
      });
    }

    // Redraw panel
    const w = 140;
    const h = 70;
    this.bg.clear();
    this.bg.fillStyle(palette.surface, 0.94);
    this.bg.fillRoundedRect(0, 0, w, h, 10);
    this.bg.lineStyle(1, palette.gold, 0.9);
    this.bg.strokeRoundedRect(0, 0, w, h, 10);
    this.bg.fillStyle(palette.gold, 1);
    this.bg.fillRoundedRect(0, 0, 3, h, 2);

    this.streakText.setText(`×${snap.streak}`);
    this.multText.setText(`COMBO  ${snap.multiplier.toFixed(1)}×`);

    // Decay bar
    const ratio = Math.max(0, Math.min(1, snap.timeLeftMs / 2200));
    this.progress.clear();
    this.progress.fillStyle(palette.gold, 0.9);
    this.progress.fillRoundedRect(6, h - 8, (w - 12) * ratio, 3, 2);

    // Pop on tier jump
    if (snap.multiplier > this.lastTierShown) {
      this.lastTierShown = snap.multiplier;
      this.scene.tweens.add({
        targets: this.container,
        scale: { from: 1.22, to: 1 },
        duration: dur.base,
        ease: ease.snap,
      });
    }
  }

  public destroy(): void {
    this.container.destroy();
  }
}
