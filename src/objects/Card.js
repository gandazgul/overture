// @ts-check
import Phaser from "phaser";
import { TraitColors } from "../types.js";
import { s, px } from "../config.js";

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

  /** @type {number} */
  strokeColor;

  /** @type {boolean} */
  isSelected = false;

  static WIDTH = s(90);
  static HEIGHT = s(120);

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

    this.strokeColor = cardData.trait
      ? TraitColors[cardData.trait] || 0xffffff
      : 0x4a4a6a;

    // Use black fill since the image will cover it, but keep it for the stroke outline when selected
    this.background = scene.add
      .rectangle(0, 0, Card.WIDTH, Card.HEIGHT, 0x000000)
      .setStrokeStyle(s(2), this.strokeColor, 0.7);

    // Base patron image
    const baseImage = scene.add.image(0, 0, `patron_${cardData.type.toLowerCase()}`);
    baseImage.setDisplaySize(Card.WIDTH, Card.HEIGHT);

    const children = [this.background, baseImage];

    // Trait badge
    if (cardData.trait) {
      const badge = scene.add.image(Card.WIDTH / 2 - s(18), -Card.HEIGHT / 2 + s(18), `badge_${cardData.trait.toLowerCase()}`);
      badge.setDisplaySize(s(28), s(28));
      children.push(badge);
    }

    // Patron type label (moved to bottom with a semi-transparent backing for readability)
    const labelBg = scene.add.rectangle(0, Card.HEIGHT / 2 - s(12), Card.WIDTH, s(24), 0x000000, 0.7);
    const label = scene.add
      .text(0, Card.HEIGHT / 2 - s(12), cardData.label, {
        fontSize: px(11),
        fontFamily: "Georgia, serif",
        color: "#ffffff",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: Card.WIDTH - s(4) },
      })
      .setOrigin(0.5);
    children.push(labelBg, label);

    // ====================================================================
    // PHASER CONCEPT: Adding Children to a Container
    // ====================================================================
    // Container.add() puts game objects inside this container.
    // Children are positioned relative to the container's (x, y).
    // The rendering order follows the array order (first = behind).

    this.add(children);

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
      this.background.setStrokeStyle(s(3), 0xf5c518, 1);
      this.setScale(1.15);
    } else {
      this.background.setStrokeStyle(s(2), this.strokeColor, 0.7);
      this.setScale(1.0);
    }
  }
}
