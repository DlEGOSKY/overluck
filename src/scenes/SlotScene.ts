import Phaser from "phaser";
import { MAP_HEIGHT, MAP_WIDTH } from "@/data/path";
import { audio } from "@/systems/AudioManager";
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

export type SlotSymbol = "cherry" | "bell" | "seven" | "skull" | "star";

export interface SlotResult {
  reels: [SlotSymbol, SlotSymbol, SlotSymbol];
  chipsDelta: number;
  headline: string;
  outcome: "jackpot" | "win" | "push" | "loss";
}

export interface SlotSceneData {
  cost: number;
  onResolved: (res: SlotResult) => void;
  random?: () => number;
}

interface SymbolDefinition {
  id: SlotSymbol;
  label: string;
  color: number;
  weight: number;
}

const SYMBOLS: SymbolDefinition[] = [
  { id: "cherry", label: "7", color: 0xff5c6c, weight: 4 },
  { id: "bell", label: "★", color: 0xffd166, weight: 3 },
  { id: "seven", label: "◆", color: 0xa97bff, weight: 2 },
  { id: "skull", label: "✖", color: 0x4a4a58, weight: 3 },
  { id: "star", label: "♠", color: 0x6fd3ff, weight: 2 },
];

const REEL_WIDTH = 132;
const REEL_HEIGHT = 160;
const REEL_GAP = 20;
const CABINET_WIDTH = REEL_WIDTH * 3 + REEL_GAP * 2 + 96;
const CABINET_HEIGHT = 340;

export class SlotScene extends Phaser.Scene {
  private payload!: SlotSceneData;
  private random!: () => number;
  private resolved = false;

  private reelSprites: Phaser.GameObjects.Rectangle[] = [];
  private reelTexts: Phaser.GameObjects.Text[] = [];
  private reelTimers: Phaser.Time.TimerEvent[] = [];
  private finalReels: SlotSymbol[] = [];
  private headlineText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private spinButton!: Phaser.GameObjects.Rectangle;
  private spinning = false;

  public constructor() {
    super({ key: "SlotScene" });
  }

  public init(data: SlotSceneData): void {
    this.payload = data;
    this.random = data.random ?? Math.random;
    this.resolved = false;
    this.spinning = false;
    this.reelSprites = [];
    this.reelTexts = [];
    this.reelTimers = [];
    this.finalReels = [];
  }

  public create(): void {
    this.drawBackdrop();
    this.drawHeader();
    this.drawCabinet();
    this.drawPaytable();
    this.drawFooter();

    this.headlineText = this.add.text(MAP_WIDTH / 2, MAP_HEIGHT / 2 + 160, "", textStyle(type.h2));
    this.headlineText.setOrigin(0.5, 0.5);
    this.headlineText.setDepth(40);
    applyLetterSpacing(this.headlineText, type.h2);

    this.statusText = this.add.text(MAP_WIDTH / 2, MAP_HEIGHT / 2 + 194, "", textStyle(type.caption));
    this.statusText.setOrigin(0.5, 0.5);
    this.statusText.setDepth(40);

    this.buildSpinButton();

    this.input.keyboard?.on("keydown-ESC", () => {
      if (this.spinning) return;
      this.resolve({
        reels: ["cherry", "cherry", "cherry"],
        chipsDelta: 0,
        headline: "Sin girar",
        outcome: "push",
      });
    });
  }

  private drawBackdrop(): void {
    const overlay = this.add.rectangle(0, 0, MAP_WIDTH, MAP_HEIGHT, palette.bgDeep, 0);
    overlay.setOrigin(0, 0);
    overlay.setInteractive();
    overlay.setDepth(0);
    this.tweens.add({ targets: overlay, fillAlpha: 0.9, duration: dur.slow, ease: ease.out });

    const grad = this.add.graphics();
    grad.setDepth(1);
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
    grad.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    grad.setAlpha(0);
    this.tweens.add({ targets: grad, alpha: 1, duration: dur.slow, ease: ease.out });

    // Light rays radiating from center
    const rays = this.add.graphics();
    rays.setDepth(2);
    rays.setPosition(MAP_WIDTH / 2, MAP_HEIGHT / 2);
    for (let i = 0; i < 12; i += 1) {
      const angle = (Math.PI * 2 * i) / 12;
      rays.fillStyle(palette.primary, 0.04);
      rays.beginPath();
      rays.moveTo(0, 0);
      rays.lineTo(Math.cos(angle - 0.08) * 700, Math.sin(angle - 0.08) * 700);
      rays.lineTo(Math.cos(angle + 0.08) * 700, Math.sin(angle + 0.08) * 700);
      rays.closePath();
      rays.fillPath();
    }
    rays.setAlpha(0);
    this.tweens.add({ targets: rays, alpha: 1, duration: dur.slower, ease: ease.out });
    this.tweens.add({
      targets: rays,
      rotation: Math.PI * 2,
      duration: 120000,
      repeat: -1,
    });
  }

