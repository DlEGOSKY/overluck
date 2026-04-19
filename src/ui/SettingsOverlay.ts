import Phaser from "phaser";
import { audio } from "@/systems/AudioManager";
import { storage } from "@/systems/StorageManager";
import type { ProfileSettings } from "@/types";
import {
  applyLetterSpacing,
  dur,
  ease,
  hex,
  palette,
  textStyle,
  type,
} from "./theme";

/**
 * Minimal settings panel: master volume, sfx volume, mute, screen shake
 * strength, reduced flashes. Writes directly to the persistent profile and
 * applies audio changes live.
 */

export class SettingsOverlay {
  private readonly scene: Phaser.Scene;
  private readonly worldWidth: number;
  private readonly worldHeight: number;
  private readonly onClose: () => void;

  private root: Phaser.GameObjects.Container | null = null;

  public constructor(
    scene: Phaser.Scene,
    worldWidth: number,
    worldHeight: number,
    onClose: () => void,
  ) {
    this.scene = scene;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.onClose = onClose;
  }

  public isOpen(): boolean {
    return this.root !== null;
  }

  public open(): void {
    if (this.root) return;
    const settings = { ...storage.load().settings };

    const root = this.scene.add.container(0, 0);
    root.setDepth(500);
    this.root = root;

    const dim = this.scene.add.rectangle(0, 0, this.worldWidth, this.worldHeight, 0x000000, 0.78);
    dim.setOrigin(0, 0);
    dim.setInteractive();
    root.add(dim);

    const cx = this.worldWidth / 2;
    const cy = this.worldHeight / 2;
    const panelW = 520;
    const panelH = 440;
    const panel = this.scene.add.graphics();
    panel.fillStyle(palette.surface, 0.98);
    panel.fillRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 14);
    panel.lineStyle(1, palette.gold, 0.9);
    panel.strokeRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 14);
    root.add(panel);

    const title = this.scene.add.text(cx, cy - panelH / 2 + 36, "AJUSTES", textStyle(type.h1, { color: hex.gold }));
    title.setOrigin(0.5, 0.5);
    applyLetterSpacing(title, type.h1);
    root.add(title);

    // Row builder
    let rowY = cy - panelH / 2 + 90;
    const addSlider = (
      label: string,
      get: () => number,
      set: (v: number) => void,
      step = 0.1,
    ): void => {
      const y = rowY;
      rowY += 56;
      const lbl = this.scene.add.text(cx - panelW / 2 + 30, y, label, textStyle(type.overline, { color: hex.textMuted }));
      applyLetterSpacing(lbl, type.overline);
      root.add(lbl);

      const trackX = cx - 60;
      const trackY = y + 20;
      const trackW = 240;
      const track = this.scene.add.graphics();
      const fill = this.scene.add.graphics();
      const handle = this.scene.add.circle(trackX, trackY, 7, palette.gold, 1);
      handle.setStrokeStyle(1, 0xffffff, 0.8);
      root.add([track, fill, handle]);

      const valueLabel = this.scene.add.text(cx + panelW / 2 - 30, y + 10, "", textStyle(type.body, { color: hex.text }));
      valueLabel.setOrigin(1, 0);
      root.add(valueLabel);

      const redraw = (): void => {
        const v = Math.max(0, Math.min(1, get()));
        track.clear();
        track.fillStyle(palette.bg, 1);
        track.fillRoundedRect(trackX, trackY - 3, trackW, 6, 3);
        track.lineStyle(1, palette.hairline, 0.9);
        track.strokeRoundedRect(trackX, trackY - 3, trackW, 6, 3);
        fill.clear();
        fill.fillStyle(palette.gold, 1);
        fill.fillRoundedRect(trackX, trackY - 3, trackW * v, 6, 3);
        handle.setPosition(trackX + trackW * v, trackY);
        valueLabel.setText(`${Math.round(v * 100)}%`);
      };
      redraw();

      // Minus / plus hit zones (keyboard-free mouse interaction).
      const minus = this.scene.add
        .text(trackX - 22, trackY - 10, "−", textStyle(type.h2, { color: hex.text }))
        .setInteractive({ useHandCursor: true })
        .setOrigin(0.5, 0);
      minus.on("pointerdown", () => {
        set(Math.max(0, get() - step));
        redraw();
        audio.playClick();
      });
      const plus = this.scene.add
        .text(trackX + trackW + 22, trackY - 10, "+", textStyle(type.h2, { color: hex.text }))
        .setInteractive({ useHandCursor: true })
        .setOrigin(0.5, 0);
      plus.on("pointerdown", () => {
        set(Math.min(1, get() + step));
        redraw();
        audio.playClick();
      });
      root.add([minus, plus]);
    };

    addSlider(
      "VOLUMEN MAESTRO",
      () => settings.masterVolume,
      (v) => {
        settings.masterVolume = v;
        audio.setMasterVolume(v);
        this.persist(settings);
      },
    );
    addSlider(
      "VOLUMEN SFX",
      () => settings.sfxVolume,
      (v) => {
        settings.sfxVolume = v;
        audio.setSfxVolume(v);
        this.persist(settings);
      },
    );

    // Toggles
    const toggle = (label: string, get: () => boolean, set: (v: boolean) => void): void => {
      const y = rowY;
      rowY += 44;
      const lbl = this.scene.add.text(cx - panelW / 2 + 30, y, label, textStyle(type.overline, { color: hex.textMuted }));
      applyLetterSpacing(lbl, type.overline);
      root.add(lbl);

      const w = 120;
      const h = 28;
      const tx = cx + panelW / 2 - 30 - w;
      const bg = this.scene.add.graphics();
      const labelText = this.scene.add.text(tx + w / 2, y + 14, "", textStyle(type.overline, { color: hex.textInverted }));
      labelText.setOrigin(0.5, 0.5);
      applyLetterSpacing(labelText, type.overline);
      const redraw = (): void => {
        const on = get();
        bg.clear();
        bg.fillStyle(on ? palette.gold : palette.bg, 0.95);
        bg.fillRoundedRect(tx, y, w, h, 8);
        bg.lineStyle(1, palette.gold, 0.9);
        bg.strokeRoundedRect(tx, y, w, h, 8);
        labelText.setText(on ? "ACTIVO" : "INACTIVO");
        labelText.setColor(on ? hex.textInverted : hex.text);
      };
      redraw();
      const hit = this.scene.add.rectangle(tx + w / 2, y + h / 2, w, h, 0x000000, 0.001).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => {
        set(!get());
        audio.playClick();
        redraw();
      });
      root.add([bg, labelText, hit]);
    };

    toggle(
      "SILENCIAR AUDIO",
      () => settings.muted,
      (v) => {
        settings.muted = v;
        audio.setEnabled(!v);
        this.persist(settings);
      },
    );

    toggle(
      "REDUCIR DESTELLOS",
      () => settings.reducedFlashes,
      (v) => {
        settings.reducedFlashes = v;
        this.persist(settings);
      },
    );

    // Shake tri-state
    const shakeY = rowY;
    rowY += 56;
    const shakeLbl = this.scene.add.text(cx - panelW / 2 + 30, shakeY, "CAMERA SHAKE", textStyle(type.overline, { color: hex.textMuted }));
    applyLetterSpacing(shakeLbl, type.overline);
    root.add(shakeLbl);
    const shakeOptions: ProfileSettings["screenShake"][] = ["off", "low", "high"];
    const shakeLabels = ["OFF", "LOW", "HIGH"];
    const shakeBtnW = 70;
    const shakeGap = 6;
    const shakeBaseX = cx + panelW / 2 - 30 - (shakeBtnW * 3 + shakeGap * 2);
    const shakeBtns: { bg: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text; value: ProfileSettings["screenShake"] }[] = [];
    const redrawShake = (): void => {
      for (const b of shakeBtns) {
        const on = settings.screenShake === b.value;
        b.bg.clear();
        b.bg.fillStyle(on ? palette.gold : palette.bg, 0.95);
        b.bg.fillRoundedRect(
          shakeBaseX + shakeBtns.indexOf(b) * (shakeBtnW + shakeGap),
          shakeY,
          shakeBtnW,
          28,
          8,
        );
        b.bg.lineStyle(1, palette.gold, 0.9);
        b.bg.strokeRoundedRect(
          shakeBaseX + shakeBtns.indexOf(b) * (shakeBtnW + shakeGap),
          shakeY,
          shakeBtnW,
          28,
          8,
        );
        b.text.setColor(on ? hex.textInverted : hex.text);
      }
    };
    shakeOptions.forEach((value, i) => {
      const bx = shakeBaseX + i * (shakeBtnW + shakeGap);
      const bg = this.scene.add.graphics();
      const text = this.scene.add.text(bx + shakeBtnW / 2, shakeY + 14, shakeLabels[i], textStyle(type.overline, { color: hex.text }));
      text.setOrigin(0.5, 0.5);
      applyLetterSpacing(text, type.overline);
      const hit = this.scene.add.rectangle(bx + shakeBtnW / 2, shakeY + 14, shakeBtnW, 28, 0x000000, 0.001).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => {
        settings.screenShake = value;
        this.persist(settings);
        audio.playClick();
        redrawShake();
      });
      root.add([bg, text, hit]);
      shakeBtns.push({ bg, text, value });
    });
    redrawShake();

    // Close button
    const closeY = cy + panelH / 2 - 34;
    const closeW = 180;
    const closeH = 36;
    const closeBg = this.scene.add.graphics();
    closeBg.fillStyle(palette.primary, 0.95);
    closeBg.fillRoundedRect(cx - closeW / 2, closeY - closeH / 2, closeW, closeH, 8);
    closeBg.lineStyle(1, palette.gold, 0.9);
    closeBg.strokeRoundedRect(cx - closeW / 2, closeY - closeH / 2, closeW, closeH, 8);
    const closeText = this.scene.add.text(cx, closeY, "CERRAR  ·  ESC", textStyle(type.overline, { color: hex.textInverted }));
    closeText.setOrigin(0.5, 0.5);
    applyLetterSpacing(closeText, type.overline);
    const closeHit = this.scene.add.rectangle(cx, closeY, closeW, closeH, 0x000000, 0.001).setInteractive({ useHandCursor: true });
    closeHit.on("pointerdown", () => this.close());
    root.add([closeBg, closeText, closeHit]);

    root.setAlpha(0);
    this.scene.tweens.add({ targets: root, alpha: 1, duration: dur.base, ease: ease.out });
  }

  public close(): void {
    if (!this.root) return;
    const root = this.root;
    this.root = null;
    this.scene.tweens.add({
      targets: root,
      alpha: 0,
      duration: dur.fast,
      ease: ease.out,
      onComplete: () => {
        root.destroy();
        this.onClose();
      },
    });
  }

  private persist(settings: ProfileSettings): void {
    storage.update((p) => {
      p.settings = { ...settings };
    });
  }
}
