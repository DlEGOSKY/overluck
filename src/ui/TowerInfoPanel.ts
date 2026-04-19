import Phaser from "phaser";
import type { Tower } from "@/entities/Tower";
import type { ChipManager } from "@/systems/ChipManager";
import { audio } from "@/systems/AudioManager";
import {
  applyLetterSpacing,
  colorToHex,
  dur,
  ease,
  hex,
  palette,
  textStyle,
  type,
} from "./theme";

const PANEL_WIDTH = 260;
const PANEL_HEIGHT = 236;
const SELL_BTN_H = 32;

export interface TowerInfoPanelDeps {
  chips: ChipManager;
  onUpgradeRequested: (tower: Tower) => boolean;
  onSellRequested?: (tower: Tower) => void;
  onMoveRequested?: (tower: Tower) => void;
  getSellRefund?: (tower: Tower) => number;
  getRelocateFee?: () => number;
  getSynergyLabels?: (tower: Tower) => string[];
}

export class TowerInfoPanel {
  private readonly scene: Phaser.Scene;
  private readonly deps: TowerInfoPanelDeps;

  private readonly container: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly header: Phaser.GameObjects.Text;
  private readonly tierBadge: Phaser.GameObjects.Graphics;
  private readonly tierLabel: Phaser.GameObjects.Text;
  private readonly statsText: Phaser.GameObjects.Text;
  private readonly upgradeSummary: Phaser.GameObjects.Text;
  private readonly button: Phaser.GameObjects.Graphics;
  private readonly buttonHit: Phaser.GameObjects.Rectangle;
  private readonly buttonLabel: Phaser.GameObjects.Text;
  private readonly buttonSub: Phaser.GameObjects.Text;
  private readonly pointerArrow: Phaser.GameObjects.Graphics;
  private readonly backdrop: Phaser.GameObjects.Rectangle;

  private readonly synergyText: Phaser.GameObjects.Text;
  private currentTower: Tower | null = null;
  private buttonState: "idle" | "hover" | "disabled" = "idle";
  private accentColor: number = palette.primary;

  public constructor(scene: Phaser.Scene, deps: TowerInfoPanelDeps) {
    this.scene = scene;
    this.deps = deps;

    // Invisible backdrop that catches clicks outside the panel to close it
    this.backdrop = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0x000000, 0.001);
    this.backdrop.setOrigin(0, 0);
    this.backdrop.setDepth(199);
    this.backdrop.setVisible(false);
    this.backdrop.setInteractive();
    this.backdrop.on("pointerdown", () => this.hide());

    this.container = scene.add.container(0, 0);
    this.container.setDepth(200);
    this.container.setVisible(false);

    this.bg = scene.add.graphics();
    this.container.add(this.bg);

    this.pointerArrow = scene.add.graphics();
    this.container.add(this.pointerArrow);

    this.header = scene.add.text(16, 14, "", textStyle(type.h3));
    this.header.setDepth(201);
    applyLetterSpacing(this.header, type.h3);
    this.container.add(this.header);

    this.tierBadge = scene.add.graphics();
    this.container.add(this.tierBadge);

    this.tierLabel = scene.add.text(PANEL_WIDTH - 20, 20, "", textStyle(type.overline, { color: hex.textInverted }));
    this.tierLabel.setOrigin(1, 0.5);
    applyLetterSpacing(this.tierLabel, type.overline);
    this.container.add(this.tierLabel);

    this.statsText = scene.add.text(16, 42, "", textStyle(type.caption, { color: hex.textMuted }));
    this.statsText.setLineSpacing(4);
    this.container.add(this.statsText);

    this.upgradeSummary = scene.add.text(16, 104, "", textStyle(type.caption, { color: hex.primary }));
    this.upgradeSummary.setWordWrapWidth(PANEL_WIDTH - 32);
    this.container.add(this.upgradeSummary);

    this.button = scene.add.graphics();
    this.container.add(this.button);

    this.buttonHit = scene.add.rectangle(PANEL_WIDTH / 2, PANEL_HEIGHT - 28, PANEL_WIDTH - 32, 40, 0x000000, 0.001);
    this.buttonHit.setInteractive({ useHandCursor: true });
    this.container.add(this.buttonHit);

    this.buttonLabel = scene.add.text(PANEL_WIDTH / 2, PANEL_HEIGHT - 34, "MEJORAR", textStyle(type.h3, { color: hex.textInverted }));
    this.buttonLabel.setOrigin(0.5, 0.5);
    applyLetterSpacing(this.buttonLabel, type.h3);
    this.container.add(this.buttonLabel);