  private drawHeader(): void {
    const eyebrow = this.add.text(
      MAP_WIDTH / 2,
      76,
      "MESA  ·  DEL  ·  CRUPIER",
      textStyle(type.overline, { color: hex.primary }),
    );
    eyebrow.setOrigin(0.5, 0.5);
    eyebrow.setDepth(10);
    applyLetterSpacing(eyebrow, type.overline);

    const title = this.add.text(MAP_WIDTH / 2, 112, "OVERLUCK SLOT", textStyle(type.display, {
      color: hex.primary,
    }));
    title.setOrigin(0.5, 0.5);
    title.setDepth(10);
    applyLetterSpacing(title, type.display);

    const ornament = drawOrnament(this, MAP_WIDTH / 2, 150, 220);
    ornament.setDepth(10);

    const header = [eyebrow, title, ornament];
    for (const el of header) el.setAlpha(0);
    this.tweens.add({
      targets: header,
      alpha: 1,
      y: "+=4",
      duration: dur.base,
      ease: ease.out,
      delay: 80,
    });
  }

  private drawCabinet(): void {
    const centerX = MAP_WIDTH / 2;
    const centerY = MAP_HEIGHT / 2 - 20;

    // Drop shadow
    const shadow = this.add.graphics();
    shadow.setDepth(4);
    shadow.fillStyle(palette.bgDeep, 0.6);
    shadow.fillRoundedRect(
      centerX - CABINET_WIDTH / 2 + 6,
      centerY - CABINET_HEIGHT / 2 + 10,
      CABINET_WIDTH,
      CABINET_HEIGHT,
      20,
    );

    // Outer gold frame
    const outerFrame = this.add.graphics();
    outerFrame.setDepth(5);
    outerFrame.fillStyle(palette.gold, 1);
    outerFrame.fillRoundedRect(
      centerX - CABINET_WIDTH / 2 - 10,
      centerY - CABINET_HEIGHT / 2 - 10,
      CABINET_WIDTH + 20,
      CABINET_HEIGHT + 20,
      20,
    );
    outerFrame.fillStyle(palette.goldDeep, 1);
    outerFrame.fillRoundedRect(
      centerX - CABINET_WIDTH / 2 - 4,
      centerY - CABINET_HEIGHT / 2 - 4,
      CABINET_WIDTH + 8,
      CABINET_HEIGHT + 8,
      16,
    );

    // Inner felt
    const felt = this.add.graphics();
    felt.setDepth(6);
    felt.fillGradientStyle(
      0x1f0e0b,
      0x1f0e0b,
      palette.bgDeep,
      palette.bgDeep,
      1,
      1,
      1,
      1,
    );
    felt.fillRoundedRect(
      centerX - CABINET_WIDTH / 2,
      centerY - CABINET_HEIGHT / 2,
      CABINET_WIDTH,
      CABINET_HEIGHT,
      14,
    );
    felt.lineStyle(1, palette.goldDeep, 0.5);
    felt.strokeRoundedRect(
      centerX - CABINET_WIDTH / 2 + 4,
      centerY - CABINET_HEIGHT / 2 + 4,
      CABINET_WIDTH - 8,
      CABINET_HEIGHT - 8,
      12,
    );

    // Decorative lights around the cabinet
    this.drawCabinetLights(centerX, centerY);

    // Corner ornaments
    this.drawCornerOrnaments(centerX, centerY);

    // Reels
    this.layoutReels(centerX, centerY + 10);

    // Cabinet appears from scale
    const cabinetNodes: Phaser.GameObjects.GameObject[] = [shadow, outerFrame, felt];
    for (const node of cabinetNodes) {
      const target = node as unknown as { alpha: number };
      target.alpha = 0;
    }
    this.tweens.add({
      targets: cabinetNodes,
      alpha: 1,
      duration: dur.base,
      ease: ease.out,
      delay: 200,
    });
  }

