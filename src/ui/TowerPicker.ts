import Phaser from "phaser";
import type { TowerCatalog, TowerId } from "@/types";
import {
  applyLetterSpacing,
  colorToHex,
  drawTowerIcon,
  dur,
  ease,
  hex,
  palette,
  space,
  textStyle,
  type,
} from "./theme";

interface CardRefs {
  id: TowerId;
  keybind: string;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  glow: Phaser.GameObjects.Graphics;
  costText: Phaser.GameObjects.Text;
  nameText: Phaser.GameObjects.Text;
  keyBadge: Phaser.GameObjects.Graphics;
  keyLabel: Phaser.GameObjects.Text;
  state: "idle" | "hover" | "selected" | "disabled";
  color: number;
}

export interface TowerPickerState {
  selectedId: TowerId;
  chips: number;
}

const CARD_WIDTH = 132;
const CARD_HEIGHT = 72;
const CARD_GAP = space.sm;

export class TowerPicker {
  private readonly scene: Phaser.Scene;
  private readonly catalog: TowerCatalog;
  private readonly cards: CardRefs[] = [];
  private readonly headerText: Phaser.GameObjects.Text;
  private readonly onSelect: (id: TowerId) => boolean;
  private readonly tooltipTargets: { hit: Phaser.GameObjects.Rectangle; id: TowerId }[] = [];

  public constructor(
    scene: Phaser.Scene,
    catalog: TowerCatalog,
    onSelect: (id: TowerId) => boolean,
    opts: { x: number; y: number; ids?: readonly TowerId[] },
  ) {
    this.scene = scene;
    this.catalog = catalog;
    this.onSelect = onSelect;

    const ids: readonly TowerId[] = opts.ids ?? (["blaster", "gambler", "shock"] as const);
    const keybinds = ids.map((_, i) => String(i + 1));

    this.headerText = scene.add.text(
      opts.x,
      opts.y - space.sm - 2,
      `TORRES  ·  ${keybinds.join(" / ")}`,
      textStyle(type.overline),
    );
    this.headerText.setOrigin(0, 1);
    this.headerText.setDepth(101);
    applyLetterSpacing(this.headerText, type.overline);

    ids.forEach((id, index) => {
      const def = catalog[id];
      const cardX = opts.x + index * (CARD_WIDTH + CARD_GAP);
      const cardY = opts.y;

      const container = scene.add.container(cardX, cardY);
      container.setDepth(101);

      const glow = scene.add.graphics();
      glow.setDepth(101);
      container.add(glow);

      const bg = scene.add.graphics();
      bg.setDepth(102);
      container.add(bg);

      // Tower icon
      const icon = drawTowerIcon(scene, 22, CARD_HEIGHT / 2, { color: def.color, size: 12 });
      icon.setDepth(104);
      container.add(icon);

      // Name
      const nameText = scene.add.text(46, 14, def.displayName, textStyle(type.body, { color: colorToHex(def.color) }));
      nameText.setDepth(104);

      // Cost
      const costText = scene.add.text(46, 36, `${def.cost} fichas`, textStyle(type.caption, { color: hex.textMuted }));
      costText.setDepth(104);

      container.add([nameText, costText]);

      // Key badge (top right corner)
      const keyBadge = scene.add.graphics();
      keyBadge.setDepth(104);
      container.add(keyBadge);

      const keyLabel = scene.add.text(CARD_WIDTH - 14, 14, keybinds[index], textStyle(type.overline, { color: hex.textDim }));
      keyLabel.setOrigin(0.5, 0.5);
      keyLabel.setDepth(105);
      container.add(keyLabel);

      const hit = scene.add.rectangle(CARD_WIDTH / 2, CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 0x000000, 0.001);
      hit.setInteractive({ useHandCursor: true });
      hit.setDepth(103);
      container.add(hit);

      const ref: CardRefs = {
        id,
        keybind: keybinds[index],
        container,
        bg,
        glow,
        costText,
        nameText,
        keyBadge,
        keyLabel,
        state: "idle",
        color: def.color,
      };
      this.cards.push(ref);

      hit.on("pointerover", () => {
        if (ref.state === "selected") return;
        ref.state = "hover";
        this.drawCard(ref);
      });
      hit.on("pointerout", () => {
        if (ref.state === "selected") return;
        ref.state = "idle";
        this.drawCard(ref);
      });
      hit.on("pointerdown", () => this.select(id));

      // Hover tooltip with stats. Attached by the host scene after construction.
      this.tooltipTargets.push({ hit, id });

      this.drawCard(ref);

      // Entrance animation staggered
      container.setAlpha(0);
      container.setScale(0.92);
      scene.tweens.add({
        targets: container,
        alpha: 1,
        scale: 1,
        duration: dur.base,
        delay: 120 + index * 60,
        ease: ease.snap,
      });
    });
  }

