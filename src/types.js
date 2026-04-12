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
    // backRows is determined by the layout, not hardcoded here
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
 * Layout metadata for a theater.
 * Defines the physical grid, aisle positions, and optional house rule.
 *
 * @typedef {Object} LayoutMeta
 * @property {string} id - Unique layout identifier
 * @property {string} name - Display name (e.g. "The Grand Empress")
 * @property {string} emoji - Theater emoji for UI
 * @property {string} [bgKey] - Texture key for the full background image (game scene)
 * @property {string} [bgThumbKey] - Texture key for the thumbnail background (theater selection)
 * @property {string} description - Short description for selection screen
 * @property {number} rows - Number of rows
 * @property {number} cols - Number of columns (max width)
 * @property {number[]} aisleCols - Default aisle columns (used when aisleColsByRow is not set)
 * @property {number[][]} [aisleColsByRow] - Per-row aisle columns (e.g. Promenade)
 * @property {number[]} backRows - Row indices that count as "back" of theater
 * @property {number[]} [frontRows] - Row indices that count as "front" (default: [0, 1])
 * @property {{row: number, col: number}[]} [royalBoxes] - Seats that count as both aisle AND front row
 * @property {boolean[][]} [seatMask] - 2D array: true = seat exists, false = no seat. If absent, all seats exist.
 * @property {number[][]} [adjacencyBreaks] - Pairs [rowA, rowB] where adjacency between rows is severed (e.g. Balcony)
 * @property {{row: number, col: number}[][]} [tableGroups] - Groups of seat positions forming "tables" (Cabaret)
 * @property {boolean} [staggered] - If true, each row is offset by half a seat width (brick-pattern stagger)
 * @property {string|null} [houseRule] - House rule ID for scoring (null = none)
 * @property {string} [houseRuleDescription] - Human-readable house rule text for UI
 * @property {string[][][]} [seatLabels] - 2D array of string arrays: labels per seat ("front", "back", "aisle"). Auto-generated by buildSeatLabels() for legacy layouts, or defined explicitly.
 */

/**
 * Check if a seat has a specific label.
 * @param {number} row
 * @param {number} col
 * @param {string} label - Label to check ("front", "back", "aisle")
 * @param {LayoutMeta} layout
 * @returns {boolean}
 */
export function hasSeatLabel(row, col, label, layout) {
  return layout.seatLabels?.[row]?.[col]?.includes(label) ?? false;
}

/**
 * Auto-generate seatLabels from legacy layout properties.
 * Derives "front", "back", and "aisle" labels from rowBonusRows, backRows,
 * aisleCols/aisleColsByRow, and royalBoxes.
 *
 * @param {LayoutMeta} layout - Layout to generate labels for (mutated: adds seatLabels)
 */
function buildSeatLabels(layout) {
  const { rows, cols } = layout;
  const frontRows = layout.frontRows ?? [0, 1];

  /** @type {string[][][]} */
  const labels = Array.from(
    { length: rows },
    () => Array.from({ length: cols }, () => []),
  );

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Skip non-existent seats
      if (layout.seatMask && !layout.seatMask[r][c]) continue;

      // Front label: from frontRows (used by VIP rowBonus)
      if (frontRows.includes(r)) {
        labels[r][c].push("front");
      }

      // Back label: from backRows (used by Lovebirds multiplier, Bespectacled exclusion)
      if (layout.backRows.includes(r)) {
        labels[r][c].push("back");
      }

      // Aisle label: from aisleCols, aisleColsByRow, or royalBoxes
      let isAisle = false;
      if (layout.royalBoxes?.some((b) => b.row === r && b.col === c)) {
        isAisle = true;
      } else if (layout.aisleColsByRow) {
        isAisle = layout.aisleColsByRow[r]?.includes(c) ?? false;
      } else {
        isAisle = layout.aisleCols.includes(c);
      }
      if (isAisle) {
        labels[r][c].push("aisle");
      }

      // Royal boxes also get "front" if not already
      if (
        layout.royalBoxes?.some((b) => b.row === r && b.col === c) &&
        !labels[r][c].includes("front")
      ) {
        labels[r][c].push("front");
      }
    }
  }

  layout.seatLabels = labels;
}

/** @type {LayoutMeta} */
export const GrandEmpressLayout = {
  id: "grand-empress",
  name: "The Grand Empress",
  emoji: "🏛️",
  bgKey: "bg_grand_empress",
  bgThumbKey: "bg_grand_empress_thumb",
  description: "Classic wide theater. Plentiful aisle seats. No house rule.",
  rows: 4,
  cols: 5,
  aisleCols: [0, 4],
  backRows: [3],
  houseRule: null,
  houseRuleDescription: "The Classics — No special demand. Vanilla scoring.",
};
buildSeatLabels(GrandEmpressLayout);
Object.freeze(GrandEmpressLayout);

