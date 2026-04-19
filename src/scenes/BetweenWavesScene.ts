import Phaser from "phaser";
import { MAP_HEIGHT, MAP_WIDTH } from "@/data/path";
import { audio } from "@/systems/AudioManager";
import type { SlotResult, SlotSceneData } from "@/scenes/SlotScene";
import type { RouletteResult, RouletteSceneData } from "@/scenes/RouletteScene";
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
import type {
  CasinoGamblePayload,
  RelicPayload,
  RewardOffer,
  RewardTemplate,
  RoulettePlayPayload,
  SafeChipsPayload,
} from "@/types";

export interface BetweenWavesResolution {
  kind:
    | "safe_chips"
    | "relic"
    | "casino_gamble"
    | "slot_play"
    | "slot_bust"
    | "roulette_play";
  chipsDelta: number;
  relicId?: string;
  casinoOutcome?: "win" | "lose";
  displayName: string;
}

export interface BetweenWavesData {
  offers: readonly RewardOffer[];
  waveJustClearedLabel: string;
  onResolved: (res: BetweenWavesResolution) => void;
  random?: () => number;
}

const CARD_WIDTH = 280;
const CARD_HEIGHT = 340;
const CARD_GAP = 36;

export class BetweenWavesScene extends Phaser.Scene {
  private payload!: BetweenWavesData;
  private random!: () => number;
  private resolved = false;

  public constructor() {
    super({ key: "BetweenWavesScene" });
  }

  public init(data: BetweenWavesData): void {
    this.payload = data;
    this.random = data.random ?? Math.random;
    this.resolved = false;
  }

  public create(): void {
    this.drawBackdrop();
    this.drawHeader();
    this.layoutCards();
    this.drawFooter();

    this.input.keyboard?.on("keydown-ESC", () => {
      this.resolve({
        kind: "safe_chips",
        chipsDelta: 0,
        displayName: "Saltada",
      });
    });
  }

  private drawBackdrop(): void {
    const overlay = this.add.rectangle(0, 0, MAP_WIDTH, MAP_HEIGHT, palette.bgDeep, 0);
    overlay.setOrigin(0, 0);
    overlay.setInteractive();
    overlay.setDepth(0);
    this.tweens.add({
      targets: overlay,
      fillAlpha: 0.78,
      duration: dur.slow,
      ease: ease.out,
    });

    const grad = this.add.graphics();
    grad.setDepth(1);
    grad.fillGradientStyle(
      palette.bgDeep,
      palette.bgDeep,
      palette.bg,
      palette.bg,
      0.2,
      0.2,
      0.6,
      0.6,
    );
    grad.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    grad.setAlpha(0);
    this.tweens.add({ targets: grad, alpha: 1, duration: dur.slow, ease: ease.out });
  }

  private drawHeader(): void {
    const eyebrow = this.add.text(
      MAP_WIDTH / 2,
      96,
      this.payload.waveJustClearedLabel.toUpperCase(),
      textStyle(type.overline, { color: hex.primary }),
    );
    eyebrow.setOrigin(0.5, 0.5);
    eyebrow.setDepth(10);
    applyLetterSpacing(eyebrow, type.overline);

    const title = this.add.text(MAP_WIDTH / 2, 132, "Elige una recompensa", textStyle(type.h1));
    title.setOrigin(0.5, 0.5);
    title.setDepth(10);
    applyLetterSpacing(title, type.h1);

    const ornament = drawOrnament(this, MAP_WIDTH / 2, 162, 160);
    ornament.setDepth(10);

    const caption = this.add.text(
      MAP_WIDTH / 2,
      188,
      "Tres cartas. Una decisión. La mesa siempre cobra.",
      textStyle(type.caption),
    );
    caption.setOrigin(0.5, 0.5);
    caption.setDepth(10);

    const initials = [eyebrow, title, ornament, caption];
    for (const el of initials) el.setAlpha(0);
    this.tweens.add({
      targets: initials,
      alpha: 1,
      y: "+=4",
      duration: dur.base,
      ease: ease.out,
      delay: 60,
    });
  }