    this.buttonSub = scene.add.text(PANEL_WIDTH / 2, PANEL_HEIGHT - 16, "", textStyle(type.overline, { color: "#4a3a00" }));
    this.buttonSub.setOrigin(0.5, 0);
    applyLetterSpacing(this.buttonSub, type.overline);
    this.container.add(this.buttonSub);

    this.buttonHit.on("pointerover", () => {
      if (this.buttonState === "disabled") return;
      audio.playHover();
      this.buttonState = "hover";
      this.redrawButton();
    });
    this.buttonHit.on("pointerout", () => {
      if (this.buttonState === "disabled") return;
      this.buttonState = "idle";
      this.redrawButton();
    });
    this.buttonHit.on("pointerdown", () => this.tryUpgrade());

    this.synergyText = scene.add.text(16, 42, "", textStyle(type.caption, { color: hex.gold }));
    this.synergyText.setWordWrapWidth(PANEL_WIDTH - 32);
    this.container.add(this.synergyText);

    // Sell + Move secondary row
    this.buildSecondaryButtons();

    // Stop propagation so clicks inside the panel don't reach the backdrop
    const panelHit = scene.add.rectangle(PANEL_WIDTH / 2, PANEL_HEIGHT / 2, PANEL_WIDTH, PANEL_HEIGHT, 0x000000, 0.001);
    panelHit.setInteractive();
    panelHit.on("pointerdown", (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
    });
    // Insert below interactive children so they still get events
    this.container.addAt(panelHit, 1);
  }

  public show(tower: Tower): void {
    if (this.currentTower === tower && this.container.visible) return;
    this.currentTower = tower;
    audio.playClick();
    tower.setRangeVisible(true);

    this.accentColor = tower.definition.color;
    this.positionNear(tower.x, tower.y);
    this.render();

    this.container.setVisible(true);
    this.backdrop.setVisible(true);
    this.container.setAlpha(0);
    this.container.setScale(0.92);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      scale: 1,
      duration: dur.fast,
      ease: ease.snap,
    });
  }

  public hide(): void {
    if (this.currentTower) this.currentTower.setRangeVisible(false);
    this.currentTower = null;
    this.backdrop.setVisible(false);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: dur.fast,
      ease: ease.out,
      onComplete: () => this.container.setVisible(false),
    });
  }

  public isOpen(): boolean {
    return this.currentTower !== null;
  }

  public refresh(): void {
    if (!this.currentTower) return;
    this.render();
  }

  public resize(): void {
    this.backdrop.setSize(this.scene.scale.width, this.scene.scale.height);
  }

  private positionNear(towerX: number, towerY: number): void {
    const worldW = this.scene.scale.width;
    const worldH = this.scene.scale.height;

    // Prefer placing the panel above the tower. Fall back below when it would
    // clip the top hud.
    let x = towerX - PANEL_WIDTH / 2;
    let y = towerY - PANEL_HEIGHT - 28;
    let arrowDown = true;

    if (y < 80) {
      y = towerY + 28;
      arrowDown = false;
    }

    x = Math.max(12, Math.min(x, worldW - PANEL_WIDTH - 12));
    y = Math.max(12, Math.min(y, worldH - PANEL_HEIGHT - 12));

    this.container.setPosition(x, y);

    // Arrow points back to the tower
    this.pointerArrow.clear();
    const localTx = towerX - x;
    this.pointerArrow.fillStyle(this.accentColor, 1);
    if (arrowDown) {
      this.pointerArrow.beginPath();
      this.pointerArrow.moveTo(localTx - 8, PANEL_HEIGHT);
      this.pointerArrow.lineTo(localTx + 8, PANEL_HEIGHT);
      this.pointerArrow.lineTo(localTx, PANEL_HEIGHT + 10);
      this.pointerArrow.closePath();
      this.pointerArrow.fillPath();
    } else {
      this.pointerArrow.beginPath();
      this.pointerArrow.moveTo(localTx - 8, 0);
      this.pointerArrow.lineTo(localTx + 8, 0);
      this.pointerArrow.lineTo(localTx, -10);
      this.pointerArrow.closePath();
      this.pointerArrow.fillPath();
    }
  }

  private render(): void {
    const tower = this.currentTower;
    if (!tower) return;

    const def = tower.definition;
    const stats = tower.getStats();
    const nextUpgrade = tower.getNextUpgrade();

    // Background card
    this.bg.clear();
    this.bg.fillStyle(palette.surfaceElevated, 0.97);
    this.bg.fillRoundedRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 12);
    this.bg.lineStyle(1, this.accentColor, 0.85);
    this.bg.strokeRoundedRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 12);
    // Left accent strip
    this.bg.fillStyle(this.accentColor, 1);
    this.bg.fillRect(0, 0, 3, PANEL_HEIGHT);

    // Header
    this.header.setText(def.displayName.toUpperCase());
    this.header.setColor(colorToHex(this.accentColor));

    // Tier badge (top right)
    this.tierBadge.clear();
    this.tierBadge.fillStyle(this.accentColor, 1);
    this.tierBadge.fillRoundedRect(PANEL_WIDTH - 68, 12, 52, 20, 4);
    this.tierLabel.setText(tower.getTierLabel());
    this.tierLabel.setX(PANEL_WIDTH - 16);
    this.tierLabel.setY(22);

    // Stats
    const dps = ((stats.damage * 1000) / stats.fireRateMs).toFixed(1);
    const lines = [
      `Daño       ${stats.damage}`,
      `Cadencia   ${stats.fireRateMs} ms`,
      `Rango      ${stats.range}`,
      `DPS        ${dps}`,
    ];
    if (stats.splash) {
      lines.push(`Splash     ${stats.splash.radius} r`);
    }
    if (stats.roll) {
      const critPct = Math.round(stats.roll.critChance * 100);
      lines.push(`Crit       ${critPct}%  ·  x${stats.roll.critMultiplier}`);
    }
    this.statsText.setText(lines.join("\n"));

    // Synergy tags
    const synergyLabels = this.deps.getSynergyLabels?.(tower) ?? [];
    if (synergyLabels.length > 0) {
      this.synergyText.setText(synergyLabels.join("  ·  "));
      this.synergyText.setVisible(true);
      this.synergyText.setY(this.statsText.y + this.statsText.height + 6);
    } else {
      this.synergyText.setVisible(false);
    }

    // Upgrade preview / button
    if (nextUpgrade) {
      this.upgradeSummary.setText(`Siguiente  ${nextUpgrade.tierLabel}: ${nextUpgrade.summary}`);
      this.upgradeSummary.setVisible(true);
      const affordable = this.deps.chips.canAfford(nextUpgrade.cost);
      this.buttonState = affordable ? "idle" : "disabled";
      this.buttonLabel.setText("MEJORAR");
      this.buttonLabel.setColor(affordable ? hex.textInverted : hex.textDim);
      this.buttonSub.setText(`${nextUpgrade.cost} fichas`);
      this.buttonSub.setColor(affordable ? "#4a3a00" : hex.danger);
    } else {
      this.upgradeSummary.setText("Nivel máximo alcanzado");
      this.upgradeSummary.setVisible(true);
      this.buttonState = "disabled";
      this.buttonLabel.setText("SIN MEJORAS");
      this.buttonLabel.setColor(hex.textDim);
      this.buttonSub.setText("");
    }

    // Secondary button labels reflect current state.
    const refund = this.deps.getSellRefund ? this.deps.getSellRefund(tower) : 0;
    const fee = this.deps.getRelocateFee ? this.deps.getRelocateFee() : 0;
    this.sellLabel.setText(`VENDER  +${refund}`);
    const canMove = this.deps.chips.canAfford(fee);
    this.moveLabel.setText(`MOVER  ${fee}`);
    this.moveLabel.setColor(canMove ? hex.text : hex.textDim);

    this.redrawButton();
  }

  private redrawButton(): void {
    const g = this.button;
    g.clear();
    const x = 16;
    const y = PANEL_HEIGHT - 48;
    const w = PANEL_WIDTH - 32;
    const h = 40;

    let top: number = palette.primary;
    let bottom: number = palette.primaryDeep;
    if (this.buttonState === "hover") {
      top = 0xffe08a;
      bottom = palette.primary;
    } else if (this.buttonState === "disabled") {
      top = palette.surface;
      bottom = palette.bgDeep;
    }

    g.fillGradientStyle(top, top, bottom, bottom, 1, 1, 1, 1);
    g.fillRoundedRect(x, y, w, h, 8);
    g.lineStyle(1, this.buttonState === "disabled" ? palette.hairline : palette.goldDeep, 0.9);
    g.strokeRoundedRect(x, y, w, h, 8);

    // Inner shine
    if (this.buttonState !== "disabled") {
      g.fillStyle(0xffffff, 0.15);
      g.fillRoundedRect(x + 3, y + 3, w - 6, (h - 6) / 2, 6);
    }
  }

  private sellBg!: Phaser.GameObjects.Graphics;
  private sellHit!: Phaser.GameObjects.Rectangle;
  private sellLabel!: Phaser.GameObjects.Text;
  private moveBg!: Phaser.GameObjects.Graphics;
  private moveHit!: Phaser.GameObjects.Rectangle;
  private moveLabel!: Phaser.GameObjects.Text;

  private buildSecondaryButtons(): void {
    const y = PANEL_HEIGHT - 84;
    const halfW = (PANEL_WIDTH - 40) / 2;
    const leftX = 16;
    const rightX = 16 + halfW + 8;

    this.sellBg = this.scene.add.graphics();
    this.container.add(this.sellBg);
    this.sellLabel = this.scene.add.text(leftX + halfW / 2, y + SELL_BTN_H / 2, "VENDER", textStyle(type.overline, { color: hex.text }));
    this.sellLabel.setOrigin(0.5, 0.5);
    applyLetterSpacing(this.sellLabel, type.overline);
    this.container.add(this.sellLabel);
    this.sellHit = this.scene.add.rectangle(leftX + halfW / 2, y + SELL_BTN_H / 2, halfW, SELL_BTN_H, 0x000000, 0.001);
    this.sellHit.setInteractive({ useHandCursor: true });
    this.container.add(this.sellHit);
    this.sellHit.on("pointerover", () => { audio.playHover(); this.redrawSecondary("sell", true); });
    this.sellHit.on("pointerout", () => this.redrawSecondary("sell", false));
    this.sellHit.on("pointerdown", () => this.trySell());

    this.moveBg = this.scene.add.graphics();
    this.container.add(this.moveBg);
    this.moveLabel = this.scene.add.text(rightX + halfW / 2, y + SELL_BTN_H / 2, "MOVER", textStyle(type.overline, { color: hex.text }));
    this.moveLabel.setOrigin(0.5, 0.5);
    applyLetterSpacing(this.moveLabel, type.overline);
    this.container.add(this.moveLabel);
    this.moveHit = this.scene.add.rectangle(rightX + halfW / 2, y + SELL_BTN_H / 2, halfW, SELL_BTN_H, 0x000000, 0.001);
    this.moveHit.setInteractive({ useHandCursor: true });
    this.container.add(this.moveHit);
    this.moveHit.on("pointerover", () => { audio.playHover(); this.redrawSecondary("move", true); });
    this.moveHit.on("pointerout", () => this.redrawSecondary("move", false));
    this.moveHit.on("pointerdown", () => this.tryMove());

    this.redrawSecondary("sell", false);
    this.redrawSecondary("move", false);
  }

  private redrawSecondary(which: "sell" | "move", hover: boolean): void {
    const y = PANEL_HEIGHT - 84;
    const halfW = (PANEL_WIDTH - 40) / 2;
    const g = which === "sell" ? this.sellBg : this.moveBg;
    const x = which === "sell" ? 16 : 16 + halfW + 8;
    const accent = which === "sell" ? palette.danger : palette.gold;
    g.clear();
    g.fillStyle(hover ? accent : palette.surface, hover ? 0.85 : 0.9);
    g.fillRoundedRect(x, y, halfW, SELL_BTN_H, 6);
    g.lineStyle(1, accent, hover ? 1 : 0.6);
    g.strokeRoundedRect(x, y, halfW, SELL_BTN_H, 6);
  }

  private trySell(): void {
    if (!this.currentTower || !this.deps.onSellRequested) return;
    const t = this.currentTower;
    this.deps.onSellRequested(t);
    this.hide();
  }

  private tryMove(): void {
    if (!this.currentTower || !this.deps.onMoveRequested) return;
    const t = this.currentTower;
    this.deps.onMoveRequested(t);
    this.hide();
  }

  private tryUpgrade(): void {
    if (!this.currentTower || this.buttonState === "disabled") return;
    const tower = this.currentTower;
    const applied = this.deps.onUpgradeRequested(tower);
    if (!applied) return;
    this.render();
  }
}
