import Phaser from "phaser";
import { MAP_HEIGHT, MAP_WIDTH } from "@/data/path";
import { audio } from "@/systems/AudioManager";
import type { WaveModifierDefinition, WaveModifierId } from "@/types";
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

export interface ModifierPickResult {
  modifierId: WaveModifierId | null;
  displayName: string;
}

export interface ModifierPickSceneData {
  offerings: readonly WaveModifierDefinition[];
  nextWaveLabel: string;
  onResolved: (res: ModifierPickResult) => void;
}

interface CardRefs {
  definition: WaveModifierDefinition;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  glow: Phaser.GameObjects.Graphics;
  hit: Phaser.GameObjects.Rectangle;
  state: "idle" | "hover";
  centerY: number;
}

const CARD_WIDTH = 300;
const CARD_HEIGHT = 380;
const CARD_GAP = 28;

export class ModifierPickScene extends Phaser.Scene {
  private payload!: ModifierPickSceneData;
  private resolved = false;
  private cards: CardRefs[] = [];
  private skipHit!: Phaser.GameObjects.Rectangle;
  private skipGfx!: Phaser.GameObjects.Graphics;
  private skipLabel!: Phaser.GameObjects.Text;

  public constructor() {
    super({ key: "ModifierPickScene" });
  }

  public init(data: ModifierPickSceneData): void {
    this.payload = data;
    this.resolved = false;
    this.cards = [];
  }

  public create(): void {
    this.drawBackdrop();
    this.drawHeader();
    this.drawCards();
    this.drawSkip();

    // Subtle zoom for weight
    this.cameras.main.setZoom(1.02);
    this.cameras.main.zoomTo(1, 600, cameraEase.out);

    this.input.keyboard?.once("keydown-ESC", () => this.resolveSkip());
  }

  // --- Layout -----------------------------------------------------------

  private drawBackdrop(): void {
    // Dimmed backdrop over the game
    const dim = this.add.rectangle(0, 0, MAP_WIDTH, MAP_HEIGHT, 0x000000, 0.72);
    dim.setOrigin(0, 0);
    dim.setDepth(0);

    // Crimson aura + vignette (casino tension)
    const aura = this.add.graphics();
    aura.setDepth(1);
    aura.fillGradientStyle(palette.danger, palette.danger, palette.bgDeep, palette.bgDeep, 0.12, 0.12, 0, 0);
    aura.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

    const vignette = this.add.graphics();
    vignette.setDepth(2);
    vignette.fillStyle(0x000000, 0.6);
    vignette.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    vignette.generateTexture("modifierVignette", MAP_WIDTH, MAP_HEIGHT);
    vignette.clear();
    // Cheap vignette via radial-ish rings
    for (let i = 0; i < 6; i += 1) {
      vignette.fillStyle(0x000000, 0.08);
      vignette.fillRect(-i * 4, -i * 4, MAP_WIDTH + i * 8, MAP_HEIGHT + i * 8);
    }
  }

  private drawHeader(): void {
    const eyebrow = this.add.text(MAP_WIDTH / 2, 54, "APUESTA DEL CRUPIER", textStyle(type.overline, { color: hex.primary }));
    eyebrow.setOrigin(0.5, 0.5);
    eyebrow.setDepth(10);
    applyLetterSpacing(eyebrow, type.overline);

    const ornamentTop = drawOrnament(this, MAP_WIDTH / 2, 72, 160);
    ornamentTop.setDepth(10);

    const headline = this.add.text(MAP_WIDTH / 2, 100, "ELIGE TU PACTO", textStyle(type.h1));
    headline.setOrigin(0.5, 0.5);
    headline.setDepth(10);
    applyLetterSpacing(headline, type.h1);

    const sub = this.add.text(
      MAP_WIDTH / 2,
      136,
      `Solo aplica a  ${this.payload.nextWaveLabel.toUpperCase()}`,
      textStyle(type.caption, { color: hex.textMuted }),
    );
    sub.setOrigin(0.5, 0.5);
    sub.setDepth(10);
    applyLetterSpacing(sub, type.caption);

    // Entrance
    for (const el of [eyebrow, headline, sub]) {
      el.setAlpha(0);
      this.tweens.add({ targets: el, alpha: 1, duration: dur.base, delay: 60, ease: ease.out });
    }
    ornamentTop.setAlpha(0);
    this.tweens.add({ targets: ornamentTop, alpha: 1, duration: dur.base, delay: 120, ease: ease.out });
  }