  private drawCabinetLights(centerX: number, centerY: number): void {
    const lights: Phaser.GameObjects.Arc[] = [];
    const spacing = 32;
    const top = centerY - CABINET_HEIGHT / 2 - 2;
    const bottom = centerY + CABINET_HEIGHT / 2 + 2;
    const left = centerX - CABINET_WIDTH / 2 - 2;
    const right = centerX + CABINET_WIDTH / 2 + 2;

    const makeLight = (x: number, y: number) => {
      const halo = this.add.circle(x, y, 5, palette.primary, 0.18);
      halo.setDepth(7);
      const dot = this.add.circle(x, y, 2.4, palette.primary, 1);
      dot.setDepth(8);
      lights.push(dot);
      return halo;
    };

    // Top and bottom rows
    const colsCount = Math.floor(CABINET_WIDTH / spacing);
    const horizontalStart = centerX - (colsCount * spacing) / 2 + spacing / 2;
    for (let i = 0; i < colsCount; i += 1) {
      const x = horizontalStart + i * spacing;
      makeLight(x, top);
      makeLight(x, bottom);
    }

    // Left and right columns (skip corners)
    const rowsCount = Math.floor(CABINET_HEIGHT / spacing);
    const verticalStart = centerY - (rowsCount * spacing) / 2 + spacing / 2;
    for (let i = 0; i < rowsCount; i += 1) {
      const y = verticalStart + i * spacing;
      makeLight(left, y);
      makeLight(right, y);
    }

    // Chase animation: each light pulses in sequence
    lights.forEach((light, i) => {
      this.tweens.add({
        targets: light,
        alpha: { from: 1, to: 0.2 },
        yoyo: true,
        repeat: -1,
        duration: 900,
        delay: (i % 8) * 110,
        ease: ease.inOut,
      });
    });
  }

  private drawCornerOrnaments(centerX: number, centerY: number): void {
    const g = this.add.graphics();
    g.setDepth(9);
    g.lineStyle(2, palette.gold, 0.9);

    const corners = [
      { x: centerX - CABINET_WIDTH / 2 + 16, y: centerY - CABINET_HEIGHT / 2 + 16, dx: 1, dy: 1 },
      { x: centerX + CABINET_WIDTH / 2 - 16, y: centerY - CABINET_HEIGHT / 2 + 16, dx: -1, dy: 1 },
      { x: centerX - CABINET_WIDTH / 2 + 16, y: centerY + CABINET_HEIGHT / 2 - 16, dx: 1, dy: -1 },
      { x: centerX + CABINET_WIDTH / 2 - 16, y: centerY + CABINET_HEIGHT / 2 - 16, dx: -1, dy: -1 },
    ];

    for (const c of corners) {
      g.beginPath();
      g.moveTo(c.x + 14 * c.dx, c.y);
      g.lineTo(c.x + 2 * c.dx, c.y);
      g.lineTo(c.x, c.y + 2 * c.dy);
      g.lineTo(c.x, c.y + 14 * c.dy);
      g.strokePath();
    }
  }

  private layoutReels(centerX: number, centerY: number): void {
    const totalWidth = REEL_WIDTH * 3 + REEL_GAP * 2;
    const startX = centerX - totalWidth / 2 + REEL_WIDTH / 2;

    for (let i = 0; i < 3; i += 1) {
      const x = startX + i * (REEL_WIDTH + REEL_GAP);

      // Reel glow behind
      const glow = this.add.graphics();
      glow.setDepth(10);
      glow.fillStyle(palette.primary, 0.04);
      glow.fillRoundedRect(x - REEL_WIDTH / 2 - 3, centerY - REEL_HEIGHT / 2 - 3, REEL_WIDTH + 6, REEL_HEIGHT + 6, 10);

      // Reel backdrop with gradient
      const backdrop = this.add.graphics();
      backdrop.setDepth(11);
      backdrop.fillGradientStyle(
        palette.surface,
        palette.surface,
        palette.bgDeep,
        palette.bgDeep,
        1,
        1,
        1,
        1,
      );
      backdrop.fillRoundedRect(x - REEL_WIDTH / 2, centerY - REEL_HEIGHT / 2, REEL_WIDTH, REEL_HEIGHT, 8);

      const reel = this.add.rectangle(x, centerY, REEL_WIDTH, REEL_HEIGHT, 0x000000, 0);
      reel.setStrokeStyle(1, palette.goldDeep, 0.7);
      reel.setDepth(12);

      // Top and bottom shadow inside reel (for depth)
      const shade = this.add.graphics();
      shade.setDepth(14);
      shade.fillGradientStyle(palette.bgDeep, palette.bgDeep, 0x000000, 0x000000, 0.8, 0.8, 0, 0);
      shade.fillRect(x - REEL_WIDTH / 2, centerY - REEL_HEIGHT / 2, REEL_WIDTH, 24);
      shade.fillGradientStyle(0x000000, 0x000000, palette.bgDeep, palette.bgDeep, 0, 0, 0.8, 0.8);
      shade.fillRect(x - REEL_WIDTH / 2, centerY + REEL_HEIGHT / 2 - 24, REEL_WIDTH, 24);

      const symbol = SYMBOLS[0];
      const text = this.add.text(x, centerY, symbol.label, {
        fontFamily:
          '"Inter", "SF Pro Text", "Segoe UI", system-ui, -apple-system, sans-serif',
        fontSize: "72px",
        color: colorToHex(symbol.color),
        fontStyle: "bold",
      });
      text.setOrigin(0.5, 0.5);
      text.setDepth(13);

      // Center line marker
      const marker = this.add.rectangle(x, centerY, REEL_WIDTH + 4, 1, palette.gold, 0.3);
      marker.setDepth(13);

      this.reelSprites.push(reel);
      this.reelTexts.push(text);
    }
  }

