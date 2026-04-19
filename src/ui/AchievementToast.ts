import Phaser from "phaser";
import type { AchievementDefinition } from "@/data/achievements";
import { audio } from "@/systems/AudioManager";
import { applyLetterSpacing, dur, ease, hex, palette, textStyle, type } from "./theme";

/**
 * Slides in from the right whenever a new achievement unlocks. Multiple
 * pending toasts queue and animate one after another so they never overlap.
 */
export class AchievementToast {
  private readonly scene: Phaser.Scene;
  private readonly worldWidth: number;
  private queue: AchievementDefinition[] = [];
  private busy = false;

  public constructor(scene: Phaser.Scene, worldWidth: number) {
    this.scene = scene;
    this.worldWidth = worldWidth;
  }

  public push(def: AchievementDefinition): void {
    this.queue.push(def);
    if (!this.busy) this.consume();
  }

  private consume(): void {
    const next = this.queue.shift();
    if (!next) {
      this.busy = false;
      return;
    }
    this.busy = true;
    this.show(next, () => this.consume());
  }

  private show(def: AchievementDefinition, onDone: () => void): void {
    const w = 320;
    const h = 78;
    const margin = 18;
    const targetX = this.worldWidth - margin - w;
    const startX = this.worldWidth + 20;
    const y = 18;

    const container = this.scene.add.container(startX, y);
    container.setDepth(900);

    const bg = this.scene.add.graphics();
    bg.fillStyle(palette.surface, 0.97);
    bg.fillRoundedRect(0, 0, w, h, 12);
    bg.lineStyle(1, def.color, 0.95);
    bg.strokeRoundedRect(0, 0, w, h, 12);
    container.add(bg);

    const accent = this.scene.add.graphics();
    accent.fillStyle(def.color, 1);
    accent.fillRoundedRect(0, 0, 4, h, 2);
    container.add(accent);

    const eyebrow = this.scene.add.text(16, 12, "LOGRO DESBLOQUEADO", textStyle(type.caption, { color: hex.primary }));
    applyLetterSpacing(eyebrow, type.caption);
    container.add(eyebrow);

    const title = this.scene.add.text(16, 28, def.title, textStyle(type.body, { color: hex.text }));
    container.add(title);

    const flavor = this.scene.add.text(16, 50, def.flavor, textStyle(type.caption, { color: hex.textMuted }));
    flavor.setFontStyle("italic");
    container.add(flavor);

    this.scene.tweens.add({
      targets: container,
      x: targetX,
      duration: dur.base,
      ease: ease.snap,
    });
    audio.playAchievement();

    this.scene.time.delayedCall(2800, () => {
      this.scene.tweens.add({
        targets: container,
        x: startX,
        alpha: 0,
        duration: dur.base,
        ease: ease.out,
        onComplete: () => {
          container.destroy();
          onDone();
        },
      });
    });
  }
}
