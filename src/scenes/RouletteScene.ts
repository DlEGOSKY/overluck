import Phaser from "phaser";
import { MAP_HEIGHT, MAP_WIDTH } from "@/data/path";
import { audio } from "@/systems/AudioManager";
import {
  applyLetterSpacing,
  cameraEase,
  colorToHex,
  drawOrnament,
  dur,
  ease,
  hex,
  palette,
  textStyle,
  type,
} from "@/ui/theme";

export type RouletteBetKind = "red" | "black" | "odd" | "even" | "low" | "high";

export interface RouletteResult {
  number: number;
  color: "red" | "black" | "green";
  winningBet: RouletteBetKind | null;
  chipsDelta: number;
  headline: string;
  outcome: "win" | "loss";
}

export interface RouletteSceneData {
  stake: number;
  onResolved: (res: RouletteResult) => void;
  random?: () => number;
}

const EUROPEAN_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

interface BetButtonRefs {
  kind: RouletteBetKind;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  subLabel: string;
  color: number;
  payoutMultiplier: number;
  graphics: Phaser.GameObjects.Graphics;
  labelText: Phaser.GameObjects.Text;
  subText: Phaser.GameObjects.Text;
  hit: Phaser.GameObjects.Rectangle;
  state: "idle" | "hover" | "selected";
}

export class RouletteScene extends Phaser.Scene {
  private payload!: RouletteSceneData;
  private random!: () => number;
  private resolved = false;

  private wheelContainer!: Phaser.GameObjects.Container;
  private ballContainer!: Phaser.GameObjects.Container;
  private wheelGraphics!: Phaser.GameObjects.Graphics;
  private ball!: Phaser.GameObjects.Arc;
  private pointer!: Phaser.GameObjects.Graphics;
  private resultDisplay!: Phaser.GameObjects.Text;
  private resultNumber!: Phaser.GameObjects.Text;
  private resultPill!: Phaser.GameObjects.Graphics;

  private headlineText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;

  private spinButtonGfx!: Phaser.GameObjects.Graphics;
  private spinButtonHit!: Phaser.GameObjects.Rectangle;
  private spinButtonLabel!: Phaser.GameObjects.Text;

  private betButtons: BetButtonRefs[] = [];
  private selectedBet: RouletteBetKind | null = null;

  private spinning = false;
  private wheelCenter = { x: 0, y: 0 };
  private wheelRadius = 150;

  public constructor() {
    super({ key: "RouletteScene" });
  }

  public init(data: RouletteSceneData): void {
    this.payload = data;
    this.random = data.random ?? Math.random;
    this.resolved = false;
    this.spinning = false;
    this.betButtons = [];
    this.selectedBet = null;
  }

  public create(): void {
    audio.startAmbient("casino");
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audio.stopAmbient());
    this.drawBackdrop();
    this.drawHeader();
    this.drawWheel();
    this.drawBetTable();
    this.buildSpinButton();
    this.drawFooter();

    this.headlineText = this.add.text(MAP_WIDTH / 2, MAP_HEIGHT / 2 + 160, "", textStyle(type.h2));
    this.headlineText.setOrigin(0.5, 0.5);
    this.headlineText.setDepth(50);
    applyLetterSpacing(this.headlineText, type.h2);

    this.statusText = this.add.text(MAP_WIDTH / 2, MAP_HEIGHT / 2 + 192, "", textStyle(type.caption));
    this.statusText.setOrigin(0.5, 0.5);
    this.statusText.setDepth(50);