  private drawPaytable(): void {
    const tableX = MAP_WIDTH / 2;
    const tableY = MAP_HEIGHT / 2 + 220;
    const rowHeight = 22;
    const rows = [
      { label: "3×  7", payout: "JACKPOT · +250", color: hex.primary },
      { label: "3×  ★  ◆  ♠", payout: "TRIPLE · +140", color: hex.success },
      { label: "2×  iguales", payout: "PAR · +50", color: hex.text },
      { label: "3×  ✖", payout: "QUIEBRA · pierdes todo", color: hex.danger },
    ];

    const bg = this.add.graphics();
    bg.setDepth(8);
    bg.fillStyle(palette.surface, 0.85);
    bg.fillRoundedRect(tableX - 200, tableY - 12, 400, rows.length * rowHeight + 24, 10);
    bg.lineStyle(1, palette.hairline, 0.8);
    bg.strokeRoundedRect(tableX - 200, tableY - 12, 400, rows.length * rowHeight + 24, 10);

    const header = this.add.text(tableX, tableY, "TABLA DE PAGOS", textStyle(type.overline, { color: hex.textDim }));
    header.setOrigin(0.5, 0);
    header.setDepth(9);
    applyLetterSpacing(header, type.overline);

    rows.forEach((row, i) => {
      const y = tableY + 24 + i * rowHeight;
      const label = this.add.text(tableX - 180, y, row.label, textStyle(type.caption));
      label.setOrigin(0, 0.5);
      label.setDepth(9);

      const payout = this.add.text(tableX + 180, y, row.payout, textStyle(type.caption, { color: row.color }));
      payout.setOrigin(1, 0.5);
      payout.setDepth(9);
    });

    const elements = [bg, header];
    for (const el of elements) (el as unknown as { alpha: number }).alpha = 0;
    this.tweens.add({
      targets: elements,
      alpha: 1,
      duration: dur.base,
      ease: ease.out,
      delay: 400,
    });
  }

  private drawFooter(): void {
    const skipHint = this.add.text(MAP_WIDTH / 2, MAP_HEIGHT - 36, "ESC  para salir sin girar", textStyle(type.caption, { color: hex.textDim }));
    skipHint.setOrigin(0.5, 0.5);
    skipHint.setDepth(20);
    skipHint.setAlpha(0);
    this.tweens.add({ targets: skipHint, alpha: 1, duration: dur.base, delay: 500, ease: ease.out });
  }

