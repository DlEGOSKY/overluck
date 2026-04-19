import Phaser from "phaser";
import type { RelicDefinition, WaveModifierDefinition } from "@/types";
import {
  applyLetterSpacing,
  colorToHex,
  drawChipIcon,
  drawEnemyIcon,
  drawHeartIcon,
  drawRelicIcon,
  drawTowerIcon,
  drawWaveIcon,
  dur,
  ease,
  hex,
  palette,
  space,
  textStyle,
  type,
} from "./theme";

const PANEL_HEIGHT = 64;

export interface HUDState {
  chips: number;
  baseHp: number;
  baseHpMax: number;
  waveLabel: string;
  waveProgress: string;
  towerName: string;
  towerCost: number;
  towerColor: number;
  enemiesAlive: number;
  relics: readonly RelicDefinition[];
  activeModifier: WaveModifierDefinition | null;
  statusText: string;
  actionHint: string;
  actionPrimary: boolean;
}

interface MetricColumn {
  iconContainer: Phaser.GameObjects.Container | Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  value: Phaser.GameObjects.Text;
  divider: Phaser.GameObjects.Rectangle;
  rightEdge: number;
}

export class HUD {
  private readonly scene: Phaser.Scene;
  private readonly worldWidth: number;

  private readonly panelBg: Phaser.GameObjects.Rectangle;
  private readonly panelGradient: Phaser.GameObjects.Graphics;
  private readonly panelRim: Phaser.GameObjects.Rectangle;
  private readonly hintBar: Phaser.GameObjects.Rectangle;

  private readonly columns = new Map<string, MetricColumn>();

  private readonly statusText: Phaser.GameObjects.Text;
  private readonly hintText: Phaser.GameObjects.Text;
  private readonly relicsHeader: Phaser.GameObjects.Text;
  private readonly relicSlots: {
    container: Phaser.GameObjects.Container;
    bg: Phaser.GameObjects.Graphics;
    iconHolder: Phaser.GameObjects.Container;
    currentIcon: Phaser.GameObjects.GameObject | null;
    currentRelicId: string | null;
    text: Phaser.GameObjects.Text;
  }[] = [];

  private hintPulse: Phaser.Tweens.Tween | null = null;

  // Wave modifier ("pacto del crupier") chip shown below the top panel.
  private pactChip!: Phaser.GameObjects.Container;
  private pactBg!: Phaser.GameObjects.Graphics;
  private pactLabel!: Phaser.GameObjects.Text;
  private pactPulse: Phaser.Tweens.Tween | null = null;
  private lastPactId: string | null = null;

  public constructor(scene: Phaser.Scene, worldWidth: number, worldHeight: number) {
    this.scene = scene;
    this.worldWidth = worldWidth;

    this.panelBg = scene.add.rectangle(0, 0, worldWidth, PANEL_HEIGHT, palette.bgDeep, 0.94);
    this.panelBg.setOrigin(0, 0);
    this.panelBg.setDepth(100);

    this.panelGradient = scene.add.graphics();
    this.panelGradient.setDepth(100);
    this.panelGradient.fillGradientStyle(
      palette.surface,
      palette.surface,
      palette.bg,
      palette.bg,
      0.85,
      0.85,
      0.95,
      0.95,
    );
    this.panelGradient.fillRect(0, 0, worldWidth, PANEL_HEIGHT);

    this.panelRim = scene.add.rectangle(0, PANEL_HEIGHT - 1, worldWidth, 1, palette.gold, 0.35);
    this.panelRim.setOrigin(0, 0);
    this.panelRim.setDepth(100);

    this.buildColumn("chips", space.lg, "FICHAS", "chip", palette.primary);
    this.buildColumn("base", space.lg + 190, "BASE", "heart", palette.danger);
    this.buildColumn("wave", space.lg + 380, "OLEADA", "wave", palette.accent);
    this.buildColumn("enemies", space.lg + 570, "ENEMIGOS", "enemy", palette.textMuted);
    this.buildColumn("tower", space.lg + 760, "TORRE", "tower", palette.accent);

    this.statusText = scene.add.text(worldWidth / 2, worldHeight / 2, "", textStyle(type.h1));
    this.statusText.setOrigin(0.5, 0.5);
    this.statusText.setDepth(200);
    this.statusText.setVisible(false);
    applyLetterSpacing(this.statusText, type.h1);

    this.hintBar = scene.add.rectangle(0, worldHeight - 48, worldWidth, 48, palette.bgDeep, 0.55);
    this.hintBar.setOrigin(0, 0);
    this.hintBar.setDepth(100);

    this.hintText = scene.add.text(worldWidth / 2, worldHeight - 24, "", textStyle(type.bodyMuted));
    this.hintText.setOrigin(0.5, 0.5);
    this.hintText.setDepth(101);

    this.relicsHeader = scene.add.text(
      space.lg,
      PANEL_HEIGHT + space.sm + 2,
      "RELIQUIAS ACTIVAS",
      textStyle(type.overline),
    );
    this.relicsHeader.setDepth(101);
    applyLetterSpacing(this.relicsHeader, type.overline);
    this.relicsHeader.setVisible(false);

    // Pacto chip — positioned below the top panel on the left edge.
    this.pactChip = scene.add.container(space.lg, PANEL_HEIGHT + space.sm + 28);
    this.pactChip.setDepth(101);
    this.pactChip.setVisible(false);

    this.pactBg = scene.add.graphics();
    this.pactChip.add(this.pactBg);

    const pactEyebrow = scene.add.text(12, 7, "PACTO", textStyle(type.overline, { color: hex.primary }));
    applyLetterSpacing(pactEyebrow, type.overline);
    this.pactChip.add(pactEyebrow);

    this.pactLabel = scene.add.text(12, 20, "", textStyle(type.caption));
    applyLetterSpacing(this.pactLabel, type.caption);
    this.pactChip.add(this.pactLabel);
  }

