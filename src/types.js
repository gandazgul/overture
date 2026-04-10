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

// ── Primary Patron Types ───────────────────────────────────────────

/**
 * Primary patron types — the identity of each card.
 * We use a frozen object as an "enum" pattern in JavaScript.
 *
 * @readonly
 * @enum {string}
 */
export const PatronType = /** @type {const} */ ({
  STANDARD: "Standard",
  VIP: "VIP",
  LOVEBIRDS: "Lovebirds",
  KID: "Kid",
  TEACHER: "Teacher",
  CRITIC: "Critic",
});
Object.freeze(PatronType);

// ── Secondary Traits ───────────────────────────────────────────────

/**
 * Secondary traits that can be mixed onto any primary patron type.
 * A card has 0 or 1 trait. Traits modify scoring with additional
 * bonuses or penalties on top of the primary type's scoring.
 *
 * @readonly
 * @enum {string}
 */
export const Trait = /** @type {const} */ ({
  TALL: "Tall",
  SHORT: "Short",
  BESPECTACLED: "Bespectacled",
  NOISY: "Noisy",
});
Object.freeze(Trait);

// ── Colors ─────────────────────────────────────────────────────────

/**
 * The color associated with each primary patron type (for card rendering).
 * @type {Record<string, number>}
 */
export const PatronColors = {
  [PatronType.STANDARD]: 0x607d8b, // Blue-grey
  [PatronType.VIP]: 0xffc107, // Gold
  [PatronType.LOVEBIRDS]: 0xe91e63, // Pink
  [PatronType.KID]: 0x4caf50, // Green
  [PatronType.TEACHER]: 0x8bc34a, // Light green
  [PatronType.CRITIC]: 0x9c27b0, // Purple
};
Object.freeze(PatronColors);

/**
 * Optional tint overlays for traits — used to add a visual indicator.
 * @type {Record<string, number>}
 */
export const TraitColors = {
  [Trait.TALL]: 0x795548, // Brown
  [Trait.SHORT]: 0xff9800, // Orange
  [Trait.BESPECTACLED]: 0x2196f3, // Blue
  [Trait.NOISY]: 0xf44336, // Red
};
Object.freeze(TraitColors);

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

// ── Card Data ──────────────────────────────────────────────────────

/**
 * Data for a single patron card.
 * @typedef {Object} CardData
 * @property {string} type - One of the PatronType values (primary identity)
 * @property {string} [trait] - Optional secondary trait (one of Trait values)
 * @property {string} label - Display name (e.g. "Tall Kid")
 * @property {string} emoji - Visual icon(s) for the card
 * @property {string} description - Short tooltip text
 */

/**
 * A seat position on the theater grid.
 * @typedef {Object} SeatPosition
 * @property {number} row - Row index (0 = front/stage, 3 = back)
 * @property {number} col - Column index (0 = left)
 */

// ── Patron Info ────────────────────────────────────────────────────

/**
 * Card definitions with emoji and descriptions for each primary patron type.
 * @type {Record<string, {emoji: string, description: string}>}
 */
export const PatronInfo = {
  [PatronType.STANDARD]: {
    emoji: "🧑",
    description: "A regular patron. Worth 3 VP anywhere.",
  },
  [PatronType.VIP]: {
    emoji: "⭐",
    description: "High VP in front rows. Penalty near Kids or Noisy patrons.",
  },
  [PatronType.LOVEBIRDS]: {
    emoji: "💕",
    description: "Score only if adjacent to another Lovebirds. ×2 in back row.",
  },
  [PatronType.KID]: {
    emoji: "👦",
    description: "0 VP unless capped by Teachers on both ends!",
  },
  [PatronType.TEACHER]: {
    emoji: "👩‍🏫",
    description: "Scores VP for each adjacent capped Kid.",
  },
  [PatronType.CRITIC]: {
    emoji: "🎩",
    description: "Triple VP if in an aisle seat!",
  },
};
Object.freeze(PatronInfo);

/**
 * Info for secondary traits — emoji and descriptions.
 * @type {Record<string, {emoji: string, description: string}>}
 */