    this.input.keyboard?.on("keydown-ESC", () => {
      if (this.spinning) return;
      this.resolve({
        number: 0,
        color: "green",
        winningBet: null,
        chipsDelta: 0,
        headline: "Sin apuesta",
        outcome: "loss",
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
      palette.felt,
      palette.felt,
      palette.bgDeep,
      palette.bgDeep,
      0.7,
      0.7,
      1,
      1,
    );
    grad.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    grad.setAlpha(0);
    this.tweens.add({ targets: grad, alpha: 1, duration: dur.slow, ease: ease.out });
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

    const title = this.add.text(MAP_WIDTH / 2, 112, "RULETA EUROPEA", textStyle(type.display, {
      color: hex.primary,
    }));
    title.setOrigin(0.5, 0.5);
    title.setDepth(10);
    applyLetterSpacing(title, type.display);

    const ornament = drawOrnament(this, MAP_WIDTH / 2, 150, 240);
    ornament.setDepth(10);

    const caption = this.add.text(
      MAP_WIDTH / 2,
      180,
      `Apuesta: ${this.payload.stake} fichas en juego  ·  elige un campo y gira`,
      textStyle(type.caption),
    );
    caption.setOrigin(0.5, 0.5);
    caption.setDepth(10);

    const header = [eyebrow, title, ornament, caption];
    for (const el of header) el.setAlpha(0);
    this.tweens.add({
      targets: header,
      alpha: 1,
      y: "+=4",
      duration: dur.base,
      ease: ease.out,
      delay: 60,
    });
  }

  private drawWheel(): void {
    const centerX = MAP_WIDTH / 2 - 240;
    const centerY = MAP_HEIGHT / 2 + 20;
    this.wheelCenter = { x: centerX, y: centerY };

    // Wood ring
    const wood = this.add.graphics();
    wood.setDepth(5);
    wood.fillStyle(palette.gold, 1);
    wood.fillCircle(centerX, centerY, this.wheelRadius + 24);
    wood.fillStyle(palette.goldDeep, 1);
    wood.fillCircle(centerX, centerY, this.wheelRadius + 18);

    // Wheel base
    this.wheelContainer = this.add.container(centerX, centerY);
    this.wheelContainer.setDepth(6);

    this.wheelGraphics = this.add.graphics();
    this.wheelContainer.add(this.wheelGraphics);
    this.drawWheelSlices(this.wheelGraphics);

    // Hub
    const hub = this.add.graphics();
    hub.fillStyle(palette.gold, 1);
    hub.fillCircle(0, 0, 22);
    hub.fillStyle(palette.goldDeep, 1);
    hub.fillCircle(0, 0, 18);
    hub.fillStyle(palette.bgDeep, 1);
    hub.fillCircle(0, 0, 8);
    this.wheelContainer.add(hub);

    // Spokes
    const spokes = this.add.graphics();
    spokes.lineStyle(2, palette.gold, 0.8);
    for (let i = 0; i < 4; i += 1) {
      const a = (Math.PI / 2) * i;
      spokes.beginPath();
      spokes.moveTo(Math.cos(a) * 22, Math.sin(a) * 22);
      spokes.lineTo(Math.cos(a) * (this.wheelRadius - 20), Math.sin(a) * (this.wheelRadius - 20));
      spokes.strokePath();
    }
    this.wheelContainer.add(spokes);

    // Ball container (rotates independently)
    this.ballContainer = this.add.container(centerX, centerY);
    this.ballContainer.setDepth(8);
    this.ball = this.add.circle(0, -(this.wheelRadius - 18), 7, 0xffffff, 1);
    this.ball.setStrokeStyle(1, palette.bgDeep, 1);
    this.ballContainer.add(this.ball);

    // Static pointer at top of wheel
    this.pointer = this.add.graphics();
    this.pointer.setDepth(9);
    this.pointer.fillStyle(palette.primary, 1);
    this.pointer.fillTriangle(
      centerX, centerY - this.wheelRadius - 26,
      centerX - 10, centerY - this.wheelRadius - 40,
      centerX + 10, centerY - this.wheelRadius - 40,
    );

    // Result pill below wheel
    const pillY = centerY + this.wheelRadius + 48;
    this.resultPill = this.add.graphics();
    this.resultPill.setDepth(10);
    this.resultPill.fillStyle(palette.surface, 0.92);
    this.resultPill.fillRoundedRect(centerX - 80, pillY - 22, 160, 44, 22);
    this.resultPill.lineStyle(1, palette.hairline, 0.8);
    this.resultPill.strokeRoundedRect(centerX - 80, pillY - 22, 160, 44, 22);

    this.resultDisplay = this.add.text(centerX - 50, pillY, "ÚLTIMO", textStyle(type.overline, { color: hex.textDim }));
    this.resultDisplay.setOrigin(0.5, 0.5);
    this.resultDisplay.setDepth(11);
    applyLetterSpacing(this.resultDisplay, type.overline);

    this.resultNumber = this.add.text(centerX + 30, pillY, "—", textStyle(type.metricLg));
    this.resultNumber.setOrigin(0.5, 0.5);
    this.resultNumber.setDepth(11);

    // Entry animation
    this.wheelContainer.setScale(0.8);
    this.wheelContainer.setAlpha(0);
    this.ballContainer.setAlpha(0);
    wood.setAlpha(0);

    this.tweens.add({
      targets: [this.wheelContainer, this.ballContainer, wood],
      alpha: 1,
      scale: 1,
      duration: dur.base,
      delay: 200,
      ease: ease.snap,
    });
  }

  private drawWheelSlices(g: Phaser.GameObjects.Graphics): void {
    const sliceAngle = (Math.PI * 2) / EUROPEAN_ORDER.length;
    const r = this.wheelRadius;

    for (let i = 0; i < EUROPEAN_ORDER.length; i += 1) {
      const n = EUROPEAN_ORDER[i];
      const color = this.colorForNumber(n);
      const fillColor = color === "red" ? palette.chipRed : color === "black" ? palette.chipBlack : 0x1f6f4a;
      const startAngle = -Math.PI / 2 - sliceAngle / 2 + i * sliceAngle;
      const endAngle = startAngle + sliceAngle;

      g.fillStyle(fillColor, 1);
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, r, startAngle, endAngle, false);
      g.closePath();
      g.fillPath();

      g.lineStyle(1, palette.gold, 0.5);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(startAngle) * r, Math.sin(startAngle) * r);
      g.strokePath();

      // Number label
      const midAngle = startAngle + sliceAngle / 2;
      const labelR = r - 16;
      const lx = Math.cos(midAngle) * labelR;
      const ly = Math.sin(midAngle) * labelR;
      const label = this.add.text(lx, ly, n.toString(), {
        fontFamily: '"Inter", "SF Pro Text", system-ui, sans-serif',
        fontSize: "10px",
        color: "#ffffff",
        fontStyle: "bold",
      });
      label.setOrigin(0.5, 0.5);
      label.setRotation(midAngle + Math.PI / 2);
      this.wheelContainer.add(label);
    }

    // Outer gold rim
    g.lineStyle(2, palette.gold, 0.9);
    g.strokeCircle(0, 0, r);
  }