  private drawFooter(): void {
    const skipHint = this.add.text(
      MAP_WIDTH / 2,
      MAP_HEIGHT - 54,
      "ESC  para saltar sin recompensa",
      textStyle(type.caption, { color: hex.textDim }),
    );
    skipHint.setOrigin(0.5, 0.5);
    skipHint.setAlpha(0);
    skipHint.setDepth(10);
    this.tweens.add({
      targets: skipHint,
      alpha: 1,
      duration: dur.base,
      delay: 300,
      ease: ease.out,
    });
  }

  private layoutCards(): void {
    const total = this.payload.offers.length;
    const startX = MAP_WIDTH / 2 - ((total - 1) * (CARD_WIDTH + CARD_GAP)) / 2;
    const centerY = MAP_HEIGHT / 2 + 40;

    this.payload.offers.forEach((offer, index) => {
      const x = startX + index * (CARD_WIDTH + CARD_GAP);
      this.buildCard(x, centerY, offer, index);
    });
  }

  private buildCard(centerX: number, centerY: number, offer: RewardOffer, index: number): void {
    const template = offer.template;

    const container = this.add.container(centerX, centerY);
    container.setDepth(20);

    const shadow = this.add.graphics();
    shadow.fillStyle(palette.bgDeep, 0.5);
    shadow.fillRoundedRect(-CARD_WIDTH / 2 + 4, -CARD_HEIGHT / 2 + 8, CARD_WIDTH, CARD_HEIGHT, 14);
    container.add(shadow);

    const glow = this.add.graphics();
    glow.fillStyle(template.color, 0.06);
    glow.fillRoundedRect(-CARD_WIDTH / 2 - 6, -CARD_HEIGHT / 2 - 6, CARD_WIDTH + 12, CARD_HEIGHT + 12, 18);
    container.add(glow);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.5, to: 1 },
      yoyo: true,
      repeat: -1,
      duration: 1400,
      ease: ease.inOut,
    });

    const bg = this.add.graphics();
    this.drawCardSurface(bg, template.color, false);
    container.add(bg);

    const kindLabel = this.kindLabel(template);
    const header = this.add.text(0, -CARD_HEIGHT / 2 + 36, kindLabel, textStyle(type.overline, { color: colorToHex(template.color) }));
    header.setOrigin(0.5, 0.5);
    applyLetterSpacing(header, type.overline);
    container.add(header);

    const headerRule = this.add.rectangle(0, -CARD_HEIGHT / 2 + 58, 80, 1, template.color, 0.5);
    container.add(headerRule);

    const iconBadge = this.drawCardIcon(template, 0, -CARD_HEIGHT / 2 + 106);
    container.add(iconBadge);

    const name = this.add.text(0, -18, template.displayName, textStyle(type.h2, {
      align: "center",
      wordWrap: { width: CARD_WIDTH - 40 },
    }));
    name.setOrigin(0.5, 0.5);
    applyLetterSpacing(name, type.h2);
    container.add(name);

    const desc = this.add.text(0, 34, template.description, textStyle(type.bodyMuted, {
      align: "center",
      wordWrap: { width: CARD_WIDTH - 48 },
    }));
    desc.setOrigin(0.5, 0.5);
    container.add(desc);

    const footerRule = this.add.rectangle(0, CARD_HEIGHT / 2 - 74, CARD_WIDTH - 48, 1, palette.hairline, 0.9);
    container.add(footerRule);

    const rarityLabel = template.rarity === "rare" ? "RARA" : "COMUN";
    const rarity = this.add.text(
      -CARD_WIDTH / 2 + 24,
      CARD_HEIGHT / 2 - 42,
      rarityLabel,
      textStyle(type.overline, { color: template.rarity === "rare" ? hex.primary : hex.textDim }),
    );
    rarity.setOrigin(0, 0.5);
    applyLetterSpacing(rarity, type.overline);
    container.add(rarity);

    const action = this.add.text(
      CARD_WIDTH / 2 - 24,
      CARD_HEIGHT / 2 - 42,
      "TOMAR  →",
      textStyle(type.overline, { color: colorToHex(template.color) }),
    );
    action.setOrigin(1, 0.5);
    applyLetterSpacing(action, type.overline);
    container.add(action);

    const hit = this.add.rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT, 0x000000, 0.001);
    hit.setInteractive({ useHandCursor: true });
    container.add(hit);

    container.setAlpha(0);
    container.setY(centerY + 20);
    this.tweens.add({
      targets: container,
      alpha: 1,
      y: centerY,
      duration: dur.base,
      delay: 180 + index * 80,
      ease: ease.snap,
    });

    hit.on("pointerover", () => {
      audio.playHover();
      this.drawCardSurface(bg, template.color, true);
      this.tweens.add({
        targets: container,
        y: centerY - 10,
        scale: 1.02,
        duration: dur.fast,
        ease: ease.out,
      });
      this.tweens.add({
        targets: action,
        x: CARD_WIDTH / 2 - 20,
        duration: dur.fast,
        ease: ease.out,
      });
    });
    hit.on("pointerout", () => {
      this.drawCardSurface(bg, template.color, false);
      this.tweens.add({
        targets: container,
        y: centerY,
        scale: 1,
        duration: dur.fast,
        ease: ease.out,
      });
      this.tweens.add({
        targets: action,
        x: CARD_WIDTH / 2 - 24,
        duration: dur.fast,
        ease: ease.out,
      });
    });
    hit.on("pointerdown", () => {
      audio.playClick();
      this.tweens.add({
        targets: container,
        scale: 0.97,
        duration: 80,
        yoyo: true,
        ease: ease.out,
        onComplete: () => this.acceptOffer(offer),
      });
    });
  }

  private drawCardSurface(g: Phaser.GameObjects.Graphics, color: number, hover: boolean): void {
    g.clear();
    g.fillStyle(hover ? palette.surfaceElevated : palette.surface, 0.98);
    g.fillRoundedRect(-CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 14);
    g.lineStyle(hover ? 2 : 1, color, hover ? 0.95 : 0.55);
    g.strokeRoundedRect(-CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 14);
  }

  private drawCardIcon(template: RewardTemplate, x: number, y: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const badge = this.add.graphics();
    badge.fillStyle(palette.bgDeep, 1);
    badge.fillCircle(0, 0, 32);
    badge.lineStyle(1, template.color, 0.8);
    badge.strokeCircle(0, 0, 32);

    const inner = this.add.graphics();
    inner.lineStyle(1, template.color, 0.25);
    inner.strokeCircle(0, 0, 40);

    const symbol = this.add.text(0, 0, this.iconGlyph(template), textStyle(type.h1, {
      color: colorToHex(template.color),
    }));
    symbol.setOrigin(0.5, 0.5);

    container.add([inner, badge, symbol]);
    this.tweens.add({
      targets: inner,
      alpha: { from: 0.35, to: 0.9 },
      yoyo: true,
      repeat: -1,
      duration: 1200,
      ease: ease.inOut,
    });
    return container;
  }

  private iconGlyph(template: RewardTemplate): string {
    if (template.kind === "safe_chips") return "$";
    if (template.kind === "relic") return "✦";
    if (template.kind === "slot_play") return "⟳";
    if (template.kind === "roulette_play") return "◉";
    return "◆";
  }

  private kindLabel(template: RewardTemplate): string {
    if (template.kind === "safe_chips") return "PAGA SEGURA";
    if (template.kind === "relic") return "RELIQUIA";
    if (template.kind === "slot_play") return "SLOT MACHINE";
    if (template.kind === "roulette_play") return "RULETA";
    return "APUESTA";
  }

  private acceptOffer(offer: RewardOffer): void {
    const template = offer.template;
    if (template.kind === "safe_chips") {
      const payload = template.payload as SafeChipsPayload;
      this.resolve({
        kind: "safe_chips",
        chipsDelta: payload.amount,
        displayName: template.displayName,
      });
      return;
    }

    if (template.kind === "relic") {
      const payload = template.payload as RelicPayload;
      this.resolve({
        kind: "relic",
        chipsDelta: 0,
        relicId: payload.relicId,
        displayName: template.displayName,
      });
      return;
    }

    if (template.kind === "slot_play") {
      this.openSlotMachine();
      return;
    }

    if (template.kind === "roulette_play") {
      const payload = template.payload as RoulettePlayPayload;
      this.openRoulette(payload.stake);
      return;
    }

    const payload = template.payload as CasinoGamblePayload;
    this.playGamble(template.displayName, payload);
  }

  private openRoulette(stake: number): void {
    const data: RouletteSceneData = {
      stake,
      random: this.random,
      onResolved: (res) => this.handleRouletteResult(res),
    };
    this.scene.launch("RouletteScene", data);
  }

  private handleRouletteResult(res: RouletteResult): void {
    this.resolve({
      kind: "roulette_play",
      chipsDelta: res.chipsDelta,
      displayName: res.headline,
      casinoOutcome: res.outcome === "win" ? "win" : "lose",
    });
  }

  private openSlotMachine(): void {
    const data: SlotSceneData = {
      cost: 0,
      random: this.random,
      onResolved: (res) => this.handleSlotResult(res),
    };
    this.scene.launch("SlotScene", data);
  }

  private handleSlotResult(res: SlotResult): void {
    if (res.outcome === "loss" && res.chipsDelta === -9999) {
      this.resolve({
        kind: "slot_bust",
        chipsDelta: 0,
        displayName: res.headline,
      });
      return;
    }
    this.resolve({
      kind: "slot_play",
      chipsDelta: res.chipsDelta,
      displayName: res.headline,
    });
  }

  private playGamble(displayName: string, payload: CasinoGamblePayload): void {
    const modalBg = this.add.rectangle(0, 0, MAP_WIDTH, MAP_HEIGHT, palette.bgDeep, 0);
    modalBg.setOrigin(0, 0);
    modalBg.setInteractive();
    modalBg.setDepth(200);
    this.tweens.add({ targets: modalBg, fillAlpha: 0.6, duration: dur.fast, ease: ease.out });

    const ring = this.add.graphics();
    ring.setDepth(201);
    ring.setPosition(MAP_WIDTH / 2, MAP_HEIGHT / 2);
    const ringContainer = this.add.container(MAP_WIDTH / 2, MAP_HEIGHT / 2);
    ringContainer.setDepth(201);

    const outer = this.add.graphics();
    outer.lineStyle(2, palette.primary, 0.9);
    outer.strokeCircle(0, 0, 96);
    ringContainer.add(outer);

    const inner = this.add.graphics();
    inner.fillStyle(palette.surface, 0.95);
    inner.fillCircle(0, 0, 76);
    inner.lineStyle(1, palette.goldDeep, 0.6);
    inner.strokeCircle(0, 0, 76);
    ringContainer.add(inner);

    const label = this.add.text(MAP_WIDTH / 2, MAP_HEIGHT / 2 - 150, "TIRANDO", textStyle(type.overline, { color: hex.primary }));
    label.setOrigin(0.5, 0.5);
    label.setDepth(201);
    applyLetterSpacing(label, type.overline);

    const center = this.add.text(MAP_WIDTH / 2, MAP_HEIGHT / 2, displayName, textStyle(type.h3, {
      align: "center",
      wordWrap: { width: 160 },
    }));
    center.setOrigin(0.5, 0.5);
    center.setDepth(202);

    this.tweens.add({
      targets: ringContainer,
      rotation: Math.PI * 3,
      duration: 900,
      ease: ease.smooth,
    });
    this.tweens.add({
      targets: outer,
      alpha: { from: 0.6, to: 1 },
      yoyo: true,
      repeat: 3,
      duration: 220,
    });

    this.time.delayedCall(950, () => {
      const win = this.random() < payload.winChance;
      ringContainer.destroy();
      label.destroy();
      center.destroy();
      modalBg.destroy();

      if (win) {
        this.cameras.main.flash(240, 255, 209, 102);
        this.resolve({
          kind: "casino_gamble",
          chipsDelta: payload.winAmount,
          casinoOutcome: "win",
          displayName: `${displayName} · GANA`,
        });
      } else {
        this.cameras.main.shake(220, 0.01);
        this.cameras.main.flash(200, 255, 92, 108);
        this.resolve({
          kind: "casino_gamble",
          chipsDelta: -payload.loseAmount,
          casinoOutcome: "lose",
          displayName: `${displayName} · PIERDE`,
        });
      }
    });
  }

  private resolve(resolution: BetweenWavesResolution): void {
    if (this.resolved) return;
    this.resolved = true;
    this.payload.onResolved(resolution);
    this.scene.stop();
  }
}
