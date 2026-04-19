import Phaser from "phaser";
import { audio } from "@/systems/AudioManager";
import { storage } from "@/systems/StorageManager";
import {
  applyLetterSpacing,
  drawOrnament,
  dur,
  ease,
  hex,
  palette,
  textStyle,
  type,
} from "@/ui/theme";

export class BootScene extends Phaser.Scene {
  private started = false;

  public constructor() {
    super({ key: "BootScene" });
  }

  public preload(): void {
    // No external assets. Everything is drawn with Graphics.
  }

  public create(): void {
    const { width, height } = this.scale;
    this.started = false;

    // Hydrate persisted audio settings before any SFX plays.
    const profile = storage.load();
    audio.applySettings(profile.settings);

    this.drawBackdrop(width, height);
    this.drawTitle(width, height);
    this.drawBottomBar(width, height);

    const advance = () => {
      audio.unlock();
      audio.playClick();
      this.startGame();
    };

    this.input.keyboard?.once("keydown", advance);
    this.input.once("pointerdown", advance);

    // Also unlock audio on any interaction (not just advance) to be safe
    const unlockOnce = () => audio.unlock();
    this.input.keyboard?.on("keydown", unlockOnce);
    this.input.on("pointerdown", unlockOnce);

    this.time.delayedCall(5200, advance);
  }

  private startGame(): void {
    if (this.started) return;
    this.started = true;

    this.cameras.main.fadeOut(320, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.start("MainMenuScene");
    });
  }

  private drawBackdrop(width: number, height: number): void {
    const bg = this.add.rectangle(0, 0, width, height, palette.bgDeep, 1);
    bg.setOrigin(0, 0);
    bg.setDepth(-10);

    const grad = this.add.graphics();
    grad.setDepth(-9);
    grad.fillGradientStyle(
      0x1a0a14,
      0x1a0a14,
      palette.bgDeep,
      palette.bgDeep,
      0.6,
      0.6,
      1,
      1,
    );
    grad.fillRect(0, 0, width, height);

    // Rays from center
    const rays = this.add.graphics();
    rays.setDepth(-8);
    rays.setPosition(width / 2, height / 2);
    for (let i = 0; i < 16; i += 1) {
      const angle = (Math.PI * 2 * i) / 16;
      rays.fillStyle(palette.primary, 0.035);
      rays.beginPath();
      rays.moveTo(0, 0);
      rays.lineTo(Math.cos(angle - 0.06) * 900, Math.sin(angle - 0.06) * 900);
      rays.lineTo(Math.cos(angle + 0.06) * 900, Math.sin(angle + 0.06) * 900);
      rays.closePath();
      rays.fillPath();
    }
    this.tweens.add({
      targets: rays,
      rotation: Math.PI * 2,
      duration: 140000,
      repeat: -1,
    });

    // Vignette
    const vignette = this.add.graphics();
    vignette.setDepth(80);
    const steps = 6;
    for (let i = 0; i < steps; i += 1) {
      const alpha = 0.05 * (i + 1);
      const pad = 100 - i * 14;
      vignette.fillStyle(0x000000, alpha);
      vignette.fillRect(0, 0, width, pad);
      vignette.fillRect(0, height - pad, width, pad);
      vignette.fillRect(0, 0, pad, height);
      vignette.fillRect(width - pad, 0, pad, height);
    }
  }

  private drawTitle(width: number, height: number): void {
    const cx = width / 2;
    const cy = height / 2 - 40;

    const eyebrow = this.add.text(cx, cy - 76, "TOWER DEFENSE · ROGUELITE", textStyle(type.overline, { color: hex.primary }));
    eyebrow.setOrigin(0.5, 0.5);
    applyLetterSpacing(eyebrow, type.overline);

    // Big title
    const title = this.add.text(cx, cy, "OVERLUCK", {
      fontFamily:
        '"Inter", "SF Pro Text", "Segoe UI", system-ui, -apple-system, sans-serif',
      fontSize: "84px",
      color: hex.primary,
      fontStyle: "bold",
    });
    title.setOrigin(0.5, 0.5);
    title.setLetterSpacing(10);

    // Shadow copy behind
    const shadow = this.add.text(cx + 4, cy + 6, "OVERLUCK", {
      fontFamily:
        '"Inter", "SF Pro Text", "Segoe UI", system-ui, -apple-system, sans-serif',
      fontSize: "84px",
      color: "#1a0a14",
      fontStyle: "bold",
    });
    shadow.setOrigin(0.5, 0.5);
    shadow.setLetterSpacing(10);
    shadow.setDepth(-1);
    title.setDepth(0);

    const ornament = drawOrnament(this, cx, cy + 60, 260);

    const tagline = this.add.text(
      cx,
      cy + 92,
      "La mesa siempre cobra.",
      textStyle(type.h3, { color: hex.textMuted }),
    );
    tagline.setOrigin(0.5, 0.5);
    applyLetterSpacing(tagline, type.h3);

    // Entrance
    for (const el of [eyebrow, title, shadow, tagline]) {
      el.setAlpha(0);
    }
    ornament.setAlpha(0);

    this.tweens.add({
      targets: [eyebrow],
      alpha: 1,
      y: "+=4",
      duration: dur.base,
      ease: ease.out,
      delay: 160,
    });
    this.tweens.add({
      targets: [title, shadow],
      alpha: 1,
      y: "+=4",
      duration: dur.slow,
      ease: ease.snap,
      delay: 280,
    });
    this.tweens.add({
      targets: ornament,
      alpha: 1,
      duration: dur.base,
      ease: ease.out,
      delay: 700,
    });
    this.tweens.add({
      targets: tagline,
      alpha: 1,
      y: "+=4",
      duration: dur.base,
      ease: ease.out,
      delay: 820,
    });

    // Subtle breathing
    this.tweens.add({
      targets: title,
      alpha: { from: 1, to: 0.92 },
      yoyo: true,
      repeat: -1,
      duration: 2400,
      ease: ease.inOut,
      delay: 1400,
    });
  }

  private drawBottomBar(width: number, height: number): void {
    const prompt = this.add.text(
      width / 2,
      height - 80,
      "PRESIONA CUALQUIER TECLA  ·  O HAZ CLICK",
      textStyle(type.overline, { color: hex.primary }),
    );
    prompt.setOrigin(0.5, 0.5);
    applyLetterSpacing(prompt, type.overline);
    prompt.setAlpha(0);

    this.tweens.add({
      targets: prompt,
      alpha: { from: 0, to: 1 },
      duration: dur.base,
      delay: 1200,
      ease: ease.out,
      onComplete: () => {
        this.tweens.add({
          targets: prompt,
          alpha: { from: 1, to: 0.45 },
          yoyo: true,
          repeat: -1,
          duration: 800,
          ease: ease.inOut,
        });
      },
    });

    const credit = this.add.text(
      width / 2,
      height - 44,
      "un prototipo de casino al final del mundo",
      textStyle(type.caption, { color: hex.textDim }),
    );
    credit.setOrigin(0.5, 0.5);
    credit.setAlpha(0);
    this.tweens.add({
      targets: credit,
      alpha: 1,
      duration: dur.base,
      delay: 1400,
      ease: ease.out,
    });
  }
}