  private drawBetTable(): void {
    const tableX = MAP_WIDTH / 2 + 160;
    const tableY = MAP_HEIGHT / 2 - 30;
    const btnW = 200;
    const btnH = 56;
    const gap = 12;

    const header = this.add.text(tableX, tableY - btnH - 16, "ELIGE UNA APUESTA", textStyle(type.overline, { color: hex.textDim }));
    header.setOrigin(0.5, 0.5);
    header.setDepth(20);
    applyLetterSpacing(header, type.overline);

    const bets: { kind: RouletteBetKind; label: string; sub: string; color: number; payout: number }[] = [
      { kind: "red", label: "ROJO", sub: "paga 2×", color: palette.chipRed, payout: 2 },
      { kind: "black", label: "NEGRO", sub: "paga 2×", color: palette.chipBlack, payout: 2 },
      { kind: "odd", label: "IMPAR", sub: "paga 2×", color: palette.accent, payout: 2 },
      { kind: "even", label: "PAR", sub: "paga 2×", color: palette.accent, payout: 2 },
      { kind: "low", label: "1 – 18", sub: "paga 2×", color: palette.violet, payout: 2 },
      { kind: "high", label: "19 – 36", sub: "paga 2×", color: palette.violet, payout: 2 },
    ];

    bets.forEach((b, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = tableX + (col === 0 ? -btnW / 2 - gap / 2 : btnW / 2 + gap / 2);
      const y = tableY + row * (btnH + gap);
      this.createBetButton(b.kind, x, y, btnW, btnH, b.label, b.sub, b.color, b.payout);
    });

    const headers = [header];
    for (const el of headers) (el as unknown as { alpha: number }).alpha = 0;
    this.tweens.add({ targets: headers, alpha: 1, duration: dur.base, delay: 400, ease: ease.out });
  }

