import Phaser from "phaser";
import { MAP_HEIGHT, MAP_WIDTH } from "@/data/path";
import { UNLOCKS } from "@/data/unlocks";
import { audio } from "@/systems/AudioManager";
import { storage } from "@/systems/StorageManager";
import { SettingsOverlay } from "@/ui/SettingsOverlay";
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

/**
 * Landing page shown after Boot. Displays:
 *   - title with ornate framing,
 *   - profile summary (best wave, runs, kills, chips),
 *   - next-unlock tracker (first three unclaimed progress bars),
 *   - JUGAR / AJUSTES / REINICIAR PERFIL buttons.
 *
 * Settings are opened as an overlay over this scene; restart wipes the
 * profile after a simple double-click-to-confirm guard.
 */
export class MainMenuScene extends Phaser.Scene {
  private settingsOverlay!: SettingsOverlay;
  private resetArmed = false;
  private resetButton: { bg: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text; redraw: (armed: boolean) => void } | null = null;

  // Particle motes animated in the background
  private motes: Phaser.GameObjects.Arc[] = [];

  public constructor() {
    super({ key: "MainMenuScene" });
  }

  public create(): void {
    // Hydrate audio settings in case the user opened settings here.
    audio.applySettings(storage.load().settings);

    this.drawBackdrop();
    this.drawMotes();
    this.drawHeader();
    this.drawProfileCard();
    this.drawUnlockTracker();
    this.drawButtons();

    this.settingsOverlay = new SettingsOverlay(this, MAP_WIDTH, MAP_HEIGHT, () => {});

    this.input.keyboard?.on("keydown-ENTER", () => this.startRun());
    this.input.keyboard?.on("keydown-SPACE", () => this.startRun());
    this.input.keyboard?.on("keydown-ESC", () => {
      if (this.settingsOverlay.isOpen()) this.settingsOverlay.close();
    });

    this.cameras.main.fadeIn(320, 0, 0, 0);
  }

  public update(_time: number, deltaMs: number): void {
    // Gentle upward drift for background motes.
    for (const m of this.motes) {
      m.y -= deltaMs * 0.015 * (m.getData("speed") as number);
      if (m.y < -10) {
        m.y = MAP_HEIGHT + 10;
        m.x = Math.random() * MAP_WIDTH;
      }
    }
  }

  // --- Visuals --------------------------------------------------------------

  private drawBackdrop(): void {
    const bg = this.add.rectangle(0, 0, MAP_WIDTH, MAP_HEIGHT, palette.bgDeep, 1).setOrigin(0, 0);
    bg.setDepth(-10);

    const grad = this.add.graphics();
    grad.setDepth(-9);
    grad.fillGradientStyle(0x1a0a14, 0x1a0a14, palette.bgDeep, palette.bgDeep, 0.55, 0.55, 1, 1);
    grad.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

    // Radial vignette
    const vig = this.add.graphics();
    vig.setDepth(-7);
    vig.fillStyle(0x000000, 0.55);
    vig.fillRect(0, 0, MAP_WIDTH, 120);
    vig.fillRect(0, MAP_HEIGHT - 120, MAP_WIDTH, 120);
  }

  private drawMotes(): void {
    for (let i = 0; i < 40; i += 1) {
      const x = Math.random() * MAP_WIDTH;
      const y = Math.random() * MAP_HEIGHT;
      const radius = 1 + Math.random() * 2;
      const alpha = 0.25 + Math.random() * 0.5;
      const m = this.add.circle(x, y, radius, palette.gold, alpha);
      m.setDepth(-6);
      m.setData("speed", 0.6 + Math.random() * 1.4);
      this.motes.push(m);
    }
  }

  private drawHeader(): void {
    const cx = MAP_WIDTH / 2;
    const eyebrow = this.add.text(cx, 80, "TOWER DEFENSE · ROGUELITE", textStyle(type.overline, { color: hex.primary }));
    eyebrow.setOrigin(0.5, 0.5);
    applyLetterSpacing(eyebrow, type.overline);

    const title = this.add.text(cx, 138, "OVERLUCK", textStyle(type.display, { color: hex.gold }));
    title.setOrigin(0.5, 0.5);
    applyLetterSpacing(title, type.display);

    const ornament = drawOrnament(this, cx, 180, 320);
    ornament.setAlpha(0);
    this.tweens.add({ targets: ornament, alpha: 1, duration: dur.slow, ease: ease.out });

    // Subtle title pulse
    this.tweens.add({
      targets: title,
      scale: { from: 1, to: 1.015 },
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: ease.inOut,
    });
  }

  private drawProfileCard(): void {
    const profile = storage.load();
    const cx = MAP_WIDTH / 2;
    const top = 230;
    const w = 720;
    const h = 150;
    const x = cx - w / 2;

    const bg = this.add.graphics();
    bg.fillStyle(palette.surface, 0.94);
    bg.fillRoundedRect(x, top, w, h, 14);
    bg.lineStyle(1, palette.gold, 0.9);
    bg.strokeRoundedRect(x, top, w, h, 14);

    const header = this.add.text(x + 24, top + 16, "HISTORIAL DEL JUGADOR", textStyle(type.overline, { color: hex.primary }));
    applyLetterSpacing(header, type.overline);

    const stats: { label: string; value: string }[] = [
      { label: "RUNS GANADAS", value: `${profile.runsWon} / ${profile.runsPlayed}` },
      { label: "OLA MÁXIMA", value: `${profile.highestWaveCleared}` },
      { label: "ENEMIGOS CAÍDOS", value: `${profile.totalKills}` },
      { label: "FICHAS TOTALES", value: `${profile.totalChipsEarned}` },
      { label: "PACTOS", value: `${profile.modifiersAccepted}` },
      { label: "MINIJUEGOS", value: `${profile.slotsPlayed + profile.roulettePlayed + profile.cardsPlayed}` },
    ];
    const colW = w / stats.length;
    stats.forEach((s, i) => {
      const sx = x + i * colW + colW / 2;
      const sy = top + 70;
      const label = this.add.text(sx, sy, s.label, textStyle(type.caption, { color: hex.textMuted }));
      label.setOrigin(0.5, 0.5);
      applyLetterSpacing(label, type.caption);
      const value = this.add.text(sx, sy + 26, s.value, textStyle(type.h2, { color: hex.text }));
      value.setOrigin(0.5, 0.5);
      applyLetterSpacing(value, type.h2);
    });
  }