export const TraitInfo = {
  [Trait.TALL]: {
    emoji: "🦒",
    description: "Patron behind gets −2 VP.",
  },
  [Trait.SHORT]: {
    emoji: "🧒",
    description: "+2 VP if no one in front. −3 VP if Tall is in front.",
  },
  [Trait.BESPECTACLED]: {
    emoji: "🤓",
    description: "+2 VP in front 3 rows (closer to stage).",
  },
  [Trait.NOISY]: {
    emoji: "📢",
    description: "Each adjacent patron gets −1 VP.",
  },
};
Object.freeze(TraitInfo);

// ── Scoring Config ─────────────────────────────────────────────────

/**
 * Scoring parameters for each primary patron type.
 * Keeps all tuning knobs in one place for easy playtesting adjustments.
 *
 * @typedef {Object} ScoringParams
 * @property {number} base - Base VP awarded for placing this patron
 * @property {number} [rowBonusValue] - Extra VP per qualifying row
 * @property {number[]} [rowBonusRows] - Row indices that grant the bonus (0 = front)
 * @property {number} [aisleMultiplier] - Multiply total VP if seated in an aisle seat
 * @property {number} [adjacencyPenaltyPer] - VP penalty per adjacent patron of a triggering type
 * @property {string[]} [adjacencyPenaltyTypes] - Patron types that trigger the adjacency penalty
 * @property {boolean} [adjacencyPenaltyNoisyTrait] - Also penalized by adjacent Noisy-trait patrons
 * @property {number} [cappedValue] - VP when this patron is "capped" (Kid-specific)
 * @property {number} [perCappedKidBonus] - VP bonus per adjacent capped Kid (Teacher-specific)
 * @property {number} [adjacentMatchBonus] - VP if orthogonally adjacent to same type (Lovebirds)
 * @property {number} [backRowMultiplier] - Multiply total VP if in the designated back row
 * @property {number[]} [backRows] - Row indices that count as "back" for multiplier
 */

/**
 * Scoring configuration keyed by PatronType.
 * @type {Record<string, ScoringParams>}
 */
export const PatronScoring = {
  [PatronType.STANDARD]: {
    base: 3,
  },
  [PatronType.VIP]: {
    base: 5,
    rowBonusValue: 3,
    rowBonusRows: [0, 1], // front 2 rows
    adjacencyPenaltyPer: -3,
    adjacencyPenaltyTypes: [PatronType.KID],
    adjacencyPenaltyNoisyTrait: true, // also penalized by Noisy-trait neighbors
  },
  [PatronType.LOVEBIRDS]: {
    base: 0,
    adjacentMatchBonus: 3, // VP if adjacent to another Lovebirds
    backRowMultiplier: 2,
    backRows: [3], // last row
  },
  [PatronType.KID]: {
    base: 0, // uncapped
    cappedValue: 2, // when capped by Teachers
  },
  [PatronType.TEACHER]: {
    base: 1,
    perCappedKidBonus: 1,
  },
  [PatronType.CRITIC]: {
    base: 2,
    aisleMultiplier: 3,
  },
};
Object.freeze(PatronScoring);

/**
 * Scoring parameters for secondary traits.
 *
 * @typedef {Object} TraitScoringParams
 * @property {number} [behindPenalty] - VP penalty applied to the patron directly behind
 * @property {number} [emptyFrontBonus] - VP bonus if no patron is directly in front
 * @property {number} [tallInFrontPenalty] - VP penalty if a Tall-trait patron is directly in front
 * @property {number} [rowBonusValue] - Extra VP per qualifying row
 * @property {number[]} [rowBonusRows] - Row indices that grant the bonus
 * @property {number} [adjacentPenalty] - VP penalty applied to each adjacent patron
 */

/**
 * Scoring configuration keyed by Trait.
 * @type {Record<string, TraitScoringParams>}
 */
