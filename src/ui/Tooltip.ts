import Phaser from "phaser";
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
 * Content payload for the tooltip. `lines` render stacked with the first
 * entry emphasized. Optional `accent` color is used on the left rail and on
 * the title text (falls back to gold).
 */
export interface TooltipPayload {
  title: string;
  subtitle?: string;
  body: string[];
  accent?: number;
}

/**
 * Singleton-ish tooltip that any interactive GameObject can drive via
 * `Tooltip.attach(obj, () => payload)`. Auto-follows the pointer with a
 * smart edge-flip so it never clips the viewport.
 */
export class Tooltip {
  private readonly scene: Phaser.Scene;
  private readonly worldWidth: number;
  private readonly worldHeight: number;
  private root: Phaser.GameObjects.Container | null = null;
  private currentOwner: Phaser.GameObjects.GameObject | null = null;

  public constructor(scene: Phaser.Scene, worldWidth: number, worldHeight: number) {
    this.scene = scene;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
  }

  /**
   * Bind hover handlers on the given interactive object. The provider is
   * called at hover-time so callers can return fresh data (e.g. costs).
   * Returns a disposer.
   */
  public attach<T extends Phaser.GameObjects.GameObject>(
    obj: T,
    provider: () => TooltipPayload | null,
  ): () => void {
    const over = (pointer: Phaser.Input.Pointer) => {
      const payload = provider();
      if (!payload) return;
      this.show(obj, payload, pointer.worldX, pointer.worldY);
    };
    const move = (pointer: Phaser.Input.Pointer) => {
      if (this.currentOwner !== obj) return;
      this.follow(pointer.worldX, pointer.worldY);
    };
    const out = () => {
      if (this.currentOwner !== obj) return;
      this.hide();
    };
    obj.on("pointerover", over);
    obj.on("pointermove", move);
    obj.on("pointerout", out);
    return () => {
      obj.off("pointerover", over);
      obj.off("pointermove", move);
      obj.off("pointerout", out);
    };
  }

  public show(
    owner: Phaser.GameObjects.GameObject,
    payload: TooltipPayload,
    x: number,
    y: number,
  ): void {
    this.currentOwner = owner;
    if (this.root) this.root.destroy();

    const accent = payload.accent ?? palette.gold;
    const padding = 12;
    const width = 260;

    const root = this.scene.add.container(0, 0);
    root.setDepth(1000);
    root.setAlpha(0);
    this.root = root;

    // Measure text heights to size the panel.
    const titleText = this.scene.add.text(padding + 6, padding, payload.title, textStyle(type.body, { color: hex.text }));
    titleText.setFontStyle("bold");

    let cursorY = padding + titleText.height + 4;
    let subtitleText: Phaser.GameObjects.Text | null = null;
    if (payload.subtitle) {
      subtitleText = this.scene.add.text(padding + 6, cursorY, payload.subtitle, textStyle(type.caption, { color: hex.textMuted }));
      applyLetterSpacing(subtitleText, type.caption);
      cursorY += subtitleText.height + 6;
    }

    const bodyTexts: Phaser.GameObjects.Text[] = [];
    for (const line of payload.body) {
      const t = this.scene.add.text(padding + 6, cursorY, line, textStyle(type.caption, { color: hex.textMuted, wordWrap: { width: width - padding * 2 - 8 } }));
      cursorY += t.height + 4;
      bodyTexts.push(t);
    }
    const height = cursorY + padding;

    // Background panel with left accent rail.
    const bg = this.scene.add.graphics();
    bg.fillStyle(palette.surface, 0.98);
    bg.fillRoundedRect(0, 0, width, height, 10);
    bg.lineStyle(1, accent, 0.9);
    bg.strokeRoundedRect(0, 0, width, height, 10);
    bg.fillStyle(accent, 1);
    bg.fillRoundedRect(0, 0, 3, height, 2);

    root.add(bg);
    root.add(titleText);
    titleText.setColor(toHexString(accent));
    if (subtitleText) root.add(subtitleText);
    for (const t of bodyTexts) root.add(t);

    this.scene.tweens.add({ targets: root, alpha: 1, duration: dur.fast, ease: ease.out });

    this.follow(x, y, width, height);
  }

  public hide(): void {
    this.currentOwner = null;
    if (!this.root) return;
    const r = this.root;
    this.root = null;
    this.scene.tweens.add({
      targets: r,
      alpha: 0,
      duration: dur.fast,
      ease: ease.out,
      onComplete: () => r.destroy(),
    });
  }

  private follow(x: number, y: number, overrideW?: number, overrideH?: number): void {
    if (!this.root) return;
    const bounds = this.root.getBounds();
    const w = overrideW ?? bounds.width;
    const h = overrideH ?? bounds.height;
    let nx = x + 16;
    let ny = y + 16;
    if (nx + w > this.worldWidth - 8) nx = x - w - 16;
    if (ny + h > this.worldHeight - 8) ny = y - h - 16;
    nx = Math.max(8, nx);
    ny = Math.max(8, ny);
    this.root.setPosition(nx, ny);
  }

  public destroy(): void {
    this.hide();
  }
}

function toHexString(c: number): string {
  return `#${c.toString(16).padStart(6, "0")}`;
}