/** @type {LayoutMeta} */
export const BlackboxLayout = {
  id: "blackbox",
  name: "The Blackbox",
  emoji: "🎭",
  bgKey: "bg_blackbox",
  bgThumbKey: "bg_blackbox_thumb",
  description: "Deep & narrow. Center aisles only. Dense packing rewarded.",
  rows: 5,
  cols: 4,
  aisleCols: [1, 2],
  backRows: [4],
  houseRule: "intimate-venue",
  houseRuleDescription:
    "Intimate Venue — Each patron adjacent to 3+ others gets +1 VP.",
};
buildSeatLabels(BlackboxLayout);
Object.freeze(BlackboxLayout);

/** @type {LayoutMeta} */
export const RoyalTheatreLayout = {
  id: "royal-theatre",
  name: "The Royal Theatre",
  emoji: "👑",
  bgKey: "bg_royal_theatre",
  bgThumbKey: "bg_royal_theatre_thumb",
  description: "Royal Boxes in the front corners. Best patron gets +3 VP.",
  rows: 4,
  cols: 5,
  aisleCols: [0, 4],
  backRows: [3],
  royalBoxes: [
    { row: 0, col: 0 },
    { row: 0, col: 4 },
  ],
  houseRule: "royal-approval",
  houseRuleDescription:
    "Royal Approval — Your highest-scoring patron gets +3 VP.",
};
buildSeatLabels(RoyalTheatreLayout);
Object.freeze(RoyalTheatreLayout);

/** @type {LayoutMeta} */
export const PromenadeLayout = {
  id: "promenade",
  name: "The Promenade",
  emoji: "🚶",
  bgKey: "bg_promenade",
  bgThumbKey: "bg_promenade_thumb",
  description: "Staggered aisles every row. Critics spread out.",
  rows: 4,
  cols: 5,
  aisleCols: [], // not used — aisleColsByRow takes precedence
  aisleColsByRow: [
    [0, 4], // Row 0
    [2], // Row 1
    [0, 4], // Row 2
    [2], // Row 3
  ],
  backRows: [3],
  houseRule: "wandering-critics",
  houseRuleDescription:
    "Wandering Critics — +1 VP per Critic if you have 3+ Critics in aisle seats.",
};
buildSeatLabels(PromenadeLayout);
Object.freeze(PromenadeLayout);

// ── Batch 2: Non-rectangular layouts ────────────────────────────────

/** @type {LayoutMeta} */
export const AmphitheaterLayout = {
  id: "amphitheater",
  name: "The Amphitheater",
  emoji: "🏛",
  bgKey: "bg_amphitheater",
  bgThumbKey: "bg_amphitheater_thumb",
  description:
    "Tiered rows narrow toward the back. No aisles. Fill rows for bonus VP.",
  rows: 4,
  cols: 6,
  aisleCols: [],
  backRows: [3],
  seatMask: [
    //       col: 0     1     2     3     4     5
    /* Row 0 */ [true, true, true, true, true, true], // 6 seats
    /* Row 1 */ [false, true, true, true, true, true], // 5 seats (offset 1)
    /* Row 2 */ [false, true, true, true, true, false], // 4 seats (centered)
    /* Row 3 */ [false, false, true, true, true, false], // 3 seats (centered)
  ],
  staggered: true,
  houseRule: "panorama",
  houseRuleDescription: "The Panorama — +2 VP for each completely filled row.",
};
buildSeatLabels(AmphitheaterLayout);
Object.freeze(AmphitheaterLayout);

/**
 * Helper: build a seatMask with gap columns (for Cabaret tables).
 * @param {number} rows
 * @param {number} cols
 * @param {number[]} gapCols - column indices that are gaps (no seats)
 * @returns {boolean[][]}
 */
function buildGappedMask(rows, cols, gapCols) {
  const gapSet = new Set(gapCols);
  return Array.from(
    { length: rows },
    () => Array.from({ length: cols }, (_, c) => !gapSet.has(c)),
  );
}