export const TraitScoring = {
  [Trait.TALL]: {
    behindPenalty: -2, // applied to the patron directly behind this one
  },
  [Trait.SHORT]: {
    emptyFrontBonus: 2,
    tallInFrontPenalty: -3,
  },
  [Trait.BESPECTACLED]: {
    rowBonusValue: 2,
    rowBonusRows: [0, 1, 2], // front 3 rows
  },
  [Trait.NOISY]: {
    adjacentPenalty: -1, // applied to EACH adjacent patron (any type)
  },
};
Object.freeze(TraitScoring);

// ── Layout ─────────────────────────────────────────────────────────

/**
 * Default layout metadata for the current 4×5 theater.
 * Future layouts will provide their own metadata objects.
 *
 * @typedef {Object} LayoutMeta
 * @property {number} rows - Number of rows
 * @property {number} cols - Number of columns
 * @property {number[]} aisleCols - Column indices that count as aisle seats
 * @property {number[]} backRows - Row indices that count as "back" of theater
 */

/** @type {LayoutMeta} */
export const DefaultLayout = {
  rows: 4,
  cols: 5,
  aisleCols: [0, 4], // leftmost and rightmost seats
  backRows: [3],
};
Object.freeze(DefaultLayout);

// ── Deck Builder ───────────────────────────────────────────────────

/**
 * Creates the full 56-card deck.
 * 35 clean cards + 21 cards with traits.
 *
 * Trait breakdown: 6 Tall, 6 Short, 5 Bespectacled, 4 Noisy.
 *
 * @returns {CardData[]}
 */
export function createDeck() {
  /**
   * Deck spec: each entry is [type, trait (or null), count].
   * @type {Array<[string, string | null, number]>}
   */
  const deckSpec = [
    // Standard (21 total: 13 clean + 8 with traits)
    [PatronType.STANDARD, null, 13],
    [PatronType.STANDARD, Trait.TALL, 2],
    [PatronType.STANDARD, Trait.SHORT, 2],
    [PatronType.STANDARD, Trait.BESPECTACLED, 2],
    [PatronType.STANDARD, Trait.NOISY, 2],

    // VIP (4 total: 3 clean + 1 Bespectacled)
    [PatronType.VIP, null, 3],
    [PatronType.VIP, Trait.BESPECTACLED, 1],

    // Lovebirds (10 total: 8 clean + 1 Tall + 1 Noisy)
    [PatronType.LOVEBIRDS, null, 8],
    [PatronType.LOVEBIRDS, Trait.TALL, 1],
    [PatronType.LOVEBIRDS, Trait.NOISY, 1],

    // Kid (8 total: 5 clean + 1 Tall + 1 Short + 1 Noisy)
    [PatronType.KID, null, 5],
    [PatronType.KID, Trait.TALL, 1],
    [PatronType.KID, Trait.SHORT, 1],
    [PatronType.KID, Trait.NOISY, 1],

    // Teacher (6 total: 3 clean + 1 Tall + 1 Short + 1 Bespectacled)
    [PatronType.TEACHER, null, 3],
    [PatronType.TEACHER, Trait.TALL, 1],
    [PatronType.TEACHER, Trait.SHORT, 1],
    [PatronType.TEACHER, Trait.BESPECTACLED, 1],

    // Critic (7 total: 3 clean + 1 Tall + 2 Short + 1 Bespectacled)
    [PatronType.CRITIC, null, 3],
    [PatronType.CRITIC, Trait.TALL, 1],
    [PatronType.CRITIC, Trait.SHORT, 2],
    [PatronType.CRITIC, Trait.BESPECTACLED, 1],
  ];

  /** @type {CardData[]} */
  const deck = [];

  for (const [type, trait, count] of deckSpec) {
    const typeInfo = PatronInfo[type];
    const traitInfo = trait ? TraitInfo[trait] : null;

    const label = trait ? `${trait} ${type}` : type;
    const emoji = traitInfo
      ? `${traitInfo.emoji}${typeInfo.emoji}`
      : typeInfo.emoji;
    const description = traitInfo
      ? `${typeInfo.description} ${traitInfo.description}`
      : typeInfo.description;

    for (let i = 0; i < count; i++) {
      /** @type {CardData} */
      const card = { type, label, emoji, description };
      if (trait) card.trait = trait;
      deck.push(card);
    }
  }

  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}