  private createBetButton(
    kind: RouletteBetKind,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    subLabel: string,
    color: number,
    payoutMultiplier: number,
  ): void {
    const g = this.add.graphics();
    g.setDepth(21);

    const hit = this.add.rectangle(x, y, width, height, 0x000000, 0.001);
    hit.setInteractive({ useHandCursor: true });
    hit.setDepth(22);

    const labelText = this.add.text(x - width / 2 + 16, y - 4, label, textStyle(type.h3));
    labelText.setOrigin(0, 0.5);
    labelText.setDepth(23);
    applyLetterSpacing(labelText, type.h3);

    const subText = this.add.text(x + width / 2 - 16, y + 10, subLabel, textStyle(type.overline, { color: colorToHex(color) }));
    subText.setOrigin(1, 0.5);
    subText.setDepth(23);
    applyLetterSpacing(subText, type.overline);

    const ref: BetButtonRefs = {
      kind,
      x,
      y,
      width,
      height,
      label,
      subLabel,
      color,
      payoutMultiplier,
      graphics: g,
      labelText,
      subText,
      hit,
      state: "idle",
    };
    this.betButtons.push(ref);
    this.drawBetButton(ref);

    hit.on("pointerover", () => {
      if (this.spinning || ref.state === "selected") return;
      ref.state = "hover";
      this.drawBetButton(ref);
    });
    hit.on("pointerout", () => {
      if (this.spinning || ref.state === "selected") return;
      ref.state = "idle";
      this.drawBetButton(ref);
    });
    hit.on("pointerdown", () => {
      if (this.spinning) return;
      audio.playClick();
      this.selectBet(kind);
    });

    // Entrance
    g.setAlpha(0);
    labelText.setAlpha(0);
    subText.setAlpha(0);
    this.tweens.add({
      targets: [g, labelText, subText],
      alpha: 1,
      duration: dur.base,
      delay: 300 + this.betButtons.length * 50,
      ease: ease.out,
    });
  }

  private drawBetButton(ref: BetButtonRefs): void {
    const g = ref.graphics;
    g.clear();

    const selected = ref.state === "selected";
    const hover = ref.state === "hover";

    const fill = selected ? palette.surfaceElevated : palette.surface;
    const fillAlpha = selected ? 1 : hover ? 0.95 : 0.85;

    g.fillStyle(fill, fillAlpha);
    g.fillRoundedRect(ref.x - ref.width / 2, ref.y - ref.height / 2, ref.width, ref.height, 10);

    const strokeW = selected ? 2 : 1;
    const strokeAlpha = selected ? 1 : hover ? 0.85 : 0.5;
    g.lineStyle(strokeW, ref.color, strokeAlpha);
    g.strokeRoundedRect(ref.x - ref.width / 2, ref.y - ref.height / 2, ref.width, ref.height, 10);

    // Color swatch on left
    g.fillStyle(ref.color, selected ? 1 : 0.8);
    g.fillRoundedRect(ref.x - ref.width / 2 + 4, ref.y - ref.height / 2 + 4, 4, ref.height - 8, 2);
  }

  private selectBet(kind: RouletteBetKind): void {
    this.selectedBet = kind;
    for (const ref of this.betButtons) {
      ref.state = ref.kind === kind ? "selected" : "idle";
      this.drawBetButton(ref);
    }
    this.statusText.setText("Listo para girar");
    this.statusText.setColor(hex.text);
    this.redrawSpinButtonState();
  }

