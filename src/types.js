// @ts-check

/**
 * ========================================================================
 * PHASER CONCEPT: No built-in data model
 * ========================================================================
 * Phaser doesn't dictate how you structure your game data. It provides
 * rendering, input, and physics — but YOUR game logic (cards, turns,
 * scoring) lives in plain JavaScript. This file defines our data types
 * using JSDoc so Deno can typecheck them.
 * ========================================================================
 */

/**
 * All patron types in the game, matching the GAME_DESIGN.md spec.
 * We use a frozen object as an "enum" pattern in JavaScript.
 *
 * @readonly
 * @enum {string}
 */
export const PatronType = /** @type {const} */ ({
  STANDARD: "Standard",
  BESPECTACLED: "Bespectacled",
  VIP: "VIP",
  LOVEBIRDS: "Lovebirds",
  KID: "Kid",
  TEACHER: "Teacher",
  TALL: "Tall Person",
  SHORT: "Short Person",
  CRITIC: "Critic",
  NOISY: "Noisy",
});
Object.freeze(PatronType);

/**
 * The color associated with each patron type (for card rendering).
 * @type {Record<string, number>}
 */
export const PatronColors = {
  [PatronType.STANDARD]: 0x607d8b, // Blue-grey
  [PatronType.BESPECTACLED]: 0x2196f3, // Blue
  [PatronType.VIP]: 0xffc107, // Gold
  [PatronType.LOVEBIRDS]: 0xe91e63, // Pink
  [PatronType.KID]: 0x4caf50, // Green
  [PatronType.TEACHER]: 0x8bc34a, // Light green
  [PatronType.TALL]: 0x795548, // Brown
  [PatronType.SHORT]: 0xff9800, // Orange
  [PatronType.CRITIC]: 0x9c27b0, // Purple
  [PatronType.NOISY]: 0xf44336, // Red
};
Object.freeze(PatronColors);

/**
 * Player colors and names for up to 4 players.
 * @type {string[]}
 */
export const PlayerColors = ["#4fc3f7", "#ef5350", "#66bb6a", "#ffa726"];
Object.freeze(PlayerColors);

/** @type {number[]} */
export const PlayerColorsHex = [0x4fc3f7, 0xef5350, 0x66bb6a, 0xffa726];
Object.freeze(PlayerColorsHex);

/** @type {string[]} */
export const PlayerNames = ["Player 1", "Player 2", "Player 3", "Player 4"];
Object.freeze(PlayerNames);

/**
 * Data for a single patron card.
 * @typedef {Object} CardData
 * @property {string} type - One of the PatronType values
 * @property {string} label - Display name
 * @property {string} emoji - Visual icon for the card
 * @property {string} description - Short tooltip text
 */

/**
 * A seat position on the theater grid.
 * @typedef {Object} SeatPosition
 * @property {number} row - Row index (0 = front/stage, 3 = back)
 * @property {number} col - Column index (0 = left)
 */

/**
 * Card definitions with emoji and descriptions for each patron type.
 * @type {Record<string, {emoji: string, description: string}>}
 */
export const PatronInfo = {
  [PatronType.STANDARD]: {
    emoji: "🧑",
    description: "A regular patron. Worth 1 VP anywhere.",
  },
  [PatronType.BESPECTACLED]: {
    emoji: "🤓",
    description: "Bonus VP in rows 1-3 (closer to stage).",
  },
  [PatronType.VIP]: {
    emoji: "⭐",
    description: "High VP in rows 1-2. Penalty near Kids/Noisy.",
  },
  [PatronType.LOVEBIRDS]: {
    emoji: "💕",
    description: "Score only if adjacent to another Lovebirds.",
  },
  [PatronType.KID]: {
    emoji: "👦",
    description: "Negative VP unless capped by Teachers!",
  },
  [PatronType.TEACHER]: {
    emoji: "👩‍🏫",
    description: "Scores VP for each adjacent Kid capped.",
  },
  [PatronType.TALL]: {
    emoji: "🦒",
    description: "Giftable! Patron behind gets -2 VP.",
  },
  [PatronType.SHORT]: {
    emoji: "🧒",
    description: "Bonus if no one in front. Penalty behind Tall.",
  },
  [PatronType.CRITIC]: {
    emoji: "🎩",
    description: "Triple VP if in an aisle seat!",
  },
  [PatronType.NOISY]: {
    emoji: "📢",
    description: "Giftable! Adjacent Standard Patrons get -2 VP.",
  },
};
Object.freeze(PatronInfo);

/**
 * Creates the full 56-card deck per GAME_DESIGN.md spec.
 * @returns {CardData[]}
 */
export function createDeck() {
  /** @type {Array<{type: string, count: number}>} */
  const deckSpec = [
    { type: PatronType.STANDARD, count: 8 },
    { type: PatronType.BESPECTACLED, count: 8 },
    { type: PatronType.VIP, count: 4 },
    { type: PatronType.LOVEBIRDS, count: 8 },
    { type: PatronType.KID, count: 8 },
    { type: PatronType.TEACHER, count: 5 },
    { type: PatronType.TALL, count: 4 },
    { type: PatronType.SHORT, count: 3 },
    { type: PatronType.CRITIC, count: 4 },
    { type: PatronType.NOISY, count: 4 },
  ];

  /** @type {CardData[]} */
  const deck = [];

  for (const { type, count } of deckSpec) {
    const info = PatronInfo[type];
    for (let i = 0; i < count; i++) {
      deck.push({
        type,
        label: type,
        emoji: info.emoji,
        description: info.description,
      });
    }
  }

  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}