  private buildSpinButton(): void {
    const btnX = MAP_WIDTH / 2;
    const btnY = MAP_HEIGHT - 90;
    const btnW = 240;
    const btnH = 56;

    const shadow = this.add.graphics();
    shadow.setDepth(19);
    shadow.fillStyle(palette.bgDeep, 0.5);
    shadow.fillRoundedRect(btnX - btnW / 2 + 2, btnY - btnH / 2 + 4, btnW, btnH, 12);

    const bg = this.add.graphics();
    bg.setDepth(20);
    this.redrawSpinButton(bg, "idle");

    const hit = this.add.rectangle(btnX, btnY, btnW, btnH, 0x000000, 0.001);
    hit.setInteractive({ useHandCursor: true });
    hit.setDepth(21);

    const label = this.add.text(btnX, btnY - 2, "GIRAR", textStyle(type.h3, {
      color: hex.textInverted,
    }));
    label.setOrigin(0.5, 0.5);
    label.setDepth(22);
    applyLetterSpacing(label, type.h3);

    const hintLabel = this.add.text(btnX, btnY + 14, "ESPACIO", textStyle(type.overline, { color: "#4a3a00" }));
    hintLabel.setOrigin(0.5, 0);
    hintLabel.setDepth(22);
    applyLetterSpacing(hintLabel, type.overline);

    hit.on("pointerover", () => this.redrawSpinButton(bg, "hover"));
    hit.on("pointerout", () => this.redrawSpinButton(bg, "idle"));
    hit.on("pointerdown", () => {
      this.redrawSpinButton(bg, "pressed");
      this.spin();
    });

    this.spinButton = hit;
    (this.spinButton as unknown as { bgGfx: Phaser.GameObjects.Graphics }).bgGfx = bg;
    (this.spinButton as unknown as { labelText: Phaser.GameObjects.Text }).labelText = label;
    (this.spinButton as unknown as { hintText: Phaser.GameObjects.Text }).hintText = hintLabel;

    this.input.keyboard?.on("keydown-SPACE", () => this.spin());
  }

