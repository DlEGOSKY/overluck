import Phaser from "phaser";
import {
  applyLetterSpacing,
  drawOrnament,
  dur,
  ease,
  hex,
  palette,
  textStyle,
  type,
} from "./theme";

/**
 * Simple in-scene pause overlay. We avoid `scene.pause()` because it also
 * kills input handlers; instead the GameScene suspends its own update loop
 * via a `paused` flag while this modal is visible.
 */
export interface PauseOverlayActions {
  onResume: () => void;
  onSettings: () => void;
  onRestart: () => void;
}

export class PauseOverlay {
  private readonly scene: Phaser.Scene;
  private readonly worldWidth: number;
  private readonly worldHeight: number;
  private readonly actions: PauseOverlayActions;

  private root: Phaser.GameObjects.Container | null = null;

  public constructor(
    scene: Phaser.Scene,
    worldWidth: number,
    worldHeight: number,
    actions: PauseOverlayActions,
  ) {
    this.scene = scene;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.actions = actions;
  }

  public isOpen(): boolean {
    return this.root !== null;
  }

  public open(): void {
    if (this.root) return;

    const root = this.scene.add.container(0, 0);
    root.setDepth(400);
    this.root = root;

    const dim = this.scene.add.rectangle(0, 0, this.worldWidth, this.worldHeight, 0x000000, 0.72);
    dim.setOrigin(0, 0);
    dim.setInteractive();
    root.add(dim);

    const cx = this.worldWidth / 2;
    const cy = this.worldHeight / 2;

    const panelW = 420;
    const panelH = 320;
    const panel = this.scene.add.graphics();
    panel.fillStyle(palette.surface, 0.98);
    panel.fillRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 14);
    panel.lineStyle(1, palette.gold, 0.9);
    panel.strokeRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 14);
    root.add(panel);

    const eyebrow = this.scene.add.text(cx, cy - 120, "MESA EN PAUSA", textStyle(type.overline, { color: hex.primary }));
    eyebrow.setOrigin(0.5, 0.5);
    applyLetterSpacing(eyebrow, type.overline);
    root.add(eyebrow);

    const title = this.scene.add.text(cx, cy - 86, "PAUSA", textStyle(type.display, { color: hex.gold }));
    title.setOrigin(0.5, 0.5);
    applyLetterSpacing(title, type.display);
    root.add(title);

    const ornament = drawOrnament(this.scene, cx, cy - 52, 200);
    root.add(ornament);

    const btn = (y: number, label: string, cb: () => void) => {
      const w = 280;
      const h = 44;
      const bg = this.scene.add.graphics();
      const redraw = (hover: boolean): void => {
        bg.clear();
        bg.fillStyle(hover ? palette.gold : palette.bg, 0.95);
        bg.fillRoundedRect(cx - w / 2, y - h / 2, w, h, 10);
        bg.lineStyle(1, palette.gold, 0.9);
        bg.strokeRoundedRect(cx - w / 2, y - h / 2, w, h, 10);
      };
      redraw(false);
      const text = this.scene.add.text(cx, y, label, textStyle(type.overline, { color: hex.text }));
      text.setOrigin(0.5, 0.5);
      applyLetterSpacing(text, type.overline);
      const hit = this.scene.add.rectangle(cx, y, w, h, 0x000000, 0.001).setInteractive({ useHandCursor: true });
      hit.on("pointerover", () => {
        redraw(true);
        text.setColor(hex.textInverted);
      });
      hit.on("pointerout", () => {
        redraw(false);
        text.setColor(hex.text);
      });
      hit.on("pointerdown", () => cb());
      root.add([bg, text, hit]);
    };

    btn(cy + 0, "REANUDAR  ·  ESC", () => this.actions.onResume());
    btn(cy + 52, "AJUSTES", () => this.actions.onSettings());
    btn(cy + 104, "RETIRARSE  ·  R", () => this.actions.onRestart());

    root.setAlpha(0);
    this.scene.tweens.add({
      targets: root,
      alpha: 1,
      duration: dur.base,
      ease: ease.out,
    });
  }

  public close(): void {
    if (!this.root) return;
    const root = this.root;
    this.root = null;
    this.scene.tweens.add({
      targets: root,
      alpha: 0,
      duration: dur.fast,
      ease: ease.out,
      onComplete: () => root.destroy(),
    });
  }
}
