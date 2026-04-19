import Phaser from "phaser";
import type { BossPhaseDefinition } from "@/types";
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
} from "./theme";

/**
 * Dramatic boss HP bar anchored to the top of the screen, plus phase callout
 * cards. Owned by GameScene; events are pushed in via setters.
 *
 * Visual layers (bottom to top):
 *   1. Dim backdrop strip under the bar.
 *   2. Twin gold ornaments at both ends.
 *   3. HP fill with phase-tinted gradient + vignette at low HP.
 *   4. Invulnerability overlay (shimmer) when shield pulse is active.
 *   5. Boss name + current phase label.
 */
export class BossHpOverlay {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly strip: Phaser.GameObjects.Graphics;
  private readonly barBg: Phaser.GameObjects.Graphics;
  private readonly barFill: Phaser.GameObjects.Graphics;
  private readonly barRim: Phaser.GameObjects.Graphics;
  private readonly shimmer: Phaser.GameObjects.Graphics;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly phaseText: Phaser.GameObjects.Text;
  private readonly hpNumberText: Phaser.GameObjects.Text;
  private readonly leftOrnament: Phaser.GameObjects.Graphics;
  private readonly rightOrnament: Phaser.GameObjects.Graphics;

  private readonly barLeft: number;
  private readonly barRight: number;
  private readonly barY: number;
  private readonly barHeight = 14;

  private visible = false;
  private currentHpRatio = 0;
  private targetHpRatio = 0;
  private currentColor = 0xc04090;
  private pulseTween: Phaser.Tweens.Tween | null = null;

  public constructor(scene: Phaser.Scene, worldWidth: number) {
    this.scene = scene;

    const margin = 120;
    this.barLeft = margin;
    this.barRight = worldWidth - margin;
    this.barY = 84; // Just below the top HUD panel.

    this.root = scene.add.container(0, 0);
    this.root.setDepth(150);
    this.root.setVisible(false);
    this.root.setAlpha(0);

    this.strip = scene.add.graphics();
    this.strip.fillStyle(palette.bgDeep, 0.65);
    this.strip.fillRect(0, this.barY - 34, worldWidth, 58);
    this.root.add(this.strip);

    this.leftOrnament = drawOrnament(scene, this.barLeft - 36, this.barY, 40);
    this.rightOrnament = drawOrnament(scene, this.barRight + 36, this.barY, 40);
    this.root.add([this.leftOrnament, this.rightOrnament]);

    this.barBg = scene.add.graphics();
    this.root.add(this.barBg);

    this.barFill = scene.add.graphics();
    this.root.add(this.barFill);

    this.barRim = scene.add.graphics();
    this.root.add(this.barRim);

    this.shimmer = scene.add.graphics();
    this.shimmer.setVisible(false);
    this.root.add(this.shimmer);

    this.nameText = scene.add.text(this.barLeft, this.barY - 22, "", textStyle(type.overline, { color: hex.textMuted }));
    applyLetterSpacing(this.nameText, type.overline);
    this.root.add(this.nameText);

    this.phaseText = scene.add.text(this.barLeft, this.barY + 14, "", textStyle(type.overline, { color: hex.primary }));
    applyLetterSpacing(this.phaseText, type.overline);
    this.root.add(this.phaseText);

    this.hpNumberText = scene.add.text(this.barRight, this.barY - 22, "", textStyle(type.overline, { color: hex.text }));
    this.hpNumberText.setOrigin(1, 0);
    applyLetterSpacing(this.hpNumberText, type.overline);
    this.root.add(this.hpNumberText);

    this.drawBarChrome();
  }

  public show(bossName: string, initialColor: number): void {
    this.visible = true;
    this.currentColor = initialColor;
    this.nameText.setText(bossName.toUpperCase());
    this.currentHpRatio = 1;
    this.targetHpRatio = 1;
    this.root.setVisible(true);
    this.scene.tweens.add({
      targets: this.root,
      alpha: { from: 0, to: 1 },
      duration: dur.slow,
      ease: ease.out,
    });
    this.drawFill();
  }