  public render(state: HUDState): void {
    const chips = this.columns.get("chips")!;
    chips.value.setText(state.chips.toString());

    const base = this.columns.get("base")!;
    const ratio = state.baseHp / Math.max(1, state.baseHpMax);
    base.value.setText(`${state.baseHp} / ${state.baseHpMax}`);
    base.value.setColor(
      ratio > 0.5 ? hex.text : ratio > 0.25 ? hex.warn : hex.danger,
    );

    const wave = this.columns.get("wave")!;
    wave.value.setText(state.waveLabel);
    wave.label.setText(state.waveProgress);

    const enemies = this.columns.get("enemies")!;
    enemies.value.setText(state.enemiesAlive.toString());

    const tower = this.columns.get("tower")!;
    tower.value.setText(`${state.towerName}`);
    tower.value.setColor(colorToHex(state.towerColor));
    tower.label.setText(`COSTO ${state.towerCost}`);

    this.hintText.setText(state.actionHint);
    this.applyHintPulse(state.actionPrimary);

    this.renderRelics(state.relics);
    this.renderPact(state.activeModifier);

    if (state.statusText) {
      this.statusText.setText(state.statusText);
      this.statusText.setVisible(true);
    } else {
      this.statusText.setVisible(false);
    }
  }

  public flashStatus(text: string, durationMs = 1500): void {
    this.statusText.setText(text);
    this.statusText.setVisible(true);
    this.statusText.setAlpha(0);
    this.scene.tweens.add({
      targets: this.statusText,
      alpha: 1,
      duration: dur.fast,
      ease: ease.out,
    });
    this.scene.time.delayedCall(durationMs, () => {
      if (this.statusText.text !== text) return;
      this.scene.tweens.add({
        targets: this.statusText,
        alpha: 0,
        duration: dur.fast,
        ease: ease.out,
        onComplete: () => this.statusText.setVisible(false),
      });
    });
  }

  private buildColumn(
    key: string,
    x: number,
    labelText: string,
    iconKind: "chip" | "heart" | "wave" | "enemy" | "tower",
    iconColor: number,
  ): void {
    const iconX = x + 12;
    const iconY = 32;
    let icon: Phaser.GameObjects.Container | Phaser.GameObjects.Graphics;
    if (iconKind === "chip") icon = drawChipIcon(this.scene, iconX, iconY, { color: iconColor, size: 12 });
    else if (iconKind === "heart") icon = drawHeartIcon(this.scene, iconX, iconY, { color: iconColor, size: 11 });
    else if (iconKind === "wave") icon = drawWaveIcon(this.scene, iconX, iconY, { color: iconColor, size: 11 });
    else if (iconKind === "enemy") icon = drawEnemyIcon(this.scene, iconX, iconY, { color: iconColor, size: 10 });
    else icon = drawTowerIcon(this.scene, iconX, iconY, { color: iconColor, size: 10 });
    icon.setDepth(101);

    const label = this.scene.add.text(iconX + 22, iconY - 12, labelText, textStyle(type.overline));
    label.setDepth(101);
    applyLetterSpacing(label, type.overline);

    const value = this.scene.add.text(iconX + 22, iconY + 4, "", textStyle(type.metric));
    value.setDepth(101);
    value.setOrigin(0, 0.5);

    const divider = this.scene.add.rectangle(
      x + 168,
      PANEL_HEIGHT / 2,
      1,
      PANEL_HEIGHT - 20,
      palette.hairline,
      0.9,
    );
    divider.setDepth(100);

    this.columns.set(key, { iconContainer: icon, label, value, divider, rightEdge: x + 170 });
  }

