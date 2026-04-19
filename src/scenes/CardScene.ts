import Phaser from "phaser";
import { MAP_HEIGHT, MAP_WIDTH } from "@/data/path";
import { audio } from "@/systems/AudioManager";
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
 * Blackjack — single-hand, single-deck against the dealer.
 * Outcomes (paid as chips relative to `stake`):
 *   blackjack (natural 21)      → +stake * 1.5 (rounded)
 *   win                         → +stake
 *   push                        → 0
 *   loss / bust                 → -stake
 *
 * Kept simple on purpose: no splits/doubles/insurance. Scene resolves after
 * stand or any terminal condition, then waits for confirm input to close.
 */

export type CardSuit = "♠" | "♥" | "♦" | "♣";
export type CardRank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export interface PlayingCard {
  rank: CardRank;
  suit: CardSuit;
}

export type CardOutcome = "blackjack" | "win" | "push" | "loss";

export interface CardResult {
  outcome: CardOutcome;
  chipsDelta: number;
  playerTotal: number;
  dealerTotal: number;
}

export interface CardSceneData {
  stake: number;
  onResolved: (res: CardResult) => void;
  random?: () => number;
}

const SUITS: readonly CardSuit[] = ["♠", "♥", "♦", "♣"];
const RANKS: readonly CardRank[] = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

const CARD_W = 92;
const CARD_H = 132;
const CARD_GAP = 12;

export class CardScene extends Phaser.Scene {
  private payload!: CardSceneData;
  private random!: () => number;
  private resolved = false;
  private finished = false;

  private deck: PlayingCard[] = [];
  private playerHand: PlayingCard[] = [];
  private dealerHand: PlayingCard[] = [];
  private dealerHoleHidden = true;

  private dealerRow!: Phaser.GameObjects.Container;
  private playerRow!: Phaser.GameObjects.Container;
  private dealerTotalText!: Phaser.GameObjects.Text;
  private playerTotalText!: Phaser.GameObjects.Text;
  private outcomeText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private hitBtn!: Phaser.GameObjects.Container;
  private standBtn!: Phaser.GameObjects.Container;

  public constructor() {
    super({ key: "CardScene" });
  }

  public init(data: CardSceneData): void {
    this.payload = data;
    this.random = data.random ?? Math.random;
    this.resolved = false;
    this.finished = false;
    this.dealerHoleHidden = true;
    this.deck = this.buildShuffledDeck();
    this.playerHand = [];
    this.dealerHand = [];
  }

  public create(): void {
    audio.startAmbient("casino");
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audio.stopAmbient());
    this.drawBackdrop();
    this.drawHeader();
    this.drawTable();
    this.drawControls();
    this.bindKeys();