  public hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.scene.tweens.add({
      targets: this.root,
      alpha: { from: this.root.alpha, to: 0 },
      duration: dur.base,
      ease: ease.out,
      onComplete: () => this.root.setVisible(false),
    });
    if (this.pulseTween) {
      this.pulseTween.stop();
      this.pulseTween = null;
    }
    this.shimmer.setVisible(false);
  }

  public setHp(ratio: number, hp: number, maxHp: number): void {
    this.targetHpRatio = Phaser.Math.Clamp(ratio, 0, 1);
    this.hpNumberText.setText(`${Math.max(0, Math.round(hp))} / ${maxHp}`);
  }

  public setPhase(phase: BossPhaseDefinition): void {
    this.phaseText.setText(phase.label);
    this.phaseText.setColor(colorToHex(phase.color));
    this.currentColor = phase.color;
  }

  public triggerShieldPulse(durationMs: number): void {
    this.shimmer.setVisible(true);
    this.shimmer.clear();
    this.shimmer.fillStyle(0xffd166, 0.35);
    this.shimmer.fillRect(
      this.barLeft - 2,
      this.barY - this.barHeight / 2 - 2,
      this.barRight - this.barLeft + 4,
      this.barHeight + 4,
    );
    this.scene.tweens.add({
      targets: this.shimmer,
      alpha: { from: 1, to: 0 },
      duration: durationMs,
      ease: "Sine.InOut",
      onComplete: () => this.shimmer.setVisible(false),
    });
  }

  public pulseDamage(): void {
    if (this.pulseTween) return;
    this.pulseTween = this.scene.tweens.add({
      targets: this.barRim,
      alpha: { from: 1, to: 0.6 },
      yoyo: true,
      duration: 90,
      onComplete: () => {
        this.pulseTween = null;
      },
    });
  }

  public update(_deltaMs: number): void {
    if (!this.visible) return;
    // Smooth HP lerp for cinematic draining.
    if (Math.abs(this.currentHpRatio - this.targetHpRatio) > 0.0005) {
      this.currentHpRatio += (this.targetHpRatio - this.currentHpRatio) * 0.12;
      this.drawFill();
    } else if (this.currentHpRatio !== this.targetHpRatio) {
      this.currentHpRatio = this.targetHpRatio;
      this.drawFill();
    }
  }

  private drawBarChrome(): void {
    const w = this.barRight - this.barLeft;
    const h = this.barHeight;

    this.barBg.clear();
    this.barBg.fillStyle(palette.bg, 0.95);
    this.barBg.fillRect(this.barLeft, this.barY - h / 2, w, h);
    this.barBg.lineStyle(1, palette.hairline, 0.8);
    this.barBg.strokeRect(this.barLeft, this.barY - h / 2, w, h);

    this.barRim.clear();
    this.barRim.lineStyle(2, palette.gold, 0.85);
    this.barRim.strokeRect(this.barLeft - 3, this.barY - h / 2 - 3, w + 6, h + 6);
  }

  private drawFill(): void {
    const w = this.barRight - this.barLeft;
    const h = this.barHeight;
    const fillWidth = w * this.currentHpRatio;

    this.barFill.clear();
    // Main fill
    this.barFill.fillStyle(this.currentColor, 1);
    this.barFill.fillRect(this.barLeft, this.barY - h / 2, fillWidth, h);
    // Inner gloss
    this.barFill.fillStyle(0xffffff, 0.12);
    this.barFill.fillRect(this.barLeft, this.barY - h / 2, fillWidth, h / 3);
    // Leading edge highlight
    if (fillWidth > 4) {
      this.barFill.fillStyle(0xffffff, 0.55);
      this.barFill.fillRect(this.barLeft + fillWidth - 2, this.barY - h / 2, 2, h);
    }
  }
}

/**
 * Fullscreen phase callout — big title + flavor + ornament, briefly freezes
 * the gameplay feel with a time-bullet slow.
 */
export class PhaseCallout {
  private readonly scene: Phaser.Scene;
  private readonly worldWidth: number;
  private readonly worldHeight: number;

  public constructor(scene: Phaser.Scene, worldWidth: number, worldHeight: number) {
    this.scene = scene;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
  }

  public show(phase: BossPhaseDefinition): void {
    const cx = this.worldWidth / 2;
    const cy = this.worldHeight / 2 - 20;

    const dim = this.scene.add.rectangle(0, 0, this.worldWidth, this.worldHeight, 0x000000, 0.0);
    dim.setOrigin(0, 0);
    dim.setDepth(180);

    this.scene.tweens.add({
      targets: dim,
      alpha: 0.45,
      duration: 140,
      yoyo: true,
      hold: 520,
      onComplete: () => dim.destroy(),
    });

    const title = this.scene.add.text(cx, cy, phase.label, textStyle(type.display, { color: colorToHex(phase.color) }));
    title.setOrigin(0.5, 0.5);
    title.setDepth(181);
    applyLetterSpacing(title, type.display);
    title.setAlpha(0);
    title.setScale(0.96);

    const flavor = this.scene.add.text(cx, cy + 48, phase.flavor, textStyle(type.caption, { color: hex.textMuted }));
    flavor.setOrigin(0.5, 0.5);
    flavor.setDepth(181);
    applyLetterSpacing(flavor, type.caption);
    flavor.setAlpha(0);
    flavor.setFontStyle("italic");

    const ornament = drawOrnament(this.scene, cx, cy + 22, 220);
    ornament.setDepth(181);
    ornament.setAlpha(0);

    this.scene.tweens.add({
      targets: [title, flavor, ornament],
      alpha: 1,
      duration: 200,
      ease: ease.out,
    });
    this.scene.tweens.add({
      targets: title,
      scale: 1,
      duration: 220,
      ease: "Back.Out",
    });

    this.scene.time.delayedCall(1400, () => {
      this.scene.tweens.add({
        targets: [title, flavor, ornament],
        alpha: 0,
        duration: 260,
        ease: "Quad.In",
        onComplete: () => {
          title.destroy();
          flavor.destroy();
          ornament.destroy();
        },
      });
    });

    // Tiny camera kick + slow-mo feel.
    this.scene.cameras.main.shake(160, 0.003);
    this.scene.cameras.main.flash(80, 255, 255, 255, false);
  }
}
