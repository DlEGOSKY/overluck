import Phaser from "phaser";
import { MAP_HEIGHT, MAP_WIDTH } from "@/data/path";
import { audio } from "@/systems/AudioManager";
import type { UnlockDefinition } from "@/types";
import {
  applyLetterSpacing,
  colorToHex,
  drawOrnament,
  dur,
  ease,
  hex,
  palette,
  textStyle,
  type,
} from "@/ui/theme";

export interface UnlockSceneData {
  unlocks: readonly UnlockDefinition[];
  onResolved: () => void;
}

/**
 * Dramatic celebratory modal. Shows each newly-unlocked piece stacked
 * vertically with a staggered entrance. A single confirm button dismisses
 * the modal; keyboard ENTER works too.
 */
export class UnlockScene extends Phaser.Scene {
  private payload!: UnlockSceneData;
  private resolved = false;

  public constructor() {
    super({ key: "UnlockScene" });
  }

  public init(data: UnlockSceneData): void {
    this.payload = data;
    this.resolved = false;
  }

  public create(): void {
    this.drawBackdrop();
    this.drawHeader();
    this.drawCards();
    this.drawConfirm();

    this.input.keyboard?.once("keydown-ENTER", () => this.finish());
    this.input.keyboard?.once("keydown-SPACE", () => this.finish());
    this.input.keyboard?.once("keydown-ESC", () => this.finish());
  }

  private drawBackdrop(): void {
    const dim = this.add.rectangle(0, 0, MAP_WIDTH, MAP_HEIGHT, 0x000000, 0.82);
    dim.setOrigin(0, 0);
    dim.setDepth(0);

    // Vertical gold shaft of light (cheap radial gradient fake).
    const shaft = this.add.graphics();
    shaft.setDepth(1);
    shaft.fillGradientStyle(palette.gold, palette.gold, palette.bgDeep, palette.bgDeep, 0.08, 0.08, 0, 0);
    shaft.fillRect(MAP_WIDTH / 2 - 260, 0, 520, MAP_HEIGHT);
  }

  private drawHeader(): void {
    const cx = MAP_WIDTH / 2;
    const eyebrow = this.add.text(cx, 90, "LA CASA TE CONOCE", textStyle(type.overline, { color: hex.primary }));
    eyebrow.setOrigin(0.5, 0.5);
    eyebrow.setDepth(10);
    applyLetterSpacing(eyebrow, type.overline);

    const headline = this.add.text(cx, 136, "DESBLOQUEADO", textStyle(type.display, { color: hex.gold }));
    headline.setOrigin(0.5, 0.5);
    headline.setDepth(10);
    applyLetterSpacing(headline, type.display);

    const ornament = drawOrnament(this, cx, 170, 260);
    ornament.setDepth(10);

    for (const el of [eyebrow, headline, ornament]) {
      el.setAlpha(0);
      this.tweens.add({ targets: el, alpha: 1, duration: dur.base, delay: 80, ease: ease.out });
    }

    audio.playReward();
    this.cameras.main.flash(180, 255, 209, 102, false);
  }

  private drawCards(): void {
    const cx = MAP_WIDTH / 2;
    const cardW = 520;
    const cardH = 86;
    const gap = 14;
    const totalH = this.payload.unlocks.length * (cardH + gap);
    const startY = MAP_HEIGHT / 2 - totalH / 2 + 20;

    this.payload.unlocks.forEach((unlock, i) => {
      const y = startY + i * (cardH + gap);
      this.spawnCard(unlock, cx, y, cardW, cardH, i);
    });
  }

  private spawnCard(
    unlock: UnlockDefinition,
    cx: number,
    y: number,
    w: number,
    h: number,
    index: number,
  ): void {
    const container = this.add.container(cx, y + 18);
    container.setDepth(20);
    container.setAlpha(0);

    const bg = this.add.graphics();
    bg.fillStyle(palette.surface, 0.95);
    bg.fillRoundedRect(-w / 2, 0, w, h, 10);
    bg.lineStyle(1, unlock.color, 0.9);
    bg.strokeRoundedRect(-w / 2, 0, w, h, 10);
    // Left accent bar
    bg.fillStyle(unlock.color, 1);
    bg.fillRect(-w / 2 + 2, 4, 4, h - 8);
    container.add(bg);

    // Kind pill
    const kindLabel =
      unlock.kind === "tower" ? "TORRE" : unlock.kind === "relic" ? "RELIQUIA" : unlock.kind === "scene" ? "ESCENA" : "CONTENIDO";
    const pillW = 80;
    const pillBg = this.add.graphics();
    pillBg.fillStyle(unlock.color, 0.92);
    pillBg.fillRoundedRect(w / 2 - pillW - 14, 12, pillW, 20, 4);
    container.add(pillBg);
    const pillText = this.add.text(w / 2 - pillW / 2 - 14, 22, kindLabel, textStyle(type.overline, { color: hex.textInverted }));
    pillText.setOrigin(0.5, 0.5);
    applyLetterSpacing(pillText, type.overline);
    container.add(pillText);

    const name = this.add.text(-w / 2 + 20, 16, unlock.displayName, textStyle(type.h2, { color: colorToHex(unlock.color) }));
    applyLetterSpacing(name, type.h2);
    container.add(name);

    const desc = this.add.text(-w / 2 + 20, 44, unlock.description, textStyle(type.body, { color: hex.text }));
    container.add(desc);

    const flavor = this.add.text(-w / 2 + 20, 64, `"${unlock.flavor}"`, textStyle(type.caption, { color: hex.textMuted }));
    flavor.setFontStyle("italic");
    container.add(flavor);

    this.tweens.add({
      targets: container,
      alpha: 1,
      y: y,
      duration: dur.slow,
      delay: 280 + index * 140,
      ease: ease.snap,
    });
    this.time.delayedCall(280 + index * 140, () => audio.playClick());
  }

  private drawConfirm(): void {
    const x = MAP_WIDTH / 2;
    const y = MAP_HEIGHT - 72;
    const w = 260;
    const h = 44;

    const bg = this.add.graphics();
    bg.setDepth(30);
    bg.fillStyle(palette.primary, 0.95);
    bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 10);
    bg.lineStyle(1, palette.gold, 0.95);
    bg.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 10);

    const label = this.add.text(x, y, "CONTINUAR  ·  ENTER", textStyle(type.overline, { color: hex.textInverted }));
    label.setOrigin(0.5, 0.5);
    label.setDepth(31);
    applyLetterSpacing(label, type.overline);

    const hit = this.add.rectangle(x, y, w, h, 0x000000, 0.001);
    hit.setDepth(32);
    hit.setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => this.finish());
    hit.on("pointerover", () => {
      bg.clear();
      bg.fillStyle(palette.gold, 0.95);
      bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 10);
      bg.lineStyle(1, palette.gold, 1);
      bg.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 10);
    });
    hit.on("pointerout", () => {
      bg.clear();
      bg.fillStyle(palette.primary, 0.95);
      bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 10);
      bg.lineStyle(1, palette.gold, 0.95);
      bg.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 10);
    });

    bg.setAlpha(0);
    label.setAlpha(0);
    this.tweens.add({ targets: [bg, label], alpha: 1, duration: dur.base, delay: 480, ease: ease.out });
  }

  private finish(): void {
    if (this.resolved) return;
    this.resolved = true;
    audio.playClick();
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.payload.onResolved();
      this.scene.stop();
    });
  }
}