/** @type {LayoutMeta} */
export const CabaretLayout = {
  id: "cabaret",
  name: "The Cabaret",
  emoji: "🍸",
  bgKey: "bg_cabaret",
  bgThumbKey: "bg_cabaret_thumb",
  description: "Intimate tables of 4. Fill a table for +3 VP.",
  rows: 4,
  cols: 8,
  aisleCols: [],
  backRows: [3],
  adjacencyBreaks: [[1, 2]], // Horizontal gap between row-pairs (top 3 tables / bottom 3 tables)
  seatMask: buildGappedMask(4, 8, [2, 5]),
  // Cols: [0,1]  gap  [3,4]  gap  [6,7]
  // 3 tables per row-pair (rows 0-1, rows 2-3)
  // Each table = 2×2 block
  tableGroups: [
    // Row 0-1 tables
    [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }, {
      row: 1,
      col: 1,
    }],
    [{ row: 0, col: 3 }, { row: 0, col: 4 }, { row: 1, col: 3 }, {
      row: 1,
      col: 4,
    }],
    [{ row: 0, col: 6 }, { row: 0, col: 7 }, { row: 1, col: 6 }, {
      row: 1,
      col: 7,
    }],
    // Row 2-3 tables
    [{ row: 2, col: 0 }, { row: 2, col: 1 }, { row: 3, col: 0 }, {
      row: 3,
      col: 1,
    }],
    [{ row: 2, col: 3 }, { row: 2, col: 4 }, { row: 3, col: 3 }, {
      row: 3,
      col: 4,
    }],
    [{ row: 2, col: 6 }, { row: 2, col: 7 }, { row: 3, col: 6 }, {
      row: 3,
      col: 7,
    }],
  ],
  houseRule: "full-tables",
  houseRuleDescription:
    "Full Tables — +3 VP for each 2×2 table where all 4 seats are occupied.",
};
buildSeatLabels(CabaretLayout);
Object.freeze(CabaretLayout);

/** @type {LayoutMeta} */
export const BalconyLayout = {
  id: "balcony",
  name: "The Balcony",
  emoji: "🌃",
  bgKey: "bg_balcony",
  bgThumbKey: "bg_balcony_thumb",
  description:
    "Elevated balcony (row A) disconnected from the main floor.",
  rows: 4,
  cols: 5,
  aisleCols: [0, 4],
  backRows: [3],
  adjacencyBreaks: [[0, 1]], // Row 0 (balcony) is NOT adjacent to row 1
  houseRule: "birds-eye-view",
  houseRuleDescription:
    "Bird's Eye View — Tall in balcony doesn't penalize. Short in balcony always gets +2 VP.",
};
buildSeatLabels(BalconyLayout);
Object.freeze(BalconyLayout);

/** @type {LayoutMeta} */
export const RotundaLayout = {
  id: "rotunda",
  name: "The Rotunda",
  emoji: "🎪",
  bgKey: "bg_rotunda",
  bgThumbKey: "bg_rotunda_thumb",
  description:
    "Theater in the round. No back row. Stage-side seats are front row.",
  rows: 5,
  cols: 5,
  aisleCols: [],
  backRows: [],
  seatMask: [
    //       col: 0     1      2      3      4
    /* Row 0 */ [false, true, true, true, false],
    /* Row 1 */ [true, true, false, true, true],
    /* Row 2 */ [true, false, false, false, true],
    /* Row 3 */ [true, true, false, true, true],
    /* Row 4 */ [false, true, true, true, false],
  ],
  seatLabels: [
    //       col: 0          1           2           3           4
    /* Row 0 */ [[], ["front"], ["front"], ["front"], []],
    /* Row 1 */ [["aisle"], ["front"], [], ["front"], ["aisle"]],
    /* Row 2 */ [["aisle"], [], [], [], ["aisle"]],
    /* Row 3 */ [["aisle"], ["front"], [], ["front"], ["aisle"]],
    /* Row 4 */ [[], ["front"], ["front"], ["front"], []],
  ],
  houseRule: null,
  houseRuleDescription:
    "In the Round — No back row. Stage-side seats are front row. Outer seats are aisles.",
};
Object.freeze(RotundaLayout);

/**
 * All available theater layouts, keyed by ID.
 * @type {Record<string, LayoutMeta>}
 */
export const Layouts = {
  [GrandEmpressLayout.id]: GrandEmpressLayout,
  [BlackboxLayout.id]: BlackboxLayout,
  [RoyalTheatreLayout.id]: RoyalTheatreLayout,
  [PromenadeLayout.id]: PromenadeLayout,
  [AmphitheaterLayout.id]: AmphitheaterLayout,
  [CabaretLayout.id]: CabaretLayout,
  [BalconyLayout.id]: BalconyLayout,
  [RotundaLayout.id]: RotundaLayout,
};
Object.freeze(Layouts);

/**
 * Ordered list of layout IDs for UI display.
 * @type {string[]}
 */
export const LayoutOrder = [
  GrandEmpressLayout.id,
  BlackboxLayout.id,
  RoyalTheatreLayout.id,
  PromenadeLayout.id,
  AmphitheaterLayout.id,
  CabaretLayout.id,
  BalconyLayout.id,
  RotundaLayout.id,
];
Object.freeze(LayoutOrder);

/** Backward-compatible alias. */
export const DefaultLayout = GrandEmpressLayout;

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