  private drawUnlockTracker(): void {
    const profile = storage.load();
    const pending = UNLOCKS.filter((u) => !profile.unlocks.includes(u.id)).slice(0, 3);

    const cx = MAP_WIDTH / 2;
    const top = 400;
    const w = 720;
    const x = cx - w / 2;

    const header = this.add.text(x, top, pending.length > 0 ? "PRÓXIMOS DESBLOQUEOS" : "TODO DESBLOQUEADO", textStyle(type.overline, { color: hex.primary }));
    applyLetterSpacing(header, type.overline);

    if (pending.length === 0) {
      const done = this.add.text(x, top + 28, "La casa no tiene más secretos para ti.", textStyle(type.body, { color: hex.textMuted }));
      done.setFontStyle("italic");
      return;
    }

    pending.forEach((u, i) => {
      const rowY = top + 36 + i * 54;
      const row = this.add.graphics();
      row.fillStyle(palette.surface, 0.85);
      row.fillRoundedRect(x, rowY, w, 44, 10);
      row.lineStyle(1, u.color, 0.6);
      row.strokeRoundedRect(x, rowY, w, 44, 10);

      const dot = this.add.circle(x + 20, rowY + 22, 5, u.color, 1);
      dot.setStrokeStyle(1, 0xffffff, 0.6);
      void dot;

      const name = this.add.text(x + 38, rowY + 8, u.displayName, textStyle(type.body, { color: hex.text }));
      const flavor = this.add.text(x + 38, rowY + 26, u.flavor, textStyle(type.caption, { color: hex.textMuted }));
      flavor.setFontStyle("italic");
      void name;
      void flavor;

      // Progress bar
      const prog = u.progress?.(profile);
      if (prog) {
        const barX = x + w - 200;
        const barW = 180;
        const barY = rowY + 18;
        const ratio = Math.max(0, Math.min(1, prog.current / prog.target));
        const bar = this.add.graphics();
        bar.fillStyle(palette.bg, 1);
        bar.fillRoundedRect(barX, barY, barW, 8, 4);
        bar.lineStyle(1, palette.hairline, 0.9);
        bar.strokeRoundedRect(barX, barY, barW, 8, 4);
        bar.fillStyle(u.color, 1);
        bar.fillRoundedRect(barX, barY, barW * ratio, 8, 4);

        const label = this.add.text(barX + barW, barY - 16, `${prog.current} / ${prog.target}`, textStyle(type.overline, { color: hex.textMuted }));
        label.setOrigin(1, 0);
        applyLetterSpacing(label, type.overline);
      }
    });
  }

  private drawButtons(): void {
    const cx = MAP_WIDTH / 2;
    const y = MAP_HEIGHT - 110;

    this.makeButton(cx - 200, y, 180, 48, "JUGAR  ·  ENTER", palette.primary, hex.textInverted, () => this.startRun());
    this.makeButton(cx, y, 180, 48, "AJUSTES", palette.surface, hex.text, () => this.settingsOverlay.open());
    this.resetButton = this.makeButton(cx + 200, y, 180, 48, "REINICIAR", palette.surface, hex.textMuted, () => this.tryReset());
  }

  private makeButton(
    cx: number,
    cy: number,
    w: number,
    h: number,
    label: string,
    fillColor: number,
    textColor: string,
    onClick: () => void,
  ) {
    const bg = this.add.graphics();
    const text = this.add.text(cx, cy, label, textStyle(type.overline, { color: textColor }));
    text.setOrigin(0.5, 0.5);
    applyLetterSpacing(text, type.overline);

    const redraw = (hover: boolean): void => {
      bg.clear();
      bg.fillStyle(hover ? palette.gold : fillColor, 0.95);
      bg.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 10);
      bg.lineStyle(1, palette.gold, 0.9);
      bg.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 10);
    };
    redraw(false);

    const hit = this.add.rectangle(cx, cy, w, h, 0x000000, 0.001).setInteractive({ useHandCursor: true });
    hit.on("pointerover", () => {
      redraw(true);
      text.setColor(hex.textInverted);
    });
    hit.on("pointerout", () => {
      redraw(false);
      text.setColor(textColor);
    });
    hit.on("pointerdown", () => onClick());

    return { bg, text, redraw };
  }

  private tryReset(): void {
    if (!this.resetArmed) {
      this.resetArmed = true;
      this.resetButton?.text.setText("CONFIRMAR  ·  CLICK");
      this.resetButton?.text.setColor(hex.danger);
      this.time.delayedCall(2400, () => {
        if (!this.resetArmed) return;
        this.resetArmed = false;
        this.resetButton?.text.setText("REINICIAR");
        this.resetButton?.text.setColor(hex.textMuted);
      });
      audio.playClick();
      return;
    }
    this.resetArmed = false;
    storage.reset();
    audio.applySettings(storage.load().settings);
    audio.playGameOver();
    this.cameras.main.flash(200, 255, 60, 80, false);
    this.scene.restart();
  }

  private startRun(): void {
    audio.playClick();
    this.cameras.main.fadeOut(260, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("GameScene"));
  }
}
