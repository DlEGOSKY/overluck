import Phaser from "phaser";
import { applyLetterSpacing, dur, ease, hex, palette, textStyle, type } from "./theme";

/**
 * Non-intrusive hint bubble that points to a screen location. Slides in,
 * bounces gently, and auto-dismisses after a timeout or when dismiss() is
 * called. Meant for first-two-wave onboarding tips only.
 */
export class TutorialHint {
  private readonly scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container | null = null;

  public constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public show(text: string, x: number, y: number, durationMs = 6000): void {
    this.dismiss();
    const root = this.scene.add.container(x, y);
    root.setDepth(450);
    this.container = root;

    // Measure and build panel
    const padding = 10;
    const label = this.scene.add.text(padding + 4, padding, text, textStyle(type.body, { color: hex.text }));
    const arrowSize = 8;
    const w = label.width + padding * 2 + 8;
    const h = label.height + padding * 2;

    const bg = this.scene.add.graphics();
    bg.fillStyle(palette.surface, 0.96);
    bg.fillRoundedRect(-w / 2, -h - arrowSize, w, h, 8);
    bg.lineStyle(1, palette.gold, 0.9);
    bg.strokeRoundedRect(-w / 2, -h - arrowSize, w, h, 8);
    // Left accent rail
    bg.fillStyle(palette.gold, 1);
    bg.fillRoundedRect(-w / 2, -h - arrowSize + 6, 3, h - 12, 2);
    // Down arrow
    bg.fillStyle(palette.surface, 1);
    bg.beginPath();
    bg.moveTo(-arrowSize, -arrowSize);
    bg.lineTo(arrowSize, -arrowSize);
    bg.lineTo(0, 0);
    bg.closePath();
    bg.fillPath();

    label.setPosition(-w / 2 + padding + 4, -h - arrowSize + padding);
    applyLetterSpacing(label, type.body);

    root.add(bg);
    root.add(label);

    root.setAlpha(0);
    this.scene.tweens.add({ targets: root, alpha: 1, duration: dur.fast, ease: ease.out });
    this.scene.tweens.add({
      targets: root,
      y: y - 6,
      yoyo: true,
      repeat: -1,
      duration: 1400,
      ease: ease.inOut,
    });

    this.scene.time.delayedCall(durationMs, () => this.dismiss());
  }

  public dismiss(): void {
    if (!this.container) return;
    const c = this.container;
    this.container = null;
    this.scene.tweens.killTweensOf(c);
    this.scene.tweens.add({
      targets: c,
      alpha: 0,
      duration: dur.fast,
      ease: ease.out,
      onComplete: () => c.destroy(),
    });
  }
}