  private drawCards(): void {
    const count = this.payload.offerings.length;
    const totalWidth = count * CARD_WIDTH + (count - 1) * CARD_GAP;
    const startX = (MAP_WIDTH - totalWidth) / 2;
    const centerY = (MAP_HEIGHT - CARD_HEIGHT) / 2 + 40;

    this.payload.offerings.forEach((mod, i) => {
      const cardX = startX + i * (CARD_WIDTH + CARD_GAP);
      this.spawnCard(mod, cardX, centerY, i);
    });
  }

  private spawnCard(
    mod: WaveModifierDefinition,
    x: number,
    y: number,
    index: number,
  ): void {
    const container = this.add.container(x, y + 40);
    container.setDepth(20);
    container.setAlpha(0);

    const glow = this.add.graphics();
    container.add(glow);

    const bg = this.add.graphics();
    container.add(bg);

    // Rarity badge (top-right)
    const rarityColor = mod.rarity === "rare" ? palette.primary : palette.accent;
    const rarityBg = this.add.graphics();
    rarityBg.fillStyle(rarityColor, 0.92);
    rarityBg.fillRoundedRect(CARD_WIDTH - 92, 12, 80, 20, 4);
    container.add(rarityBg);

    const rarityLabel = this.add.text(
      CARD_WIDTH - 52,
      22,
      mod.rarity === "rare" ? "RARA" : "COMÚN",
      textStyle(type.overline, { color: mod.rarity === "rare" ? hex.textInverted : "#ffffff" }),
    );
    rarityLabel.setOrigin(0.5, 0.5);
    applyLetterSpacing(rarityLabel, type.overline);
    container.add(rarityLabel);

    // Ornament divider below header
    const ornament = drawOrnament(this, 24 + (CARD_WIDTH - 48) / 2, 120, CARD_WIDTH - 48);
    // The ornament is absolute-positioned; reparent into the card container.
    container.add(ornament);
    ornament.x -= x;
    ornament.y -= y + 40;

    // Body: name + description + flavor
    const eyebrow = this.add.text(24, 40, "PACTO", textStyle(type.overline, { color: colorToHex(mod.color) }));
    applyLetterSpacing(eyebrow, type.overline);
    container.add(eyebrow);

    const name = this.add.text(24, 62, mod.displayName, textStyle(type.h2, { color: colorToHex(mod.color) }));
    applyLetterSpacing(name, type.h2);
    container.add(name);

    const desc = this.add.text(24, 148, mod.description, textStyle(type.body, { color: hex.text }));
    desc.setWordWrapWidth(CARD_WIDTH - 48);
    desc.setLineSpacing(4);
    container.add(desc);

    const flavor = this.add.text(24, CARD_HEIGHT - 110, `"${mod.flavor}"`, textStyle(type.caption, { color: hex.textMuted }));
    flavor.setWordWrapWidth(CARD_WIDTH - 48);
    flavor.setFontStyle("italic");
    container.add(flavor);

    // Tag chips at the bottom that summarize numerical effects
    const tags = this.buildEffectTags(mod);
    tags.forEach((tag, i) => {
      const tagY = CARD_HEIGHT - 44;
      const tagX = 24 + i * 76;
      const tagBg = this.add.graphics();
      tagBg.fillStyle(palette.surfaceElevated, 1);
      tagBg.fillRoundedRect(tagX, tagY, 70, 26, 4);
      tagBg.lineStyle(1, tag.color, 0.85);
      tagBg.strokeRoundedRect(tagX, tagY, 70, 26, 4);
      container.add(tagBg);

      const tagText = this.add.text(tagX + 35, tagY + 13, tag.label, textStyle(type.overline, { color: colorToHex(tag.color) }));
      tagText.setOrigin(0.5, 0.5);
      applyLetterSpacing(tagText, type.overline);
      container.add(tagText);
    });

    // Action label
    const action = this.add.text(CARD_WIDTH - 24, CARD_HEIGHT - 20, "ACEPTAR  →", textStyle(type.overline, { color: colorToHex(mod.color) }));
    action.setOrigin(1, 1);
    applyLetterSpacing(action, type.overline);
    container.add(action);

    // Hit area
    const hit = this.add.rectangle(CARD_WIDTH / 2, CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 0x000000, 0.001);
    hit.setInteractive({ useHandCursor: true });
    container.add(hit);

    const ref: CardRefs = {
      definition: mod,
      container,
      bg,
      glow,
      hit,
      state: "idle",
      centerY: y,
    };
    this.cards.push(ref);

    this.drawCardSurface(ref, false);

    // Entrance
    this.tweens.add({
      targets: container,
      alpha: 1,
      y: y,
      duration: dur.slow,
      delay: 220 + index * 90,
      ease: ease.snap,
    });

    hit.on("pointerover", () => {
      if (ref.state === "hover") return;
      ref.state = "hover";
      audio.playHover();
      this.drawCardSurface(ref, true);
      this.tweens.add({ targets: container, y: y - 10, scale: 1.02, duration: dur.fast, ease: ease.out });
    });
    hit.on("pointerout", () => {
      if (ref.state !== "hover") return;
      ref.state = "idle";
      this.drawCardSurface(ref, false);
      this.tweens.add({ targets: container, y, scale: 1, duration: dur.fast, ease: ease.out });
    });
    hit.on("pointerdown", () => {
      audio.playClick();
      this.tweens.add({
        targets: container,
        scale: 0.97,
        duration: 80,
        yoyo: true,
        ease: ease.out,
        onComplete: () => this.resolveWith(mod),
      });
    });
  }

