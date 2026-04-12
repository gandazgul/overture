// @ts-check
import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene.js";
import { TitleScene } from "./scenes/TitleScene.js";
import { TheaterSelectionScene } from "./scenes/TheaterSelectionScene.js";
import { GameScene } from "./scenes/GameScene.js";
import { EndGameScene } from "./scenes/EndGameScene.js";
import { GAME_HEIGHT, GAME_WIDTH } from "./config.js";

/** @type {Phaser.Types.Core.GameConfig} */
const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#1a1a2e",
  scene: [
    BootScene,
    TitleScene,
    TheaterSelectionScene,
    GameScene,
    EndGameScene,
  ],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

const game = new Phaser.Game(config);

// @ts-ignore: expose Phaser game instance for browser DevTools debugging
globalThis.__PHASER_GAME__ = game;
