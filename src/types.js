// @ts-check

import { randomInt } from './utils.js';

// ── Primary Patron Types ───────────────────────────────────────────

/**
 * Primary patron types — the identity of each card.
 * We use a frozen object as an "enum" pattern in JavaScript.
 *
 * @readonly
 * @enum {string}
 */
export const PatronType = /** @type {const} */ ({
  STANDARD: "Patron",
  VIP: "VIP",
  LOVEBIRDS: "Lovebirds",
  KID: "Kid",
  TEACHER: "Teacher",
  CRITIC: "Critic",
  FRIENDS: "Friends",
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

// ── Shared Patron/Trait Metadata ───────────────────────────────────

/**
 * Scoring parameters for each primary patron type.
 * Keeps all tuning knobs in one place for easy playtesting adjustments.
 *
 * @typedef {Object} ScoringParams
 * @property {number} base - Base VP awarded for placing this patron
 * @property {number} [rowBonusValue] - Extra VP per qualifying row
 * @property {number[]} [rowBonusRows] - Row indices that grant the bonus (0 = front)
 * @property {number} [aisleBonus] - Extra VP if seated in an aisle seat (additive)
 * @property {number} [adjacencyPenaltyPer] - VP penalty per adjacent patron of a triggering type
 * @property {string[]} [adjacencyPenaltyTypes] - Patron types that trigger the adjacency penalty
 * @property {boolean} [adjacencyPenaltyNoisyTrait] - Also penalized by adjacent Noisy-trait patrons
 * @property {number} [cappedValue] - VP when this patron is "capped" (Kid-specific)
 * @property {number} [perCappedKidBonus] - VP bonus per adjacent capped Kid (Teacher-specific)
 * @property {number} [adjacentMatchBonus] - VP if orthogonally adjacent to same type (Lovebirds)
 * @property {number} [backRowBonus] - Extra VP if in the designated back row (additive)
 * @property {number[]} [backRows] - Row indices that count as "back" for multiplier
 * @property {number} [perNeighborMatchBonus] - VP bonus per orthogonally adjacent patron of the same type (Friends)
 */

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
 * Per-type deck composition.
 * @typedef {Object} PatronDeckInfo
 * @property {number} clean - Count of non-trait cards for this patron type
 * @property {Record<string, number>} traits - Count by trait for this patron type
 */

/**
 * Canonical patron type metadata.
 * This is the single source of truth for visuals, scoring, tooltips and deck composition.
 *
 * @type {Record<string, {
 *   color: number,
 *   description: string,
 *   scoringHint: string,
 *   scoring: ScoringParams,
 *   deck: PatronDeckInfo,
 *   assetKey: string,
 *   assetPath: string,
 * }>}
 */
export const PatronInfo = {
  [PatronType.STANDARD]: {
    color: 0x607d8b,
    description: "A regular patron. Worth 3 VP anywhere.",
    scoringHint: "Base 3VP",
    scoring: { base: 3 },
    deck: {
      clean: 5,
      traits: {
        [Trait.TALL]: 2,
        [Trait.SHORT]: 2,
        [Trait.BESPECTACLED]: 2,
        [Trait.NOISY]: 2,
      },
    },
    assetKey: "patron_patron",
    assetPath: "assets/patron_patron.png",
  },
  [PatronType.VIP]: {
    color: 0xffc107,
    description: "3 VP base. +3 VP in front rows. −3 per adjacent Kid or Noisy.",
    scoringHint: "Base 3 VP\n+3VP in the front 2 rows\n⚠ −3VP per adjacent Kid or Noisy",
    scoring: {
      base: 3,
      rowBonusValue: 3,
      rowBonusRows: [0, 1],
      adjacencyPenaltyPer: -3,
      adjacencyPenaltyTypes: [PatronType.KID],
      adjacencyPenaltyNoisyTrait: true,
    },
    deck: {
      clean: 3,
      traits: { [Trait.BESPECTACLED]: 1 },
    },
    assetKey: "patron_vip",
    assetPath: "assets/patron_vip.png",
  },
  [PatronType.LOVEBIRDS]: {
    color: 0xe91e63,
    description: "1 VP alone. +3 if horizontally paired. +2 in back row.",
    scoringHint: "+3VP if paired side by side with another.\n+2VP in back row\n⚠ 0 VP if alone",
    scoring: {
      base: 1,
      adjacentMatchBonus: 3,
      backRowBonus: 2,
    },
    deck: {
      clean: 8,
      traits: {
        [Trait.TALL]: 1,
        [Trait.NOISY]: 1,
      },
    },
    assetKey: "patron_lovebirds",
    assetPath: "assets/patron_lovebirds.png",
  },
  [PatronType.KID]: {
    color: 0x4caf50,
    description: "1 VP uncapped. 3 VP when capped by Teachers!",
    scoringHint: "Base 1VP\n+2VP when capped e.g. T-K-T",
    scoring: {
      base: 1,
      cappedValue: 3,
    },
    deck: {
      clean: 5,
      traits: {
        [Trait.TALL]: 1,
        [Trait.SHORT]: 1,
        [Trait.NOISY]: 1,
      },
    },
    assetKey: "patron_kid",
    assetPath: "assets/patron_kid.png",
  },
  [PatronType.TEACHER]: {
    color: 0x8bc34a,
    description: "3 VP base. +1 VP per adjacent capped Kid.",
    scoringHint: "Base 3VP\n+1VP per capped Kid in its chain",
    scoring: {
      base: 3,
      perCappedKidBonus: 1,
    },
    deck: {
      clean: 3,
      traits: {
        [Trait.TALL]: 1,
        [Trait.SHORT]: 1,
        [Trait.BESPECTACLED]: 1,
      },
    },
    assetKey: "patron_teacher",
    assetPath: "assets/patron_teacher.png",
  },
  [PatronType.CRITIC]: {
    color: 0x9c27b0,
    description: "+3 VP in aisle seat. Noisy neighbors nullify the bonus!",
    scoringHint: "Base 3VP\n+3VP in an aisle seat (gold border)",
    scoring: {
      base: 3,
      aisleBonus: 3,
    },
    deck: {
      clean: 3,
      traits: {
        [Trait.TALL]: 1,
        [Trait.SHORT]: 2,
        [Trait.BESPECTACLED]: 1,
      },
    },
    assetKey: "patron_critic",
    assetPath: "assets/patron_critic.png",
  },
  [PatronType.FRIENDS]: {
    color: 0x00bcd4,
    description: "3 VP base. +1 VP per adjacent Friend.",
    scoringHint: "Base 3VP\n+1VP per adjacent Friend",
    scoring: {
      base: 3,
      perNeighborMatchBonus: 1,
    },
    deck: {
      clean: 5,
      traits: {
        [Trait.TALL]: 1,
        [Trait.SHORT]: 1,
        [Trait.BESPECTACLED]: 1,
      },
    },
    assetKey: "patron_friends",
    assetPath: "assets/patron_friends.png",
  },
};
Object.freeze(PatronInfo);

/**
 * Canonical trait metadata.
 *
 * @type {Record<string, {
 *   color: number,
 *   description: string,
 *   scoringHint: string,
 *   scoring: TraitScoringParams,
 *   badgeAssetKey: string,
 *   badgeAssetPath: string,
 * }>}
 */
export const TraitInfo = {
  [Trait.TALL]: {
    color: 0x795548,
    description: "Patron behind gets −2 VP.",
    scoringHint: "⚠ Patron behind gets −2VP",
    scoring: { behindPenalty: -2 },
    badgeAssetKey: "badge_tall",
    badgeAssetPath: "assets/badge_tall.png",
  },
  [Trait.SHORT]: {
    color: 0xff9800,
    description: "+2 VP if no one in front. −3 VP if Tall is in front.",
    scoringHint: "+2VP if no one in front\n⚠ −3 VP if Tall in front",
    scoring: {
      emptyFrontBonus: 2,
      tallInFrontPenalty: -3,
    },
    badgeAssetKey: "badge_short",
    badgeAssetPath: "assets/badge_short.png",
  },
  [Trait.BESPECTACLED]: {
    color: 0x2196f3,
    description: "+2 VP in front 3 rows (closer to stage).",
    scoringHint: "+2VP unless seated on the back row",
    scoring: {
      rowBonusValue: 2,
      rowBonusRows: [0, 1, 2],
    },
    badgeAssetKey: "badge_bespectacled",
    badgeAssetPath: "assets/badge_bespectacled.png",
  },
  [Trait.NOISY]: {
    color: 0xf44336,
    description: "Each adjacent patron gets −1 VP.",
    scoringHint: "⚠ Each adjacent patron gets −1VP",
    scoring: { adjacentPenalty: -1 },
    badgeAssetKey: "badge_noisy",
    badgeAssetPath: "assets/badge_noisy.png",
  },
};
Object.freeze(TraitInfo);

/** Primary patron type display order. */
export const PatronTypeOrder = [
  PatronType.STANDARD,
  PatronType.VIP,
  PatronType.LOVEBIRDS,
  PatronType.KID,
  PatronType.TEACHER,
  PatronType.CRITIC,
  PatronType.FRIENDS,
];
Object.freeze(PatronTypeOrder);

/** Trait display order. */
export const TraitOrder = [
  Trait.TALL,
  Trait.SHORT,
  Trait.BESPECTACLED,
  Trait.NOISY,
];
Object.freeze(TraitOrder);

// ── Derived Patron/Trait Maps (Backward-compatible exports) ───────

/**
 * The color associated with each primary patron type (for card rendering).
 * @type {Record<string, number>}
 */
export const PatronColors = Object.freeze(
  PatronTypeOrder.reduce((acc, type) => {
    acc[type] = PatronInfo[type].color;
    return acc;
  }, /** @type {Record<string, number>} */ ({})),
);

/**
 * Optional tint overlays for traits — used to add a visual indicator.
 * @type {Record<string, number>}
 */
export const TraitColors = Object.freeze(
  TraitOrder.reduce((acc, trait) => {
    acc[trait] = TraitInfo[trait].color;
    return acc;
  }, /** @type {Record<string, number>} */ ({})),
);

/**
 * Scoring configuration keyed by PatronType.
 * @type {Record<string, ScoringParams>}
 */
export const PatronScoring = Object.freeze(
  PatronTypeOrder.reduce((acc, type) => {
    acc[type] = PatronInfo[type].scoring;
    return acc;
  }, /** @type {Record<string, ScoringParams>} */ ({})),
);

/**
 * Scoring configuration keyed by Trait.
 * @type {Record<string, TraitScoringParams>}
 */
export const TraitScoring = Object.freeze(
  TraitOrder.reduce((acc, trait) => {
    acc[trait] = TraitInfo[trait].scoring;
    return acc;
  }, /** @type {Record<string, TraitScoringParams>} */ ({})),
);

/**
 * Flat deck tuples [type, trait, count] generated from PatronInfo.
 * @type {ReadonlyArray<readonly [string, string | null, number]>}
 */
export const PatronDeckSpec = Object.freeze(
  PatronTypeOrder.flatMap((type) => {
    const info = PatronInfo[type];
    const entries = /** @type {Array<[string, string | null, number]>} */ ([]);
    entries.push([type, null, info.deck.clean]);
    for (const [trait, count] of Object.entries(info.deck.traits)) {
      entries.push([type, trait, count]);
    }
    return entries;
  }),
);

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
 * @property {string} description - Short tooltip text
 */

/**
 * A seat position on the theater grid.
 * @typedef {Object} SeatPosition
 * @property {number} row - Row index (0 = front/stage, 3 = back)
 * @property {number} col - Column index (0 = left)
 */

// ── Layout ─────────────────────────────────────────────────────────

/**
 * Layout metadata for a theater.
 * Defines the physical grid, aisle positions, and optional house rule.
 *
 * @typedef {Object} LayoutMeta
 * @property {string} id - Unique layout identifier
 * @property {string} name - Display name (e.g. "The Grand Empress")
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

      // Royal boxes also get "front" if not already, and always get "box"
      if (
        layout.royalBoxes?.some((b) => b.row === r && b.col === c)
      ) {
        if (!labels[r][c].includes("front")) {
          labels[r][c].push("front");
        }
        labels[r][c].push("box");
      }
    }
  }

  layout.seatLabels = labels;
}

/** @type {LayoutMeta} */
export const GrandEmpressLayout = {
  id: "grand-empress",
  name: "The Grand Empress",
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
  bgKey: "bg_amphitheater",
  bgThumbKey: "bg_amphitheater_thumb",
  description: "Tiered rows widen toward the back. No aisles. Fill rows for bonus VP.",
  rows: 4,
  cols: 6,
  aisleCols: [],
  backRows: [3],
  // TODO: The 2 seats behind a seat should be considered adjacent for FRIENDS, NOISY and TALL/SHORT traits, even though there's no direct adjacency.
  //  This is a bit tricky to implement since it breaks the standard orthogonal adjacency model. We may need to add a custom "extendedAdjacency" property to the layout that defines these special cases.
  seatMask: [
    //       col: 0     1     2     3     4     5
    /* Row 0 */ [false, false, true, true, true, false], // 3 seats (narrow front)
    /* Row 1 */ [false, true, true, true, true, false], // 4 seats
    /* Row 2 */ [false, true, true, true, true, true], // 5 seats
    /* Row 3 */ [true, true, true, true, true, true], // 6 seats (wide back)
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
 * Trait breakdown: 7 Tall, 7 Short, 6 Bespectacled, 4 Noisy.
 *
 * @returns {CardData[]}
 */
export function createDeck() {
  /** @type {CardData[]} */
  const deck = [];

  for (const [type, trait, count] of PatronDeckSpec) {
    const typeInfo = PatronInfo[type];
    const traitInfo = trait ? TraitInfo[trait] : null;

    const label = trait ? `${trait} ${type}` : type;
    const description = traitInfo
      ? `${typeInfo.description} ${traitInfo.description}`
      : typeInfo.description;

    for (let i = 0; i < count; i++) {
      /** @type {CardData} */
      const card = { type, label, description };
      if (trait) card.trait = trait;
      deck.push(card);
    }
  }

  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(i);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}
