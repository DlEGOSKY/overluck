import Phaser from "phaser";
import { MAP_HEIGHT, MAP_WIDTH } from "@/data/path";
import { BootScene } from "@/scenes/BootScene";
import { GameScene } from "@/scenes/GameScene";
import { BetweenWavesScene } from "@/scenes/BetweenWavesScene";
import { SlotScene } from "@/scenes/SlotScene";
import { RouletteScene } from "@/scenes/RouletteScene";
import { ModifierPickScene } from "@/scenes/ModifierPickScene";
import { UnlockScene } from "@/scenes/UnlockScene";
import { CardScene } from "@/scenes/CardScene";
import { MainMenuScene } from "@/scenes/MainMenuScene";

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#06060c",
  width: MAP_WIDTH,
  height: MAP_HEIGHT,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    pixelArt: false,
    antialias: true,
  },
  scene: [BootScene, MainMenuScene, GameScene, BetweenWavesScene, SlotScene, RouletteScene, ModifierPickScene, UnlockScene, CardScene],
};