  private buildSpinButton(): void {
    const btnX = MAP_WIDTH / 2 + 160;
    const btnY = MAP_HEIGHT - 90;
    const btnW = 240;
    const btnH = 56;

    const shadow = this.add.graphics();
    shadow.setDepth(19);
    shadow.fillStyle(palette.bgDeep, 0.5);
    shadow.fillRoundedRect(btnX - btnW / 2 + 2, btnY - btnH / 2 + 4, btnW, btnH, 12);

    this.spinButtonGfx = this.add.graphics();
    this.spinButtonGfx.setDepth(20);

    this.spinButtonHit = this.add.rectangle(btnX, btnY, btnW, btnH, 0x000000, 0.001);
    this.spinButtonHit.setInteractive({ useHandCursor: true });
    this.spinButtonHit.setDepth(21);

    this.spinButtonLabel = this.add.text(btnX, btnY - 2, "GIRAR RULETA", textStyle(type.h3, {
      color: hex.textInverted,
    }));
    this.spinButtonLabel.setOrigin(0.5, 0.5);
    this.spinButtonLabel.setDepth(22);
    applyLetterSpacing(this.spinButtonLabel, type.h3);

    const hint = this.add.text(btnX, btnY + 14, "ESPACIO", textStyle(type.overline, { color: "#4a3a00" }));
    hint.setOrigin(0.5, 0);
    hint.setDepth(22);
    applyLetterSpacing(hint, type.overline);

    this.redrawSpinButtonState();

    this.spinButtonHit.on("pointerover", () => {
      if (this.spinning || !this.selectedBet) return;
      this.redrawSpinButton(this.spinButtonGfx, "hover");
    });
    this.spinButtonHit.on("pointerout", () => this.redrawSpinButtonState());
    this.spinButtonHit.on("pointerdown", () => {
      if (!this.selectedBet) return;
      this.redrawSpinButton(this.spinButtonGfx, "pressed");
      this.spin();
    });

    this.input.keyboard?.on("keydown-SPACE", () => {
      if (this.selectedBet && !this.spinning) this.spin();
    });
  }

  private redrawSpinButtonState(): void {
    this.redrawSpinButton(this.spinButtonGfx, this.selectedBet ? "idle" : "disabled");
    this.spinButtonLabel.setColor(this.selectedBet ? hex.textInverted : hex.textDim);
  }

  private redrawSpinButton(g: Phaser.GameObjects.Graphics, state: "idle" | "hover" | "pressed" | "disabled"): void {
    g.clear();
    const btnX = MAP_WIDTH / 2 + 160;
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
      topColor = palette.surface;
      bottomColor = palette.bgDeep;
    }