  private drawCardSurface(ref: CardRefs, hover: boolean): void {
    const { bg, glow, definition } = ref;

    glow.clear();
    if (hover) {
      glow.fillStyle(definition.color, 0.2);
      glow.fillRoundedRect(-8, -8, CARD_WIDTH + 16, CARD_HEIGHT + 16, 14);
    }

    bg.clear();
    const fillA = hover ? 0.98 : 0.94;
    bg.fillStyle(palette.surface, fillA);
    bg.fillRoundedRect(0, 0, CARD_WIDTH, CARD_HEIGHT, 12);

    // Left accent bar
    bg.fillStyle(definition.color, 1);
    bg.fillRect(0, 0, 4, CARD_HEIGHT);

    // Border
    bg.lineStyle(hover ? 2 : 1, definition.color, hover ? 1 : 0.7);
    bg.strokeRoundedRect(0, 0, CARD_WIDTH, CARD_HEIGHT, 12);
  }

  private buildEffectTags(mod: WaveModifierDefinition): { label: string; color: number }[] {
    const tags: { label: string; color: number }[] = [];
    const { effects } = mod;
    const pct = (v: number) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}%`;
    const good = palette.success;
    const bad = palette.danger;

    if (effects.chipRewardMult !== undefined) {
      const d = effects.chipRewardMult - 1;
      tags.push({ label: `${pct(d)} $`, color: d > 0 ? good : bad });
    }
    if (effects.enemyHpMult !== undefined) {
      const d = effects.enemyHpMult - 1;
      tags.push({ label: `${pct(d)} HP`, color: d > 0 ? bad : good });
    }
    if (effects.enemySpeedMult !== undefined) {
      const d = effects.enemySpeedMult - 1;
      tags.push({ label: `${pct(d)} VEL`, color: d > 0 ? bad : good });
    }
    if (effects.towerDamageMult !== undefined) {
      const d = effects.towerDamageMult - 1;
      tags.push({ label: `${pct(d)} DMG`, color: d > 0 ? good : bad });
    }
    if (effects.towerFireRateMult !== undefined) {
      // < 1 = faster = good
      const d = effects.towerFireRateMult - 1;
      tags.push({ label: `${pct(d)} CDN`, color: d < 0 ? good : bad });
    }
    if (effects.extraEnemiesPerGroup && effects.extraEnemiesPerGroup > 0) {
      tags.push({ label: `+${effects.extraEnemiesPerGroup} ENE`, color: bad });
    }
    if (effects.immediateChips && effects.immediateChips > 0) {
      tags.push({ label: `+${effects.immediateChips} YA`, color: good });
    }
    if (effects.immediateBaseDamage && effects.immediateBaseDamage > 0) {
      tags.push({ label: `-${effects.immediateBaseDamage} HP`, color: bad });
    }
    return tags.slice(0, 3);
  }

  private drawSkip(): void {
    const x = MAP_WIDTH / 2;
    const y = MAP_HEIGHT - 72;
    const w = 200;
    const h = 40;

    this.skipGfx = this.add.graphics();
    this.skipGfx.setDepth(20);
    this.redrawSkip(false);

    this.skipLabel = this.add.text(x, y, "SIN APUESTA  ·  ESC", textStyle(type.overline, { color: hex.textMuted }));
    this.skipLabel.setOrigin(0.5, 0.5);
    this.skipLabel.setDepth(21);
    applyLetterSpacing(this.skipLabel, type.overline);

    this.skipHit = this.add.rectangle(x, y, w, h, 0x000000, 0.001);
    this.skipHit.setInteractive({ useHandCursor: true });
    this.skipHit.setDepth(22);

    this.skipHit.on("pointerover", () => {
      this.redrawSkip(true);
      this.skipLabel.setColor(hex.text);
    });
    this.skipHit.on("pointerout", () => {
      this.redrawSkip(false);
      this.skipLabel.setColor(hex.textMuted);
    });
    this.skipHit.on("pointerdown", () => this.resolveSkip());

    this.skipGfx.setAlpha(0);
    this.skipLabel.setAlpha(0);
    this.tweens.add({ targets: [this.skipGfx, this.skipLabel], alpha: 1, duration: dur.base, delay: 640, ease: ease.out });
  }

  private redrawSkip(hover: boolean): void {
    const x = MAP_WIDTH / 2;
    const y = MAP_HEIGHT - 72;
    const w = 200;
    const h = 40;
    this.skipGfx.clear();
    this.skipGfx.fillStyle(palette.surface, hover ? 0.85 : 0.55);
    this.skipGfx.fillRoundedRect(x - w / 2, y - h / 2, w, h, 8);
    this.skipGfx.lineStyle(1, palette.hairline, hover ? 0.85 : 0.5);
    this.skipGfx.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 8);
  }

  // --- Resolution --------------------------------------------------------

  private resolveWith(mod: WaveModifierDefinition): void {
    if (this.resolved) return;
    this.resolved = true;
    audio.playReward();
    this.cameras.main.flash(180, 255, 209, 102, false);
    this.finish({ modifierId: mod.id, displayName: mod.displayName });
  }

  private resolveSkip(): void {
    if (this.resolved) return;
    this.resolved = true;
    audio.playClick();
    this.finish({ modifierId: null, displayName: "SIN APUESTA" });
  }

  private finish(result: ModifierPickResult): void {
    this.cameras.main.fadeOut(220, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.payload.onResolved(result);
      this.scene.stop();
    });
  }
}