  private redrawSpinButton(g: Phaser.GameObjects.Graphics, state: "idle" | "hover" | "pressed" | "disabled"): void {
    g.clear();
    const btnX = MAP_WIDTH / 2;
    const btnY = MAP_HEIGHT - 90;
    const btnW = 240;
    const btnH = 56;

    let topColor: number = palette.primary;
    let bottomColor: number = palette.primaryDeep;
    if (state === "hover") {
      topColor = 0xffe08a;
      bottomColor = palette.primary;
    } else if (state === "pressed") {
      topColor = palette.primaryDeep;
      bottomColor = palette.goldDeep;
    } else if (state === "disabled") {
      topColor = palette.textDim;
      bottomColor = palette.bgDeep;
    }

    g.fillGradientStyle(topColor, topColor, bottomColor, bottomColor, 1, 1, 1, 1);
    g.fillRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, 12);
    g.lineStyle(1, palette.goldDeep, 0.9);
    g.strokeRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, 12);

    // Inner shine
    g.fillStyle(0xffffff, state === "pressed" ? 0.05 : 0.15);
    g.fillRoundedRect(btnX - btnW / 2 + 4, btnY - btnH / 2 + 4, btnW - 8, (btnH - 8) / 2, 10);
  }

  private spin(): void {
    if (this.spinning || this.resolved) return;
    this.spinning = true;
    audio.playSpin();
    this.spinButton.disableInteractive();
    const bgGfx = (this.spinButton as unknown as { bgGfx?: Phaser.GameObjects.Graphics }).bgGfx;
    if (bgGfx) this.redrawSpinButton(bgGfx, "disabled");

    this.finalReels = [this.pickSymbol(), this.pickSymbol(), this.pickSymbol()];

    for (let i = 0; i < 3; i += 1) {
      const text = this.reelTexts[i];
      const reel = this.reelSprites[i];
      const stopAt = 900 + i * 380;
      const timer = this.time.addEvent({
        delay: 60,
        loop: true,
        callback: () => {
          const s = SYMBOLS[Math.floor(this.random() * SYMBOLS.length)];
          text.setText(s.label);
          text.setColor(colorToHex(s.color));
          reel.setStrokeStyle(1, s.color, 0.6);
        },
      });
      this.reelTimers.push(timer);

      // Blur effect during spin
      this.tweens.add({
        targets: text,
        scaleY: { from: 1, to: 1.3 },
        duration: 200,
        yoyo: true,
      });

      this.time.delayedCall(stopAt, () => {
        timer.remove(false);
        const final = this.finalReels[i];
        const def = SYMBOLS.find((s) => s.id === final)!;
        text.setText(def.label);
        text.setColor(colorToHex(def.color));
        text.setScale(1);
        reel.setStrokeStyle(2, def.color, 1);

        // Stop tick feedback
        this.tweens.add({
          targets: [text],
          scale: { from: 1.35, to: 1 },
          duration: 280,
          ease: ease.snap,
        });
        this.tweens.add({
          targets: reel,
          scale: { from: 0.95, to: 1 },
          duration: 220,
          ease: ease.snap,
        });

        // Reel landing pulse
        const pulse = this.add.circle(reel.x, reel.y, 8, def.color, 0.5);
        pulse.setDepth(15);
        this.tweens.add({
          targets: pulse,
          scale: { from: 1, to: 10 },
          alpha: { from: 0.5, to: 0 },
          duration: 380,
          ease: ease.out,
          onComplete: () => pulse.destroy(),
        });

        audio.playTick();
        this.cameras.main.shake(80, 0.004);

        if (i === 2) this.resolveSpin();
      });
    }
  }

  private resolveSpin(): void {
    const [a, b, c] = this.finalReels;
    const xCount = this.finalReels.filter((s) => s === "skull").length;

    let result: SlotResult;

    if (xCount === 3) {
      audio.playGameOver();
      this.cameras.main.shake(360, 0.014);
      this.cameras.main.flash(320, 255, 60, 80);
      result = {
        reels: [a, b, c],
        chipsDelta: -9999,
        headline: "QUIEBRA · pierdes tus fichas",
        outcome: "loss",
      };
    } else if (a === "cherry" && b === "cherry" && c === "cherry") {
      audio.playJackpot();
      this.cameras.main.flash(400, 255, 209, 102);
      this.spawnConfetti();
      result = {
        reels: [a, b, c],
        chipsDelta: 250,
        headline: "JACKPOT · +250 fichas",
        outcome: "jackpot",
      };
    } else if (a === b && b === c) {
      audio.playReward();
      this.cameras.main.flash(240, 255, 209, 102);
      this.spawnConfetti();
      result = {
        reels: [a, b, c],
        chipsDelta: 140,
        headline: "TRIPLE · +140 fichas",
        outcome: "win",
      };
    } else if (a === b || b === c || a === c) {
      result = {
        reels: [a, b, c],
        chipsDelta: 50,
        headline: "PAR · +50 fichas",
        outcome: "win",
      };
    } else {
      result = {
        reels: [a, b, c],
        chipsDelta: -this.payload.cost,
        headline: "Nada · pierdes el costo",
        outcome: "loss",
      };
    }

    this.headlineText.setText(result.headline);
    this.headlineText.setColor(
      result.outcome === "jackpot"
        ? hex.primary
        : result.outcome === "win"
          ? hex.success
          : hex.danger,
    );
    this.headlineText.setAlpha(0);
    this.headlineText.setScale(0.9);
    this.tweens.add({
      targets: this.headlineText,
      alpha: 1,
      scale: 1,
      duration: dur.base,
      ease: ease.snap,
    });

    this.statusText.setText("Click para continuar");
    this.statusText.setAlpha(0);
    this.tweens.add({
      targets: this.statusText,
      alpha: 1,
      duration: dur.base,
      delay: dur.fast,
      ease: ease.out,
    });

    this.time.delayedCall(800, () => {
      const overlayNext = this.add.rectangle(0, 0, MAP_WIDTH, MAP_HEIGHT, 0x000000, 0.001);
      overlayNext.setOrigin(0, 0);
      overlayNext.setInteractive();
      overlayNext.setDepth(100);
      overlayNext.on("pointerdown", () => this.resolve(result));
    });
  }

  private spawnConfetti(): void {
    const colors = [palette.primary, palette.success, palette.violet, palette.accent, palette.chipRed];
    for (let i = 0; i < 40; i += 1) {
      const color = colors[Math.floor(this.random() * colors.length)];
      const x = MAP_WIDTH / 2 + (this.random() - 0.5) * 400;
      const y = MAP_HEIGHT / 2 - 50;
      const piece = this.add.rectangle(x, y, 4 + this.random() * 6, 2 + this.random() * 3, color);
      piece.setDepth(60);
      piece.setRotation(this.random() * Math.PI);

      const endX = x + (this.random() - 0.5) * 200;
      const endY = y + 200 + this.random() * 200;

      this.tweens.add({
        targets: piece,
        x: endX,
        y: endY,
        rotation: piece.rotation + (this.random() - 0.5) * 8,
        alpha: { from: 1, to: 0 },
        duration: 1200 + this.random() * 600,
        ease: ease.out,
        onComplete: () => piece.destroy(),
      });
    }
  }

  private pickSymbol(): SlotSymbol {
    const totalWeight = SYMBOLS.reduce((s, x) => s + x.weight, 0);
    let roll = this.random() * totalWeight;
    for (const s of SYMBOLS) {
      roll -= s.weight;
      if (roll <= 0) return s.id;
    }
    return SYMBOLS[0].id;
  }

  private resolve(result: SlotResult): void {
    if (this.resolved) return;
    this.resolved = true;
    for (const timer of this.reelTimers) timer.remove(false);
    this.payload.onResolved(result);
    this.scene.stop();
  }
}