    g.fillGradientStyle(topColor, topColor, bottomColor, bottomColor, 1, 1, 1, 1);
    g.fillRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, 12);
    g.lineStyle(1, state === "disabled" ? palette.hairline : palette.goldDeep, 0.9);
    g.strokeRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, 12);

    g.fillStyle(0xffffff, state === "pressed" ? 0.05 : state === "disabled" ? 0 : 0.15);
    g.fillRoundedRect(btnX - btnW / 2 + 4, btnY - btnH / 2 + 4, btnW - 8, (btnH - 8) / 2, 10);
  }

  private drawFooter(): void {
    const skipHint = this.add.text(MAP_WIDTH / 2, MAP_HEIGHT - 36, "ESC  para salir sin girar", textStyle(type.caption, { color: hex.textDim }));
    skipHint.setOrigin(0.5, 0.5);
    skipHint.setDepth(30);
    skipHint.setAlpha(0);
    this.tweens.add({ targets: skipHint, alpha: 1, duration: dur.base, delay: 500, ease: ease.out });
  }

  private spin(): void {
    if (!this.selectedBet || this.spinning || this.resolved) return;
    this.spinning = true;
    audio.playSpin();
    this.spinButtonHit.disableInteractive();
    this.redrawSpinButton(this.spinButtonGfx, "disabled");
    this.spinButtonLabel.setText("GIRANDO");
    this.spinButtonLabel.setColor(hex.textDim);

    for (const ref of this.betButtons) {
      ref.hit.disableInteractive();
    }

    // Pick winning number
    const winningIndex = Math.floor(this.random() * EUROPEAN_ORDER.length);
    const winningNumber = EUROPEAN_ORDER[winningIndex];
    const sliceAngle = (Math.PI * 2) / EUROPEAN_ORDER.length;

    // The wheel itself spins. We want slice `winningIndex` to end up at the top (pointer position).
    // Top is -PI/2. Slice i is centered at -PI/2 + i*sliceAngle. To bring it to -PI/2 we rotate wheel by -i*sliceAngle.
    const targetWheelRotation = -winningIndex * sliceAngle - Math.PI * 8;
    // Ball spins opposite direction faster
    const targetBallRotation = Math.PI * 14;

    this.tweens.add({
      targets: this.wheelContainer,
      rotation: targetWheelRotation,
      duration: 3400,
      ease: "Cubic.Out",
    });

    this.tweens.add({
      targets: this.ballContainer,
      rotation: targetBallRotation,
      duration: 3400,
      ease: "Cubic.Out",
      onComplete: () => {
        this.ballContainer.setRotation(0);
        // Place ball at the winning slice top position (since wheel now has it under pointer)
        this.ball.setPosition(0, -(this.wheelRadius - 18));
        this.resolveSpin(winningNumber);
      },
    });

    // Subtle camera zoom (cameraEase uses raw functions, not theme strings)
    this.cameras.main.zoomTo(1.04, 800, cameraEase.inOut);
    this.time.delayedCall(2400, () => {
      this.cameras.main.zoomTo(1, 800, cameraEase.inOut);
    });
  }

  private resolveSpin(winningNumber: number): void {
    const color = this.colorForNumber(winningNumber);
    const winningBet = this.selectedBet;
    let outcome: "win" | "loss" = "loss";
    let chipsDelta = -this.payload.stake;
    let headline = `${winningNumber} ${this.colorLabel(color)} · pierdes`;

    if (winningBet && this.betMatches(winningBet, winningNumber, color)) {
      outcome = "win";
      chipsDelta = this.payload.stake;
      headline = `${winningNumber} ${this.colorLabel(color)} · paga +${this.payload.stake}`;
      audio.playReward();
      this.cameras.main.flash(360, 255, 209, 102);
      this.spawnCelebration();
    } else {
      audio.playBaseHit();
      this.cameras.main.shake(200, 0.008);
    }

    // Update last result pill
    this.resultNumber.setText(winningNumber.toString());
    this.resultNumber.setColor(
      color === "red" ? hex.danger : color === "black" ? hex.text : hex.success,
    );
    this.tweens.add({
      targets: this.resultNumber,
      scale: { from: 1.6, to: 1 },
      duration: 400,
      ease: ease.snap,
    });

    this.headlineText.setText(headline.toUpperCase());
    this.headlineText.setColor(outcome === "win" ? hex.success : hex.danger);
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
    this.statusText.setColor(hex.textMuted);

    this.time.delayedCall(800, () => {
      const overlay = this.add.rectangle(0, 0, MAP_WIDTH, MAP_HEIGHT, 0x000000, 0.001);
      overlay.setOrigin(0, 0);
      overlay.setInteractive();
      overlay.setDepth(100);
      overlay.on("pointerdown", () => {
        this.resolve({
          number: winningNumber,
          color,
          winningBet,
          chipsDelta,
          headline,
          outcome,
        });
      });
    });
  }

  private colorForNumber(n: number): "red" | "black" | "green" {
    if (n === 0) return "green";
    return RED_NUMBERS.has(n) ? "red" : "black";
  }

  private colorLabel(color: "red" | "black" | "green"): string {
    return color === "red" ? "rojo" : color === "black" ? "negro" : "verde";
  }

  private betMatches(bet: RouletteBetKind, n: number, color: "red" | "black" | "green"): boolean {
    if (color === "green") return false;
    if (bet === "red") return color === "red";
    if (bet === "black") return color === "black";
    if (bet === "odd") return n % 2 === 1;
    if (bet === "even") return n % 2 === 0;
    if (bet === "low") return n >= 1 && n <= 18;
    if (bet === "high") return n >= 19 && n <= 36;
    return false;
  }

  private spawnCelebration(): void {
    const colors = [palette.primary, palette.success, palette.accent, palette.chipRed];
    for (let i = 0; i < 36; i += 1) {
      const color = colors[Math.floor(this.random() * colors.length)];
      const x = this.wheelCenter.x + (this.random() - 0.5) * 200;
      const y = this.wheelCenter.y - 80;
      const piece = this.add.rectangle(x, y, 4 + this.random() * 6, 2 + this.random() * 3, color);
      piece.setDepth(60);
      piece.setRotation(this.random() * Math.PI);

      this.tweens.add({
        targets: piece,
        x: x + (this.random() - 0.5) * 240,
        y: y + 200 + this.random() * 200,
        rotation: piece.rotation + (this.random() - 0.5) * 8,
        alpha: { from: 1, to: 0 },
        duration: 1200 + this.random() * 600,
        ease: ease.out,
        onComplete: () => piece.destroy(),
      });
    }
  }

  private resolve(result: RouletteResult): void {
    if (this.resolved) return;
    this.resolved = true;
    this.payload.onResolved(result);
    this.scene.stop();
  }
}