    // Initial deal: player, dealer, player, dealer(hidden)
    this.time.delayedCall(200, () => this.dealTo("player"));
    this.time.delayedCall(420, () => this.dealTo("dealer"));
    this.time.delayedCall(640, () => this.dealTo("player"));
    this.time.delayedCall(860, () => {
      this.dealTo("dealer");
      this.checkInitialBlackjack();
    });
  }

  // --- Layout ---------------------------------------------------------------

  private drawBackdrop(): void {
    const dim = this.add.rectangle(0, 0, MAP_WIDTH, MAP_HEIGHT, 0x000000, 0.72);
    dim.setOrigin(0, 0);
    dim.setDepth(0);

    // Felt table
    const feltW = 900;
    const feltH = 500;
    const felt = this.add.graphics();
    felt.setDepth(1);
    felt.fillStyle(palette.felt, 0.98);
    felt.fillRoundedRect((MAP_WIDTH - feltW) / 2, (MAP_HEIGHT - feltH) / 2, feltW, feltH, 22);
    felt.lineStyle(3, palette.feltRim, 1);
    felt.strokeRoundedRect((MAP_WIDTH - feltW) / 2, (MAP_HEIGHT - feltH) / 2, feltW, feltH, 22);
    felt.lineStyle(1, palette.gold, 0.4);
    felt.strokeRoundedRect((MAP_WIDTH - feltW) / 2 + 10, (MAP_HEIGHT - feltH) / 2 + 10, feltW - 20, feltH - 20, 18);
  }

  private drawHeader(): void {
    const cx = MAP_WIDTH / 2;
    const eyebrow = this.add.text(cx, 78, "MESA DEL CRUPIER", textStyle(type.overline, { color: hex.primary }));
    eyebrow.setOrigin(0.5, 0.5);
    eyebrow.setDepth(10);
    applyLetterSpacing(eyebrow, type.overline);

    const headline = this.add.text(cx, 118, "BLACKJACK", textStyle(type.display, { color: hex.gold }));
    headline.setOrigin(0.5, 0.5);
    headline.setDepth(10);
    applyLetterSpacing(headline, type.display);

    const ornament = drawOrnament(this, cx, 150, 240);
    ornament.setDepth(10);

    const stakeLine = this.add.text(cx, MAP_HEIGHT - 150, `APUESTA  ${this.payload.stake} fichas`, textStyle(type.overline, { color: hex.textMuted }));
    stakeLine.setOrigin(0.5, 0.5);
    stakeLine.setDepth(10);
    applyLetterSpacing(stakeLine, type.overline);
  }

  private drawTable(): void {
    const cx = MAP_WIDTH / 2;
    const dealerY = MAP_HEIGHT / 2 - 110;
    const playerY = MAP_HEIGHT / 2 + 70;

    const dealerLabel = this.add.text(cx - 420, dealerY - 58, "CRUPIER", textStyle(type.overline, { color: hex.textMuted }));
    dealerLabel.setDepth(10);
    applyLetterSpacing(dealerLabel, type.overline);

    const playerLabel = this.add.text(cx - 420, playerY - 58, "TÚ", textStyle(type.overline, { color: hex.primary }));
    playerLabel.setDepth(10);
    applyLetterSpacing(playerLabel, type.overline);

    this.dealerTotalText = this.add.text(cx + 420, dealerY - 58, "", textStyle(type.h2, { color: hex.textMuted }));
    this.dealerTotalText.setOrigin(1, 0);
    this.dealerTotalText.setDepth(10);
    applyLetterSpacing(this.dealerTotalText, type.h2);

    this.playerTotalText = this.add.text(cx + 420, playerY - 58, "", textStyle(type.h2, { color: hex.primary }));
    this.playerTotalText.setOrigin(1, 0);
    this.playerTotalText.setDepth(10);
    applyLetterSpacing(this.playerTotalText, type.h2);

    this.dealerRow = this.add.container(cx, dealerY);
    this.dealerRow.setDepth(10);
    this.playerRow = this.add.container(cx, playerY);
    this.playerRow.setDepth(10);

    this.outcomeText = this.add.text(cx, MAP_HEIGHT / 2, "", textStyle(type.display, { color: hex.text }));
    this.outcomeText.setOrigin(0.5, 0.5);
    this.outcomeText.setDepth(30);
    applyLetterSpacing(this.outcomeText, type.display);
    this.outcomeText.setAlpha(0);

    this.hintText = this.add.text(cx, MAP_HEIGHT - 96, "H = Pedir  ·  S = Plantarse", textStyle(type.caption, { color: hex.textMuted }));
    this.hintText.setOrigin(0.5, 0.5);
    this.hintText.setDepth(10);
    applyLetterSpacing(this.hintText, type.caption);
  }

  private drawControls(): void {
    const y = MAP_HEIGHT - 52;
    this.hitBtn = this.makeButton(MAP_WIDTH / 2 - 130, y, 220, 42, "PEDIR  ·  H", palette.primary, () => this.playerHit());
    this.standBtn = this.makeButton(MAP_WIDTH / 2 + 130, y, 220, 42, "PLANTARSE  ·  S", palette.surface, () => this.playerStand());
  }

  private makeButton(
    cx: number,
    cy: number,
    w: number,
    h: number,
    label: string,
    fillColor: number,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const c = this.add.container(cx, cy);
    c.setDepth(20);
    const bg = this.add.graphics();
    const redraw = (hover: boolean): void => {
      bg.clear();
      bg.fillStyle(hover ? palette.gold : fillColor, 0.95);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
      bg.lineStyle(1, palette.gold, 0.9);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    };
    redraw(false);
    const text = this.add.text(0, 0, label, textStyle(type.overline, { color: hex.textInverted }));
    text.setOrigin(0.5, 0.5);
    applyLetterSpacing(text, type.overline);
    const hit = this.add.rectangle(0, 0, w, h, 0x000000, 0.001).setInteractive({ useHandCursor: true });
    hit.on("pointerover", () => redraw(true));
    hit.on("pointerout", () => redraw(false));
    hit.on("pointerdown", () => onClick());
    c.add([bg, text, hit]);
    return c;
  }

  private bindKeys(): void {
    this.input.keyboard?.on("keydown-H", () => this.playerHit());
    this.input.keyboard?.on("keydown-S", () => this.playerStand());
    this.input.keyboard?.on("keydown-ENTER", () => {
      if (this.finished) this.closeScene();
    });
    this.input.keyboard?.on("keydown-SPACE", () => {
      if (this.finished) this.closeScene();
    });
  }

  // --- Gameplay -------------------------------------------------------------

  private buildShuffledDeck(): PlayingCard[] {
    const deck: PlayingCard[] = [];
    for (const s of SUITS) {
      for (const r of RANKS) deck.push({ rank: r, suit: s });
    }
    // Fisher–Yates
    for (let i = deck.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  private dealTo(who: "player" | "dealer"): void {
    const card = this.deck.pop();
    if (!card) return;
    if (who === "player") {
      this.playerHand.push(card);
      this.addCardVisual(this.playerRow, this.playerHand.length - 1, card, false);
    } else {
      this.dealerHand.push(card);
      const hidden = this.dealerHand.length === 2 && this.dealerHoleHidden;
      this.addCardVisual(this.dealerRow, this.dealerHand.length - 1, card, hidden);
    }
    audio.playClick();
    this.refreshTotals();
  }

  private addCardVisual(
    row: Phaser.GameObjects.Container,
    index: number,
    card: PlayingCard,
    hidden: boolean,
  ): void {
    const count = index + 1;
    const totalW = count * CARD_W + (count - 1) * CARD_GAP;
    const startX = -totalW / 2 + CARD_W / 2;

    // Recompute x of existing cards to keep them centered.
    row.list.forEach((child, i) => {
      const target = this.add.tween({
        targets: child,
        x: startX + i * (CARD_W + CARD_GAP),
        duration: dur.base,
        ease: ease.out,
      });
      target; // satisfy noUnusedLocals
    });

    const cardContainer = this.add.container(MAP_WIDTH, 0);
    const bg = this.add.graphics();
    const isRed = card.suit === "♥" || card.suit === "♦";
    const redrawFace = (faceUp: boolean): void => {
      bg.clear();
      if (faceUp) {
        bg.fillStyle(0xf4ece0, 1);
        bg.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 10);
        bg.lineStyle(1, 0x2a2a36, 0.8);
        bg.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 10);
      } else {
        bg.fillStyle(palette.chipRed, 0.95);
        bg.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 10);
        bg.lineStyle(2, palette.gold, 0.9);
        bg.strokeRoundedRect(-CARD_W / 2 + 4, -CARD_H / 2 + 4, CARD_W - 8, CARD_H - 8, 8);
      }
    };
    redrawFace(!hidden);

    const color = isRed ? "#c0392b" : "#1a1a22";
    const rankTop = this.add.text(-CARD_W / 2 + 10, -CARD_H / 2 + 8, card.rank, textStyle(type.h2, { color }));
    const suitTop = this.add.text(-CARD_W / 2 + 10, -CARD_H / 2 + 34, card.suit, textStyle(type.body, { color }));
    const suitCenter = this.add.text(0, 0, card.suit, textStyle(type.display, { color }));
    suitCenter.setOrigin(0.5, 0.5);
    const rankBot = this.add.text(CARD_W / 2 - 10, CARD_H / 2 - 30, card.rank, textStyle(type.h2, { color }));
    rankBot.setOrigin(1, 1);

    cardContainer.add([bg, rankTop, suitTop, suitCenter, rankBot]);

    // Toggle visibility if hidden on creation.
    if (hidden) {
      rankTop.setVisible(false);
      suitTop.setVisible(false);
      suitCenter.setVisible(false);
      rankBot.setVisible(false);
      (cardContainer as unknown as { _reveal: () => void })._reveal = () => {
        this.tweens.add({
          targets: cardContainer,
          scaleX: { from: 1, to: 0 },
          duration: 120,
          ease: "Quad.In",
          onComplete: () => {
            redrawFace(true);
            rankTop.setVisible(true);
            suitTop.setVisible(true);
            suitCenter.setVisible(true);
            rankBot.setVisible(true);
            this.tweens.add({ targets: cardContainer, scaleX: { from: 0, to: 1 }, duration: 160, ease: ease.out });
          },
        });
      };
    }

    row.add(cardContainer);
    cardContainer.setAlpha(0);
    this.tweens.add({
      targets: cardContainer,
      x: startX + index * (CARD_W + CARD_GAP),
      alpha: 1,
      duration: dur.base,
      ease: ease.out,
    });
  }

  private revealDealerHole(): void {
    if (!this.dealerHoleHidden) return;
    this.dealerHoleHidden = false;
    const second = this.dealerRow.list[1] as unknown as { _reveal?: () => void } | undefined;
    second?._reveal?.();
    this.time.delayedCall(180, () => this.refreshTotals());
  }

  private refreshTotals(): void {
    const pt = this.handTotal(this.playerHand);
    this.playerTotalText.setText(String(pt));
    if (this.dealerHoleHidden && this.dealerHand.length >= 2) {
      this.dealerTotalText.setText("?");
    } else {
      this.dealerTotalText.setText(String(this.handTotal(this.dealerHand)));
    }
  }

  private handTotal(hand: readonly PlayingCard[]): number {
    let total = 0;
    let aces = 0;
    for (const c of hand) {
      if (c.rank === "A") {
        total += 11;
        aces += 1;
      } else if (c.rank === "K" || c.rank === "Q" || c.rank === "J" || c.rank === "10") {
        total += 10;
      } else {
        total += Number(c.rank);
      }
    }
    while (total > 21 && aces > 0) {
      total -= 10;
      aces -= 1;
    }
    return total;
  }

  private playerHit(): void {
    if (this.finished) return;
    this.dealTo("player");
    const total = this.handTotal(this.playerHand);
    if (total > 21) {
      this.playerStand(true);
    } else if (total === 21) {
      this.playerStand();
    }
  }

  private playerStand(bust = false): void {
    if (this.finished) return;
    this.hitBtn.setVisible(false);
    this.standBtn.setVisible(false);
    this.hintText.setText("El crupier revela...");

    this.revealDealerHole();
    if (bust) {
      this.time.delayedCall(500, () => this.finish());
      return;
    }
    this.time.delayedCall(500, () => this.dealerPlay());
  }

  private dealerPlay(): void {
    const drawOne = (): void => {
      const total = this.handTotal(this.dealerHand);
      if (total < 17) {
        this.dealTo("dealer");
        this.time.delayedCall(420, drawOne);
      } else {
        this.finish();
      }
    };
    drawOne();
  }

  private checkInitialBlackjack(): void {
    const p = this.handTotal(this.playerHand);
    if (p === 21) {
      this.hitBtn.setVisible(false);
      this.standBtn.setVisible(false);
      this.hintText.setText("¡Blackjack natural!");
      this.revealDealerHole();
      this.time.delayedCall(500, () => this.finish());
    }
  }

  // --- Resolution -----------------------------------------------------------

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    const player = this.handTotal(this.playerHand);
    const dealer = this.handTotal(this.dealerHand);
    const natural = player === 21 && this.playerHand.length === 2;

    let outcome: CardOutcome;
    let delta = 0;
    const stake = this.payload.stake;
    if (player > 21) {
      outcome = "loss";
      delta = -stake;
    } else if (natural && dealer !== 21) {
      outcome = "blackjack";
      delta = Math.round(stake * 1.5);
    } else if (dealer > 21 || player > dealer) {
      outcome = "win";
      delta = stake;
    } else if (player === dealer) {
      outcome = "push";
      delta = 0;
    } else {
      outcome = "loss";
      delta = -stake;
    }

    this.showOutcome(outcome, delta);
    this.payload.onResolved({
      outcome,
      chipsDelta: delta,
      playerTotal: player,
      dealerTotal: dealer,
    });
  }

  private showOutcome(outcome: CardOutcome, delta: number): void {
    const label =
      outcome === "blackjack"
        ? "BLACKJACK"
        : outcome === "win"
          ? "GANAS"
          : outcome === "push"
            ? "EMPATE"
            : "PIERDES";
    const color =
      outcome === "blackjack" || outcome === "win"
        ? hex.gold
        : outcome === "push"
          ? hex.textMuted
          : hex.danger;
    const sign = delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "±0";

    this.outcomeText.setText(`${label}  ·  ${sign} fichas`);
    this.outcomeText.setColor(color);
    this.tweens.add({ targets: this.outcomeText, alpha: 1, duration: dur.base, ease: ease.out });

    this.hintText.setText("ENTER / ESPACIO para continuar");

    if (outcome === "blackjack" || outcome === "win") {
      audio.playReward();
      this.cameras.main.flash(140, 255, 209, 102, false);
    } else if (outcome === "push") {
      audio.playClick();
    } else {
      audio.playGameOver();
      this.cameras.main.shake(180, 0.005);
    }
  }

  private closeScene(): void {
    if (this.resolved) return;
    this.resolved = true;
    this.cameras.main.fadeOut(180, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.stop());
  }
}
