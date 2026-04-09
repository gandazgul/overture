// @ts-check
import Phaser from "phaser";
import { TitleScene } from "./scenes/TitleScene.js";
import { GameScene } from "./scenes/GameScene.js";
import { GAME_WIDTH, GAME_HEIGHT } from "./config.js";

/**
 * ========================================================================
 * PHASER CONCEPT: The Game Configuration Object
 * ========================================================================
 * This is the entry point of every Phaser game. The config object tells
 * Phaser everything it needs to know to initialize:
 *
 *   type        → Rendering engine. Phaser.AUTO picks WebGL if available,
 *                 falls back to Canvas. For 2D card games, either works.
 *
 *   width/height → The game canvas size in pixels. This is the "virtual"
 *                  resolution your game is designed for. Phaser can scale
 *                  this to fit different screen sizes.
 *
 *   backgroundColor → The canvas clear color (shown behind everything).
 *
 *   scene       → An array of Scene classes. The FIRST scene in the array
 *                 starts automatically. Others are registered but dormant
 *                 until you call this.scene.start('SceneKey').
 *
 *   scale       → Controls how the canvas fits in the browser window.
 *                 FIT mode scales the canvas to fill the window while
 *                 maintaining aspect ratio (no stretching).
 *
 * There are many more options (physics, audio, plugins, etc.) but this
 * is all we need for a card game. No physics engine required!
 * ========================================================================
 */

/** @type {Phaser.Types.Core.GameConfig} */
const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#1a1a2e",

  // Scene array: TitleScene starts first, GameScene is registered for later
  scene: [TitleScene, GameScene],

  // Scale manager: make the game responsive
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

/**
 * ========================================================================
 * PHASER CONCEPT: Creating the Game Instance
 * ========================================================================
 * `new Phaser.Game(config)` does everything:
 *   1. Creates a <canvas> element and appends it to the DOM
 *   2. Initializes the renderer (WebGL or Canvas)
 *   3. Sets up the Scene Manager and registers all scenes
 *   4. Starts the first scene (TitleScene)
 *   5. Begins the game loop (requestAnimationFrame)
 *
 * The game loop then calls update() on the active scene every frame.
 * ========================================================================
 */
const game = new Phaser.Game(config);

// Make the game instance available for debugging in the browser console
// Try typing `game.scene.scenes` in DevTools to see active scenes!
// @ts-ignore: expose Phaser game instance for browser DevTools debugging
globalThis.__PHASER_GAME__ = game;
