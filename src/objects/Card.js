// @ts-check
import Phaser from "phaser";
import { PatronColors } from "../types.js";

/**
 * ========================================================================
 * PHASER CONCEPT: Containers (Grouping Game Objects)
 * ========================================================================
 * A Container is a game object that holds other game objects as children.
 * When you move/scale/rotate the container, all children move with it.
 *
 * This is perfect for cards: each card is a Container holding:
 *   - A colored Rectangle (the card background)
 *   - A Text object (the emoji)
 *   - A Text object (the patron type label)
 *
 * Containers can be made interactive just like any other game object.
 * ========================================================================
 */

/** @typedef {import('../types.js').CardData} CardData */

/**
 * Visual representation of a patron card.
 * Extends Phaser.GameObjects.Container to group card elements together.
 */
export class Card extends Phaser.GameObjects.Container {
  /** @type {CardData} */
  cardData;

  /** @type {Phaser.GameObjects.Rectangle} */
  background;

  /** @type {boolean} */
  isSelected = false;

  static WIDTH = 90;
  static HEIGHT = 120;

  /**
   * @param {Phaser.Scene} scene - The scene this card belongs to
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {CardData} cardData - The patron data for this card
   */
  constructor(scene, x, y, cardData) {
    super(scene, x, y);
    this.cardData = cardData;

    // ====================================================================
    // PHASER CONCEPT: Rectangle Game Object
    // ====================================================================
    // Phaser.GameObjects.Rectangle draws a filled/stroked rectangle.
    // The position (0, 0) is relative to the Container's origin.
    // Colors are hex numbers (0xRRGGBB), not CSS strings.

    const color = PatronColors[cardData.type] || 0x607d8b;

    this.background = scene.add
      .rectangle(0, 0, Card.WIDTH, Card.HEIGHT, color)
      .setStrokeStyle(2, 0xffffff, 0.5);

    // Emoji icon
    const emoji = scene.add
      .text(0, -15, cardData.emoji, {
        fontSize: "28px",
      })
      .setOrigin(0.5);

    // Patron type label
    const label = scene.add
      .text(0, 25, cardData.label, {
        fontSize: "11px",
        fontFamily: "Arial",
        color: "#ffffff",
        align: "center",
        wordWrap: { width: Card.WIDTH - 10 },
      })
      .setOrigin(0.5);

    // ====================================================================
    // PHASER CONCEPT: Adding Children to a Container
    // ====================================================================
    // Container.add() puts game objects inside this container.
    // Children are positioned relative to the container's (x, y).
    // The rendering order follows the array order (first = behind).

    this.add([this.background, emoji, label]);

    // ====================================================================
    // PHASER CONCEPT: Hit Area & Interactive Size
    // ====================================================================
    // For containers, Phaser doesn't auto-calculate the interactive area.
    // We must explicitly define a hit area (Rectangle) and a hit test
    // callback (Phaser.Geom.Rectangle.Contains).

    this.setSize(Card.WIDTH, Card.HEIGHT);
    this.setInteractive(
      new Phaser.Geom.Rectangle(
        -Card.WIDTH / 2,
        -Card.HEIGHT / 2,
        Card.WIDTH,
        Card.HEIGHT
      ),
      Phaser.Geom.Rectangle.Contains
    );

    // ====================================================================
    // PHASER CONCEPT: Input Events on Game Objects
    // ====================================================================
    // After setInteractive(), the object emits pointer events.
    // 'pointerover'/'pointerout' = hover. 'pointerdown' = click/tap.

    this.on("pointerover", () => {
      if (!this.isSelected) {
        scene.tweens.add({
          targets: this,
          scaleX: 1.1,
          scaleY: 1.1,
          duration: 100,
          ease: "Back.easeOut",
        });
      }
    });

    this.on("pointerout", () => {
      if (!this.isSelected) {
        scene.tweens.add({
          targets: this,
          scaleX: 1.0,
          scaleY: 1.0,
          duration: 100,
        });
      }
    });

    // Add this container to the scene's display list
    scene.add.existing(this);
  }

  /**
   * Toggle the selected visual state of the card.
   * @param {boolean} selected
   */
  setSelected(selected) {
    this.isSelected = selected;
    if (selected) {
      this.background.setStrokeStyle(3, 0xf5c518, 1);
      this.setScale(1.15);
    } else {
      this.background.setStrokeStyle(2, 0xffffff, 0.5);
      this.setScale(1.0);
    }
  }
}