  public render(state: TowerPickerState): void {
    for (const card of this.cards) {
      const def = this.catalog[card.id];
      const affordable = state.chips >= def.cost;

      if (card.id === state.selectedId) {
        card.state = "selected";
      } else if (!affordable) {
        card.state = "disabled";
      } else if (card.state !== "hover") {
        card.state = "idle";
      }

      this.drawCard(card);

      // Update cost color based on affordability
      card.costText.setColor(affordable ? hex.textMuted : hex.danger);
    }
  }

  public select(id: TowerId): void {
    if (!this.onSelect(id)) return;
    // Pulse the freshly selected card
    const card = this.cards.find((c) => c.id === id);
    if (card) {
      this.scene.tweens.add({
        targets: card.container,
        scale: { from: 1.05, to: 1 },
        duration: dur.fast,
        ease: ease.snap,
      });
    }
  }

  /** Wires each card's hover tooltip. Call once after construction. */
  public attachTooltip(tooltip: import("./Tooltip").Tooltip): void {
    for (const target of this.tooltipTargets) {
      const def = this.catalog[target.id];
      tooltip.attach(target.hit, () => ({
        title: def.displayName,
        subtitle: `COSTO ${def.cost}`,
        body: [
          `Daño ${def.damage} · Alcance ${def.range}`,
          `Cadencia ${(1000 / def.fireRateMs).toFixed(1)} disparos/s`,
          def.description ?? "",
        ].filter(Boolean),
        accent: def.color,
      }));
    }
  }

  private drawCard(ref: CardRefs): void {
    const { bg, glow, color, state } = ref;

    // Glow behind selected cards
    glow.clear();
    if (state === "selected") {
      glow.fillStyle(color, 0.18);
      glow.fillRoundedRect(-4, -4, CARD_WIDTH + 8, CARD_HEIGHT + 8, 12);
    }

    // Card body
    bg.clear();
    const fillColor = state === "selected"
      ? palette.surfaceElevated
      : state === "hover"
        ? palette.surfaceHover
        : palette.surface;
    const fillAlpha = state === "disabled" ? 0.55 : 0.95;

    bg.fillStyle(fillColor, fillAlpha);
    bg.fillRoundedRect(0, 0, CARD_WIDTH, CARD_HEIGHT, 8);

    const strokeColor = state === "selected" ? color : state === "hover" ? color : palette.hairline;
    const strokeAlpha = state === "selected" ? 1 : state === "hover" ? 0.75 : 0.6;
    const strokeWidth = state === "selected" ? 2 : 1;
    bg.lineStyle(strokeWidth, strokeColor, strokeAlpha);
    bg.strokeRoundedRect(0, 0, CARD_WIDTH, CARD_HEIGHT, 8);

    // Left accent bar
    bg.fillStyle(color, state === "selected" ? 1 : 0.7);
    bg.fillRect(0, 0, 3, CARD_HEIGHT);

    // Key badge
    ref.keyBadge.clear();
    const badgeBg = state === "selected" ? color : palette.surfaceElevated;
    const badgeBorder = state === "selected" ? color : palette.hairline;
    ref.keyBadge.fillStyle(badgeBg, state === "selected" ? 1 : 0.85);
    ref.keyBadge.fillRoundedRect(CARD_WIDTH - 26, 4, 20, 20, 4);
    ref.keyBadge.lineStyle(1, badgeBorder, 0.9);
    ref.keyBadge.strokeRoundedRect(CARD_WIDTH - 26, 4, 20, 20, 4);
    ref.keyLabel.setColor(
      state === "selected" ? hex.textInverted : state === "hover" ? hex.text : hex.textDim,
    );

    // Name brighter when selected
    ref.nameText.setAlpha(state === "disabled" ? 0.5 : 1);
  }
}