  private renderRelics(relics: readonly RelicDefinition[]): void {
    this.relicsHeader.setVisible(relics.length > 0);

    while (this.relicSlots.length < relics.length) {
      const index = this.relicSlots.length;
      const width = 180;
      const x = this.worldWidth - space.lg - index * (width + space.sm);
      const y = PANEL_HEIGHT + space.sm + 14;

      const container = this.scene.add.container(x, y);
      container.setDepth(101);

      const bg = this.scene.add.graphics();
      container.add(bg);

      // Icon sits in its own sub-container so it can be swapped per relic
      const iconHolder = this.scene.add.container(-width + 22, 0);
      container.add(iconHolder);

      const text = this.scene.add.text(-width + 40, 0, "", textStyle(type.caption));
      text.setOrigin(0, 0.5);
      container.add(text);

      // Entrance
      container.setAlpha(0);
      container.setScale(0.9);
      this.scene.tweens.add({
        targets: container,
        alpha: 1,
        scale: 1,
        duration: dur.base,
        ease: ease.snap,
      });

      this.relicSlots.push({
        container,
        bg,
        iconHolder,
        currentIcon: null,
        currentRelicId: null,
        text,
      });
    }

    for (let i = 0; i < this.relicSlots.length; i += 1) {
      const slot = this.relicSlots[i];
      const relic = relics[i];
      if (!relic) {
        slot.container.setVisible(false);
        continue;
      }
      slot.container.setVisible(true);
      const width = 180;
      const height = 30;

      slot.bg.clear();
      // Subtle left-accent gradient
      slot.bg.fillGradientStyle(
        relic.color,
        palette.surface,
        relic.color,
        palette.surface,
        0.14,
        0.94,
        0.14,
        0.94,
      );
      slot.bg.fillRoundedRect(-width, -height / 2, width, height, 6);
      slot.bg.lineStyle(1, relic.color, 0.75);
      slot.bg.strokeRoundedRect(-width, -height / 2, width, height, 6);

      // Left accent bar
      slot.bg.fillStyle(relic.color, 1);
      slot.bg.fillRect(-width + 2, -height / 2 + 3, 2, height - 6);

      // Swap icon only when relic changes to avoid recreating every frame
      if (slot.currentRelicId !== relic.id) {
        if (slot.currentIcon) slot.currentIcon.destroy();
        const icon = drawRelicIcon(this.scene, 0, 0, relic.id, relic.color);
        slot.iconHolder.add(icon);
        slot.currentIcon = icon;
        slot.currentRelicId = relic.id;
      }

      slot.text.setText(relic.displayName);
      slot.text.setColor(colorToHex(relic.color));
    }
  }

  private renderPact(mod: WaveModifierDefinition | null): void {
    if (!mod) {
      if (this.pactChip.visible) {
        if (this.pactPulse) {
          this.pactPulse.stop();
          this.pactPulse = null;
        }
        this.pactChip.setVisible(false);
      }
      this.lastPactId = null;
      return;
    }

    const wasHidden = !this.pactChip.visible;
    this.pactChip.setVisible(true);
    this.pactLabel.setText(mod.displayName);
    this.pactLabel.setColor(colorToHex(mod.color));

    const labelWidth = this.pactLabel.width;
    const width = Math.max(160, Math.min(260, labelWidth + 32));
    const height = 36;

    this.pactBg.clear();
    this.pactBg.fillGradientStyle(
      mod.color,
      palette.surface,
      mod.color,
      palette.surface,
      0.18,
      0.96,
      0.18,
      0.96,
    );
    this.pactBg.fillRoundedRect(0, 0, width, height, 6);
    this.pactBg.lineStyle(1, mod.color, 0.85);
    this.pactBg.strokeRoundedRect(0, 0, width, height, 6);

    // Left accent bar + tiny star ornament
    this.pactBg.fillStyle(mod.color, 1);
    this.pactBg.fillRect(2, 3, 3, height - 6);

    // Right edge rarity dot
    const rarityColor = mod.rarity === "rare" ? palette.gold : palette.accent;
    this.pactBg.fillStyle(rarityColor, 1);
    this.pactBg.fillCircle(width - 10, 10, 3);

    // Entrance + pulse on new pact
    if (this.lastPactId !== mod.id) {
      this.lastPactId = mod.id;
      this.pactChip.setAlpha(0);
      this.pactChip.setScale(0.92);
      this.scene.tweens.add({
        targets: this.pactChip,
        alpha: 1,
        scale: 1,
        duration: dur.base,
        ease: ease.snap,
      });
      if (this.pactPulse) {
        this.pactPulse.stop();
        this.pactPulse = null;
      }
      this.pactPulse = this.scene.tweens.add({
        targets: this.pactBg,
        alpha: { from: 1, to: 0.85 },
        yoyo: true,
        repeat: -1,
        duration: 1200,
        ease: ease.inOut,
      });
    } else if (wasHidden) {
      this.pactChip.setAlpha(1);
      this.pactChip.setScale(1);
    }
  }

  private applyHintPulse(active: boolean): void {
    if (active && !this.hintPulse) {
      this.hintText.setColor(hex.primary);
      this.hintPulse = this.scene.tweens.add({
        targets: this.hintText,
        alpha: { from: 1, to: 0.55 },
        yoyo: true,
        repeat: -1,
        duration: 650,
        ease: ease.inOut,
      });
    } else if (!active && this.hintPulse) {
      this.hintPulse.stop();
      this.hintPulse = null;
      this.hintText.setAlpha(1);
      this.hintText.setColor(hex.textMuted);
    }
  }
}
