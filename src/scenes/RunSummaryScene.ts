import Phaser from "phaser";
import { MAP_HEIGHT, MAP_WIDTH } from "@/data/path";
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
import type { RunHistoryEntry } from "@/types";

/**
 * Cinematic run-end recap. Shown after either VICTORY or GAME OVER, in lieu
 * of the previous inline ending card. Compares the just-finished run against
 * the player's profile bests and offers REINTENTAR / MENU buttons.
 */
export interface RunSummaryData {
  entry: RunHistoryEntry;
  flavor?: string;
  runCode?: string;
  seed?: number;
}

export class RunSummaryScene extends Phaser.Scene {
  private payload!: RunSummaryData;

  public constructor() {
    super({ key: "RunSummaryScene" });
  }

  public init(data: RunSummaryData): void {
    this.payload = data;
  }

  public create(): void {
    const profile = storage.load();
    const { entry } = this.payload;

    const bg = this.add.rectangle(0, 0, MAP_WIDTH, MAP_HEIGHT, 0x000000, 0).setOrigin(0, 0);
    bg.setDepth(0);
    this.tweens.add({ targets: bg, fillAlpha: 0.78, duration: dur.slow, ease: ease.out });

    const cx = MAP_WIDTH / 2;
    const panelW = 760;
    const panelH = 480;
    const panelTop = (MAP_HEIGHT - panelH) / 2;

    const panel = this.add.graphics();
    panel.setDepth(1);
    panel.fillStyle(palette.surface, 0.97);
    panel.fillRoundedRect(cx - panelW / 2, panelTop, panelW, panelH, 18);
    const accent = entry.won ? palette.gold : palette.danger;
    panel.lineStyle(2, accent, 0.9);
    panel.strokeRoundedRect(cx - panelW / 2, panelTop, panelW, panelH, 18);
    panel.setAlpha(0);
    this.tweens.add({ targets: panel, alpha: 1, duration: dur.slow, ease: ease.out });

    const eyebrow = this.add.text(cx, panelTop + 32, entry.won ? "LA CASA SE INCLINA" : "LA CASA COBRA", textStyle(type.overline, { color: hex.primary }));
    eyebrow.setOrigin(0.5, 0.5);
    applyLetterSpacing(eyebrow, type.overline);

    const title = this.add.text(cx, panelTop + 78, entry.won ? "VICTORIA" : "GAME OVER", textStyle(type.display, { color: entry.won ? hex.gold : hex.danger }));
    title.setOrigin(0.5, 0.5);
    applyLetterSpacing(title, type.display);

    drawOrnament(this, cx, panelTop + 122, 280);

    const flavor = this.payload.flavor ?? (entry.won ? "El crupier se quita el sombrero." : "Otra ficha más para la pila.");
    const flavorText = this.add.text(cx, panelTop + 150, flavor, textStyle(type.bodyMuted));
    flavorText.setOrigin(0.5, 0.5);
    flavorText.setFontStyle("italic");

    // Cosmetic run code + reproducible seed banner.
    let seedY = panelTop + 178;
    if (this.payload.runCode) {
      const code = this.add.text(cx, seedY, this.payload.runCode, textStyle(type.overline, { color: hex.gold }));
      code.setOrigin(0.5, 0.5);
      applyLetterSpacing(code, type.overline);
      seedY += 18;
    }
    if (this.payload.seed !== undefined) {
      const seedHex = this.payload.seed.toString(16).toUpperCase().padStart(8, "0");
      const seedLabel = this.add.text(cx, seedY, `SEED  ${seedHex}`, textStyle(type.caption, { color: hex.textMuted }));
      seedLabel.setOrigin(0.5, 0.5);
      applyLetterSpacing(seedLabel, type.caption);
    }

    // --- Stats grid -------------------------------------------------------
    const rows: { label: string; value: string; record?: string }[] = [
      {
        label: "OLA ALCANZADA",
        value: `${entry.waveReached}`,
        record: `RÉCORD ${profile.highestWaveReached}`,
      },
      {
        label: "OLA SUPERADA",
        value: `${entry.waveCleared}`,
        record: `RÉCORD ${profile.highestWaveCleared}`,
      },
      {
        label: "TIEMPO",
        value: formatDuration(entry.durationMs),
        record: profile.bestRunDurationMs > 0 ? `MEJOR ${formatDuration(profile.bestRunDurationMs)}` : "PRIMER RUN",
      },
      { label: "ENEMIGOS", value: `${entry.kills}` },
      { label: "FICHAS GANADAS", value: `${entry.chipsEarned}` },
      { label: "PACTOS ACEPTADOS", value: `${entry.modifiersAccepted}` },
      { label: "PACTOS RECHAZADOS", value: `${entry.modifiersSkipped}` },
      { label: "RELIQUIAS", value: `${entry.relicsAcquired}` },
    ];
    const cols = 4;
    const cellW = (panelW - 80) / cols;
    const cellH = 70;
    const gridTop = panelTop + 200;
    rows.forEach((row, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const x = cx - panelW / 2 + 40 + c * cellW + cellW / 2;
      const y = gridTop + r * cellH;
      const lbl = this.add.text(x, y, row.label, textStyle(type.caption, { color: hex.textMuted }));
      lbl.setOrigin(0.5, 0.5);
      applyLetterSpacing(lbl, type.caption);
      const val = this.add.text(x, y + 22, row.value, textStyle(type.h2, { color: hex.text }));
      val.setOrigin(0.5, 0.5);
      applyLetterSpacing(val, type.h2);
      if (row.record) {
        const rec = this.add.text(x, y + 46, row.record, textStyle(type.caption, { color: hex.textDim }));
        rec.setOrigin(0.5, 0.5);
        applyLetterSpacing(rec, type.caption);
      }
    });

    // --- Buttons ---------------------------------------------------------
    const btnY = panelTop + panelH - 40;
    this.makeButton(cx - 200, btnY, 170, 44, "REINTENTAR  ·  R", palette.primary, hex.textInverted, () => {
      this.scene.stop();
      this.scene.start("GameScene");
    });
    if (this.payload.seed !== undefined) {
      const s = this.payload.seed;
      this.makeButton(cx, btnY, 170, 44, "MISMA SEED", palette.gold, hex.textInverted, () => {
        this.scene.stop();
        this.scene.start("GameScene", { seed: s });
      });
    }
    this.makeButton(cx + 200, btnY, 170, 44, "MENÚ  ·  ESC", palette.surface, hex.text, () => {
      this.scene.stop();
      this.scene.start("MainMenuScene");
    });

    this.input.keyboard?.on("keydown-R", () => {
      this.scene.stop();
      this.scene.start("GameScene");
    });
    this.input.keyboard?.on("keydown-ESC", () => {
      this.scene.stop();
      this.scene.start("MainMenuScene");
    });
    this.input.keyboard?.on("keydown-ENTER", () => {
      this.scene.stop();
      this.scene.start("GameScene");
    });

    audio.playClick();
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
  ): void {
    const bg = this.add.graphics();
    bg.setDepth(2);
    const text = this.add.text(cx, cy, label, textStyle(type.overline, { color: textColor }));
    text.setOrigin(0.5, 0.5);
    text.setDepth(3);
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
    hit.setDepth(4);
    hit.on("pointerover", () => {
      redraw(true);
      text.setColor(hex.textInverted);
    });
    hit.on("pointerout", () => {
      redraw(false);
      text.setColor(textColor);
    });
    hit.on("pointerdown", () => onClick());
  }
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
