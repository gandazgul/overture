// @ts-check
/// <reference lib="deno.ns" />

/**
 * Scoring engine tests — run with `deno test src/scoring.test.js`
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/assert_equals.ts";
import {
  findHorizontalKidGroups,
  getOrthogonalNeighbors,
  isAisleSeat,
  scorePlayer,
} from "./scoring.js";
import {
  BlackboxLayout,
  createDeck,
  DefaultLayout,
  hasSeatLabel,
  PatronType,
  PromenadeLayout,
  RotundaLayout,
  RoyalTheatreLayout,
  Trait,
} from "./types.js";

/** @typedef {import('./types.js').CardData} CardData */

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Create an empty grid for a given layout.
 * @param {import('./types.js').LayoutMeta} [layout]
 * @returns {(CardData | null)[][]}
 */
function emptyGrid(layout) {
  const rows = layout?.rows ?? 4;
  const cols = layout?.cols ?? 5;
  return Array.from({ length: rows }, () => Array(cols).fill(null));
}

/**
 * Create a CardData for a given patron type with optional trait.
 * @param {string} type
 * @param {string} [trait]
 * @returns {CardData}
 */
function card(type, trait) {
  /** @type {CardData} */
  const c = {
    type,
    label: trait ? `${trait} ${type}` : type,
    description: "",
  };
  if (trait) c.trait = trait;
  return c;
}

/**
 * Place a patron on the grid.
 * @param {(CardData | null)[][]} grid
 * @param {number} row
 * @param {number} col
 * @param {string} type
 * @param {string} [trait]
 */
function place(grid, row, col, type, trait) {
  grid[row][col] = card(type, trait);
}

// ── Utility function tests ──────────────────────────────────────────

Deno.test("getOrthogonalNeighbors - center seat has 4 neighbors", () => {
  const n = getOrthogonalNeighbors(1, 2, 4, 5);
  assertEquals(n.length, 4);
});

Deno.test("getOrthogonalNeighbors - corner seat has 2 neighbors", () => {
  const n = getOrthogonalNeighbors(0, 0, 4, 5);
  assertEquals(n.length, 2);
});

Deno.test("isAisleSeat - col 0 and col 4 are aisles in default layout", () => {
  assertEquals(isAisleSeat(0, 0, DefaultLayout), true);
  assertEquals(isAisleSeat(0, 4, DefaultLayout), true);
  assertEquals(isAisleSeat(0, 2, DefaultLayout), false);
});

// ── Primary Type: Standard ──────────────────────────────────────────

Deno.test("Standard patron scores 3 VP anywhere", () => {
  const grid = emptyGrid();
  place(grid, 2, 3, PatronType.STANDARD);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[2][3], 3);
});

// ── Primary Type: VIP ───────────────────────────────────────────────

Deno.test("VIP in row 0 alone scores 6 VP (3 base + 3 row bonus)", () => {
  const grid = emptyGrid();
  place(grid, 0, 2, PatronType.VIP);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[0][2], 6);
});

Deno.test("VIP in back row scores 3 VP (base only)", () => {
  const grid = emptyGrid();
  place(grid, 3, 2, PatronType.VIP);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[3][2], 3);
});

Deno.test("VIP adjacent to Kid gets -3 penalty", () => {
  const grid = emptyGrid();
  place(grid, 0, 2, PatronType.VIP);
  place(grid, 0, 3, PatronType.KID);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[0][2], 3); // 6 - 3
});

Deno.test("VIP adjacent to two Kids gets -6 penalty", () => {
  const grid = emptyGrid();
  place(grid, 0, 2, PatronType.VIP);
  place(grid, 0, 1, PatronType.KID);
  place(grid, 0, 3, PatronType.KID);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[0][2], 0); // 6 - 6
});

Deno.test("VIP adjacent to Noisy-trait patron gets -3 penalty", () => {
  const grid = emptyGrid();
  place(grid, 0, 2, PatronType.VIP);
  place(grid, 0, 3, PatronType.STANDARD, Trait.NOISY);
  const result = scorePlayer(grid, DefaultLayout);
  // VIP: 6 base+row - 3 adjacencyPenalty (Noisy trait) - 1 (Noisy cross-type) = 2
  assertEquals(result.perSeat[0][2], 2);
});

// ── Primary Type: Critic ────────────────────────────────────────────

Deno.test("Critic on aisle seat scores 6 VP (2 × 3)", () => {
  const grid = emptyGrid();
  place(grid, 1, 0, PatronType.CRITIC);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][0], 6);
});

Deno.test("Critic on non-aisle seat scores 3 VP", () => {
  const grid = emptyGrid();
  place(grid, 1, 2, PatronType.CRITIC);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][2], 3);
});

// ── Primary Type: Friends ────────────────────────────────────────────

Deno.test("Friends alone scores 3 VP (base)", () => {
  const grid = emptyGrid();
  place(grid, 2, 2, PatronType.FRIENDS);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[2][2], 3);
});

Deno.test("Friends horizontal pair scores 4 VP each", () => {
  const grid = emptyGrid();
  place(grid, 1, 2, PatronType.FRIENDS);
  place(grid, 1, 3, PatronType.FRIENDS);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][2], 4);
  assertEquals(result.perSeat[1][3], 4);
});

Deno.test("Friends vertical pair scores 4 VP each", () => {
  const grid = emptyGrid();
  place(grid, 1, 2, PatronType.FRIENDS);
  place(grid, 2, 2, PatronType.FRIENDS);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][2], 4);
  assertEquals(result.perSeat[2][2], 4);
});

Deno.test("Friends 2×2 block scores 5 VP each", () => {
  const grid = emptyGrid();
  place(grid, 1, 1, PatronType.FRIENDS);
  place(grid, 1, 2, PatronType.FRIENDS);
  place(grid, 2, 1, PatronType.FRIENDS);
  place(grid, 2, 2, PatronType.FRIENDS);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][1], 5);
  assertEquals(result.perSeat[1][2], 5);
  assertEquals(result.perSeat[2][1], 5);
  assertEquals(result.perSeat[2][2], 5);
});

Deno.test("Friends: line of 3 horizontal — middle gets +2, edges get +1", () => {
  const grid = emptyGrid();
  place(grid, 1, 1, PatronType.FRIENDS);
  place(grid, 1, 2, PatronType.FRIENDS);
  place(grid, 1, 3, PatronType.FRIENDS);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][1], 4); // 3+1
  assertEquals(result.perSeat[1][2], 5); // 3+2
  assertEquals(result.perSeat[1][3], 4); // 3+1
});

Deno.test("Friends isolated among other types scores 3 VP", () => {
  const grid = emptyGrid();
  place(grid, 1, 2, PatronType.FRIENDS);
  place(grid, 1, 1, PatronType.STANDARD);
  place(grid, 1, 3, PatronType.VIP);
  place(grid, 0, 2, PatronType.KID);
  place(grid, 2, 2, PatronType.CRITIC);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][2], 3); // no same-type neighbors
});

// ── Primary Type: Kid & Teacher ─────────────────────────────────────

Deno.test("findHorizontalKidGroups - single uncapped Kid", () => {
  const row = [null, card(PatronType.KID), null, null, null];
  const groups = findHorizontalKidGroups(row, 5);
  assertEquals(groups.length, 1);
  assertEquals(groups[0].capped, false);
});

Deno.test("findHorizontalKidGroups - capped group", () => {
  const row = [
    card(PatronType.TEACHER),
    card(PatronType.KID),
    card(PatronType.KID),
    card(PatronType.TEACHER),
    null,
  ];
  const groups = findHorizontalKidGroups(row, 5);
  assertEquals(groups.length, 1);
  assertEquals(groups[0].capped, true);
  assertEquals(groups[0].cols, [1, 2]);
});

Deno.test("findHorizontalKidGroups - partially capped (left only)", () => {
  const row = [
    card(PatronType.TEACHER),
    card(PatronType.KID),
    card(PatronType.KID),
    null,
    null,
  ];
  const groups = findHorizontalKidGroups(row, 5);
  assertEquals(groups[0].capped, false);
});

Deno.test("Uncapped Kid scores 1 VP", () => {
  const grid = emptyGrid();
  place(grid, 1, 2, PatronType.KID);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][2], 1);
});

Deno.test("Capped Kids score 3 VP each, Teachers get per-kid bonus", () => {
  const grid = emptyGrid();
  place(grid, 1, 0, PatronType.TEACHER);
  place(grid, 1, 1, PatronType.KID);
  place(grid, 1, 2, PatronType.KID);
  place(grid, 1, 3, PatronType.TEACHER);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][1], 3); // capped Kid
  assertEquals(result.perSeat[1][2], 3); // capped Kid
  assertEquals(result.perSeat[1][0], 4); // Teacher: 3 base + 1 per capped Kid
  assertEquals(result.perSeat[1][3], 4); // Teacher: 3 base + 1 per capped Kid
});

// ── Primary Type: Lovebirds ─────────────────────────────────────────

Deno.test("Lovebirds alone scores 1 VP", () => {
  const grid = emptyGrid();
  place(grid, 1, 2, PatronType.LOVEBIRDS);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][2], 1);
});

Deno.test("Lovebirds pair in non-back row scores 4 VP each", () => {
  const grid = emptyGrid();
  place(grid, 1, 2, PatronType.LOVEBIRDS);
  place(grid, 1, 3, PatronType.LOVEBIRDS);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][2], 4);
  assertEquals(result.perSeat[1][3], 4);
});

Deno.test("Lovebirds pair in back row scores 6 VP each (+2 back bonus)", () => {
  const grid = emptyGrid();
  place(grid, 3, 2, PatronType.LOVEBIRDS);
  place(grid, 3, 3, PatronType.LOVEBIRDS);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[3][2], 6);
  assertEquals(result.perSeat[3][3], 6);
});

// ── Trait: Bespectacled ─────────────────────────────────────────────

Deno.test("Bespectacled Standard in front row scores 5 VP (3 base + 2 trait bonus)", () => {
  const grid = emptyGrid();
  place(grid, 0, 2, PatronType.STANDARD, Trait.BESPECTACLED);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[0][2], 5);
});

Deno.test("Bespectacled Standard in back row scores 3 VP (base only)", () => {
  const grid = emptyGrid();
  place(grid, 3, 2, PatronType.STANDARD, Trait.BESPECTACLED);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[3][2], 3);
});

Deno.test("Bespectacled Standard in row 2 (last bonus row) scores 5 VP", () => {
  const grid = emptyGrid();
  place(grid, 2, 2, PatronType.STANDARD, Trait.BESPECTACLED);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[2][2], 5);
});

Deno.test("Bespectacled VIP in front row stacks both bonuses", () => {
  const grid = emptyGrid();
  place(grid, 0, 2, PatronType.VIP, Trait.BESPECTACLED);
  const result = scorePlayer(grid, DefaultLayout);
  // VIP: 3 base + 3 row bonus + 2 bespectacled trait = 8
  assertEquals(result.perSeat[0][2], 8);
});

Deno.test("Bespectacled Teacher scores row bonus + capping bonus", () => {
  const grid = emptyGrid();
  place(grid, 1, 0, PatronType.TEACHER, Trait.BESPECTACLED);
  place(grid, 1, 1, PatronType.KID);
  place(grid, 1, 2, PatronType.TEACHER);
  const result = scorePlayer(grid, DefaultLayout);
  // Bespectacled Teacher: 3 base + 2 bespectacled + 1 capped kid = 6
  assertEquals(result.perSeat[1][0], 6);
});

// ── Trait: Tall ─────────────────────────────────────────────────────

Deno.test("Tall Standard scores 3 VP, patron behind gets -2", () => {
  const grid = emptyGrid();
  place(grid, 1, 2, PatronType.STANDARD, Trait.TALL);
  place(grid, 2, 2, PatronType.STANDARD);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][2], 3); // Tall Standard: base 3
  assertEquals(result.perSeat[2][2], 1); // Standard behind: 3 - 2 = 1
});

Deno.test("Tall patron with no one behind - only scores base", () => {
  const grid = emptyGrid();
  place(grid, 3, 2, PatronType.STANDARD, Trait.TALL);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[3][2], 3);
});

Deno.test("Tall Kid: Kid scores 1 VP (uncapped), patron behind gets -2 VP", () => {
  const grid = emptyGrid();
  place(grid, 1, 2, PatronType.KID, Trait.TALL);
  place(grid, 2, 2, PatronType.STANDARD);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][2], 1); // Tall Kid: uncapped = 1
  assertEquals(result.perSeat[2][2], 1); // Standard behind: 3 - 2 = 1
});

// ── Trait: Short ────────────────────────────────────────────────────

Deno.test("Short Standard with empty front scores 5 VP (3 base + 2 bonus)", () => {
  const grid = emptyGrid();
  place(grid, 1, 2, PatronType.STANDARD, Trait.SHORT);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][2], 5);
});

Deno.test("Short patron in front row (row 0) scores bonus (no one can be in front)", () => {
  const grid = emptyGrid();
  place(grid, 0, 2, PatronType.STANDARD, Trait.SHORT);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[0][2], 5); // 3 base + 2 empty front
});

Deno.test("Short patron behind Tall scores 0 VP (3 base - 3 penalty)", () => {
  const grid = emptyGrid();
  place(grid, 0, 2, PatronType.STANDARD, Trait.TALL);
  place(grid, 1, 2, PatronType.STANDARD, Trait.SHORT);
  const result = scorePlayer(grid, DefaultLayout);
  // Short: 3 base + (-3) tallInFrontPenalty = 0 (NOT also -2 from behindPenalty)
  assertEquals(result.perSeat[1][2], 0);
});

Deno.test("Short patron behind non-Tall patron scores base only", () => {
  const grid = emptyGrid();
  place(grid, 0, 2, PatronType.STANDARD);
  place(grid, 1, 2, PatronType.STANDARD, Trait.SHORT);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][2], 3); // base only, no bonus, no penalty
});

Deno.test("Short Critic on front-row aisle with empty front = max score", () => {
  const grid = emptyGrid();
  place(grid, 0, 0, PatronType.CRITIC, Trait.SHORT);
  const result = scorePlayer(grid, DefaultLayout);
  // Critic: 3 base + 3 aisle = 6, then +2 short empty front = 8
  assertEquals(result.perSeat[0][0], 8);
});

// ── Trait: Noisy ────────────────────────────────────────────────────

Deno.test("Noisy Standard: each adjacent patron gets -1 VP", () => {
  const grid = emptyGrid();
  place(grid, 1, 2, PatronType.STANDARD, Trait.NOISY);
  place(grid, 1, 3, PatronType.STANDARD); // neighbor
  place(grid, 0, 2, PatronType.STANDARD); // neighbor
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][2], 3); // Noisy Standard itself: 3 base
  assertEquals(result.perSeat[1][3], 2); // neighbor: 3 - 1 = 2
  assertEquals(result.perSeat[0][2], 2); // neighbor: 3 - 1 = 2
});

Deno.test("Noisy affects ALL patron types, not just Standard", () => {
  const grid = emptyGrid();
  place(grid, 1, 2, PatronType.STANDARD, Trait.NOISY);
  place(grid, 1, 3, PatronType.CRITIC); // non-Standard neighbor
  place(grid, 0, 2, PatronType.TEACHER); // non-Standard neighbor
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][3], 2); // Critic: 3 - 1 = 2
  assertEquals(result.perSeat[0][2], 2); // Teacher: 3 - 1 = 2
});

Deno.test("Two Noisy neighbors stack: patron gets -2 VP", () => {
  const grid = emptyGrid();
  place(grid, 1, 1, PatronType.STANDARD, Trait.NOISY);
  place(grid, 1, 3, PatronType.STANDARD, Trait.NOISY);
  place(grid, 1, 2, PatronType.STANDARD); // sandwiched between two Noisy
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][2], 1); // 3 - 1 - 1 = 1
});

Deno.test("Noisy Kid: uncapped + hurts neighbors", () => {
  const grid = emptyGrid();
  place(grid, 1, 2, PatronType.KID, Trait.NOISY);
  place(grid, 1, 3, PatronType.STANDARD);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][2], 1); // Kid uncapped = 1
  assertEquals(result.perSeat[1][3], 2); // Standard: 3 - 1 = 2
});

// ── Cross-type interactions ─────────────────────────────────────────

Deno.test("Non-Short patron behind Tall gets behindPenalty", () => {
  const grid = emptyGrid();
  place(grid, 0, 2, PatronType.STANDARD, Trait.TALL);
  place(grid, 1, 2, PatronType.STANDARD);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][2], 1); // 3 - 2 = 1
});

Deno.test("Tall behind penalty does NOT double-apply to Short (uses tallInFrontPenalty instead)", () => {
  const grid = emptyGrid();
  place(grid, 1, 2, PatronType.STANDARD, Trait.TALL);
  place(grid, 2, 2, PatronType.STANDARD, Trait.SHORT);
  const result = scorePlayer(grid, DefaultLayout);
  // Short: 3 base - 3 tallInFrontPenalty = 0 (NOT also -2 from behindPenalty)
  assertEquals(result.perSeat[2][2], 0);
});

Deno.test("Unknown patron type scores 0 VP", () => {
  const grid = emptyGrid();
  grid[1][1] = {
    type: "UNKNOWN",
    label: "UNKNOWN",
    description: "",
  };
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][1], 0);
});

Deno.test("Empty grid scores 0 VP total", () => {
  const grid = emptyGrid();
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.total, 0);
});

// ── Trait combos ────────────────────────────────────────────────────

Deno.test("Tall Lovebirds in back row: scores 6 VP but blocks patron in front", () => {
  const grid = emptyGrid();
  place(grid, 3, 2, PatronType.LOVEBIRDS, Trait.TALL);
  place(grid, 3, 3, PatronType.LOVEBIRDS);
  // No one behind (back row), but check Tall doesn't break Lovebirds scoring
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[3][2], 6); // Lovebirds: 1+3+2 back = 6
  assertEquals(result.perSeat[3][3], 6);
});

Deno.test("Noisy Lovebirds pair in back row: 6 VP each, neighbors get -1", () => {
  const grid = emptyGrid();
  place(grid, 3, 2, PatronType.LOVEBIRDS, Trait.NOISY);
  place(grid, 3, 3, PatronType.LOVEBIRDS);
  place(grid, 2, 2, PatronType.STANDARD); // in front of Noisy Lovebirds
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[3][2], 6); // Noisy Lovebirds: 1+3+2 = 6
  assertEquals(result.perSeat[3][3], 5); // Adjacent Lovebirds: 6 - 1 (noisy neighbor) = 5
  assertEquals(result.perSeat[2][2], 2); // Standard: 3 - 1 = 2
});

// ── createDeck tests ────────────────────────────────────────────────

Deno.test("createDeck returns 56 cards", () => {
  const deck = createDeck();
  assertEquals(deck.length, 56);
});

Deno.test("createDeck includes correct count per primary type", () => {
  const deck = createDeck();
  /** @type {Record<string, number>} */
  const counts = {};
  for (const c of deck) {
    counts[c.type] = (counts[c.type] ?? 0) + 1;
  }
  assertEquals(counts[PatronType.STANDARD], 13);
  assertEquals(counts[PatronType.VIP], 4);
  assertEquals(counts[PatronType.LOVEBIRDS], 10);
  assertEquals(counts[PatronType.KID], 8);
  assertEquals(counts[PatronType.TEACHER], 6);
  assertEquals(counts[PatronType.CRITIC], 7);
  assertEquals(counts[PatronType.FRIENDS], 8);
});

Deno.test("createDeck has 24 cards with traits", () => {
  const deck = createDeck();
  const withTraits = deck.filter((c) => c.trait);
  assertEquals(withTraits.length, 24);
});

Deno.test("createDeck trait distribution: 7 Tall, 7 Short, 6 Bespectacled, 4 Noisy", () => {
  const deck = createDeck();
  /** @type {Record<string, number>} */
  const traitCounts = {};
  for (const c of deck) {
    if (c.trait) {
      traitCounts[c.trait] = (traitCounts[c.trait] ?? 0) + 1;
    }
  }
  assertEquals(traitCounts[Trait.TALL], 7);
  assertEquals(traitCounts[Trait.SHORT], 7);
  assertEquals(traitCounts[Trait.BESPECTACLED], 6);
  assertEquals(traitCounts[Trait.NOISY], 4);
});

Deno.test("createDeck cards have, type, label & description", () => {
  const deck = createDeck();
  for (const c of deck) {
    assertEquals(!!c.type, true);
    assertEquals(!!c.label, true);
    assertEquals(!!c.description, true);
  }
});

Deno.test("createDeck: no excluded combos (no Bespectacled/Short Lovebirds, no Noisy VIP, no Noisy Friends)", () => {
  const deck = createDeck();
  for (const c of deck) {
    if (c.type === PatronType.LOVEBIRDS) {
      if (c.trait === Trait.BESPECTACLED || c.trait === Trait.SHORT) {
        throw new Error(`Excluded combo found: ${c.label}`);
      }
    }
    if (c.type === PatronType.VIP && c.trait === Trait.NOISY) {
      throw new Error(`Excluded combo found: ${c.label}`);
    }
    if (c.type === PatronType.FRIENDS && c.trait === Trait.NOISY) {
      throw new Error(`Excluded combo found: ${c.label}`);
    }
  }
});

// ══════════════════════════════════════════════════════════════════
// Blackbox Layout Tests
// ══════════════════════════════════════════════════════════════════

Deno.test("Blackbox: 5 rows × 4 cols, center aisles at cols 1-2", () => {
  assertEquals(BlackboxLayout.rows, 5);
  assertEquals(BlackboxLayout.cols, 4);
  assertEquals(isAisleSeat(1, 1, BlackboxLayout), true);
  assertEquals(isAisleSeat(1, 2, BlackboxLayout), true);
  assertEquals(isAisleSeat(1, 0, BlackboxLayout), false);
  assertEquals(isAisleSeat(1, 3, BlackboxLayout), false);
});

Deno.test("Blackbox: Critic in center aisle scores +3 bonus", () => {
  const grid = emptyGrid(BlackboxLayout);
  place(grid, 2, 1, PatronType.CRITIC); // aisle seat
  const result = scorePlayer(grid, BlackboxLayout);
  assertEquals(result.perSeat[2][1], 6); // 3 + 3
});

Deno.test("Blackbox: Critic on edge (col 0) scores base only", () => {
  const grid = emptyGrid(BlackboxLayout);
  place(grid, 2, 0, PatronType.CRITIC); // NOT an aisle
  const result = scorePlayer(grid, BlackboxLayout);
  assertEquals(result.perSeat[2][0], 3); // base only
});

Deno.test("Blackbox: back row is row 4", () => {
  const grid = emptyGrid(BlackboxLayout);
  place(grid, 4, 1, PatronType.LOVEBIRDS);
  place(grid, 4, 2, PatronType.LOVEBIRDS);
  const result = scorePlayer(grid, BlackboxLayout);
  // Lovebirds in back row adjacent: 1+3+2 = 6
  assertEquals(result.perSeat[4][1], 6);
  assertEquals(result.perSeat[4][2], 6);
});

Deno.test("Blackbox: intimate venue — patron with 3+ neighbors gets +1 VP", () => {
  const grid = emptyGrid(BlackboxLayout);
  // Place a center patron surrounded on 3 sides
  place(grid, 2, 1, PatronType.STANDARD); // center — has neighbors above, below, right
  place(grid, 1, 1, PatronType.STANDARD); // above
  place(grid, 3, 1, PatronType.STANDARD); // below
  place(grid, 2, 2, PatronType.STANDARD); // right
  const result = scorePlayer(grid, BlackboxLayout);
  // Center patron: 3 base + 1 intimate venue = 4
  assertEquals(result.perSeat[2][1], 4);
  // Others have only 1 neighbor each → no bonus
  assertEquals(result.perSeat[1][1], 3);
  assertEquals(result.perSeat[3][1], 3);
  assertEquals(result.perSeat[2][2], 3);
});

Deno.test("Blackbox: intimate venue — patron with exactly 2 neighbors gets no bonus", () => {
  const grid = emptyGrid(BlackboxLayout);
  place(grid, 2, 1, PatronType.STANDARD);
  place(grid, 1, 1, PatronType.STANDARD);
  place(grid, 3, 1, PatronType.STANDARD);
  const result = scorePlayer(grid, BlackboxLayout);
  assertEquals(result.perSeat[2][1], 3); // only 2 neighbors — no bonus
});

// ══════════════════════════════════════════════════════════════════
// Royal Theatre Layout Tests
// ══════════════════════════════════════════════════════════════════

Deno.test("Royal Theatre: Royal Boxes at (0,0) and (0,4) are aisle seats", () => {
  assertEquals(isAisleSeat(0, 0, RoyalTheatreLayout), true);
  assertEquals(isAisleSeat(0, 4, RoyalTheatreLayout), true);
  // Regular aisles still work
  assertEquals(isAisleSeat(1, 0, RoyalTheatreLayout), true);
  assertEquals(isAisleSeat(1, 2, RoyalTheatreLayout), false);
});

Deno.test("Royal Theatre: Critic in Royal Box scores aisle bonus + royal approval", () => {
  const grid = emptyGrid(RoyalTheatreLayout);
  place(grid, 0, 0, PatronType.CRITIC);
  const result = scorePlayer(grid, RoyalTheatreLayout);
  // Critic: 3 + 3 aisle = 6, then +3 royal approval (highest scorer) = 9
  assertEquals(result.perSeat[0][0], 9);
});

Deno.test("Royal Theatre: Bespectacled VIP in Royal Box scores huge", () => {
  const grid = emptyGrid(RoyalTheatreLayout);
  place(grid, 0, 0, PatronType.VIP, Trait.BESPECTACLED);
  const result = scorePlayer(grid, RoyalTheatreLayout);
  // VIP: 3 base + 3 row bonus = 6, Bespectacled: +2 = 8
  // Royal approval: +3 (highest scorer) = 11
  assertEquals(result.perSeat[0][0], 11);
});

Deno.test("Royal Theatre: royal approval goes to front-most on tie", () => {
  const grid = emptyGrid(RoyalTheatreLayout);
  place(grid, 0, 2, PatronType.STANDARD); // 3 VP, row 0
  place(grid, 1, 2, PatronType.STANDARD); // 3 VP, row 1
  const result = scorePlayer(grid, RoyalTheatreLayout);
  // Both score 3 base. Tiebreak: front-most (row 0) gets +3
  assertEquals(result.perSeat[0][2], 6); // 3 + 3 royal approval
  assertEquals(result.perSeat[1][2], 3); // base only
});

Deno.test("Royal Theatre: royal approval goes to left-most on row tie", () => {
  const grid = emptyGrid(RoyalTheatreLayout);
  place(grid, 1, 1, PatronType.STANDARD); // 3 VP
  place(grid, 1, 3, PatronType.STANDARD); // 3 VP
  const result = scorePlayer(grid, RoyalTheatreLayout);
  // Same row, tiebreak: left-most (col 1) gets +3
  assertEquals(result.perSeat[1][1], 6);
  assertEquals(result.perSeat[1][3], 3);
});

Deno.test("Royal Theatre: Royal Box has 'box' seat label", () => {
  assertEquals(hasSeatLabel(0, 0, "box", RoyalTheatreLayout), true);
  assertEquals(hasSeatLabel(0, 4, "box", RoyalTheatreLayout), true);
  // Non-box seats don't have the label
  assertEquals(hasSeatLabel(0, 1, "box", RoyalTheatreLayout), false);
  assertEquals(hasSeatLabel(1, 0, "box", RoyalTheatreLayout), false);
});

Deno.test("Royal Theatre: Royal Box is NOT adjacent to row 0 front seats", () => {
  // Box at (0,0) should have NO neighbors (isolated from row 0 + row 1)
  const neighbors00 = getOrthogonalNeighbors(0, 0, 4, 5, RoyalTheatreLayout);
  assertEquals(neighbors00.length, 0);
  // Box at (0,4) also isolated
  const neighbors04 = getOrthogonalNeighbors(0, 4, 4, 5, RoyalTheatreLayout);
  assertEquals(neighbors04.length, 0);
});

Deno.test("Royal Theatre: front row seat (0,1) is not adjacent to box (0,0)", () => {
  const neighbors = getOrthogonalNeighbors(0, 1, 4, 5, RoyalTheatreLayout);
  // (0,1) should see (0,2) to the right and (1,1) below, but NOT (0,0) the box
  const hasBox = neighbors.some((n) => n.row === 0 && n.col === 0);
  assertEquals(hasBox, false);
  assertEquals(neighbors.length, 2); // (0,2) and (1,1)
});

Deno.test("Royal Theatre: VIP in Royal Box NOT penalized by adjacent Kid", () => {
  const grid = emptyGrid(RoyalTheatreLayout);
  place(grid, 0, 0, PatronType.VIP);  // Royal Box
  place(grid, 0, 1, PatronType.KID);  // adjacent in grid, but isolated by box
  place(grid, 1, 0, PatronType.KID);  // below box, also isolated
  const result = scorePlayer(grid, RoyalTheatreLayout);
  // VIP: 3 base + 3 front row = 6, NO Kid penalty (isolated), +3 royal approval = 9
  assertEquals(result.perSeat[0][0], 9);
});

Deno.test("Royal Theatre: Noisy in (0,1) does NOT affect patron in Royal Box", () => {
  const grid = emptyGrid(RoyalTheatreLayout);
  place(grid, 0, 0, PatronType.STANDARD);             // Royal Box
  place(grid, 0, 1, PatronType.STANDARD, Trait.NOISY); // adjacent in grid, isolated
  const result = scorePlayer(grid, RoyalTheatreLayout);
  // Standard in box: 3 base, no Noisy penalty (isolated), +3 royal approval = 6
  assertEquals(result.perSeat[0][0], 6);
  // Standard Noisy at (0,1): 3 base - 0 Noisy self, no neighbors penalized across box boundary
  assertEquals(result.perSeat[0][1], 3);
});

Deno.test("Royal Theatre: Lovebirds in box (0,0) and front (0,1) are NOT paired", () => {
  const grid = emptyGrid(RoyalTheatreLayout);
  place(grid, 0, 0, PatronType.LOVEBIRDS); // Royal Box
  place(grid, 0, 1, PatronType.LOVEBIRDS); // front row
  const result = scorePlayer(grid, RoyalTheatreLayout);
  // Neither is paired (box isolation), each scores 1 base
  // Royal approval: +3 to one of them (front-most tiebreak → row 0, left-most col 0)
  assertEquals(result.perSeat[0][0], 4); // 1 + 3 royal approval
  assertEquals(result.perSeat[0][1], 1); // 1 base only
});

// ══════════════════════════════════════════════════════════════════
// Promenade Layout Tests
// ══════════════════════════════════════════════════════════════════

Deno.test("Promenade: aisles alternate per row", () => {
  // Row 0: cols 0, 4 are aisles
  assertEquals(isAisleSeat(0, 0, PromenadeLayout), true);
  assertEquals(isAisleSeat(0, 4, PromenadeLayout), true);
  assertEquals(isAisleSeat(0, 2, PromenadeLayout), false);
  // Row 1: col 2 is aisle
  assertEquals(isAisleSeat(1, 2, PromenadeLayout), true);
  assertEquals(isAisleSeat(1, 0, PromenadeLayout), false);
  assertEquals(isAisleSeat(1, 4, PromenadeLayout), false);
  // Row 2: cols 0, 4
  assertEquals(isAisleSeat(2, 0, PromenadeLayout), true);
  // Row 3: col 2
  assertEquals(isAisleSeat(3, 2, PromenadeLayout), true);
  assertEquals(isAisleSeat(3, 0, PromenadeLayout), false);
});

Deno.test("Promenade: Critic in row 1 col 2 (aisle) scores +3 bonus", () => {
  const grid = emptyGrid(PromenadeLayout);
  place(grid, 1, 2, PatronType.CRITIC);
  const result = scorePlayer(grid, PromenadeLayout);
  assertEquals(result.perSeat[1][2], 6); // 3 + 3
});

Deno.test("Promenade: Critic in row 1 col 0 (not aisle) scores base", () => {
  const grid = emptyGrid(PromenadeLayout);
  place(grid, 1, 0, PatronType.CRITIC);
  const result = scorePlayer(grid, PromenadeLayout);
  assertEquals(result.perSeat[1][0], 3); // base only
});

Deno.test("Promenade: wandering critics — 3+ critics in aisles gives all critics +1", () => {
  const grid = emptyGrid(PromenadeLayout);
  place(grid, 0, 0, PatronType.CRITIC); // aisle (row 0, col 0)
  place(grid, 1, 2, PatronType.CRITIC); // aisle (row 1, col 2)
  place(grid, 2, 4, PatronType.CRITIC); // aisle (row 2, col 4)
  place(grid, 3, 1, PatronType.CRITIC); // NOT aisle (row 3, col 1)
  const result = scorePlayer(grid, PromenadeLayout);
  // 3 critics in aisles → all 4 critics get +1 VP
  assertEquals(result.perSeat[0][0], 7); // 3+3 aisle + 1 wandering = 7
  assertEquals(result.perSeat[1][2], 7); // 3+3 aisle + 1 wandering = 7
  assertEquals(result.perSeat[2][4], 7); // 3+3 aisle + 1 wandering = 7
  assertEquals(result.perSeat[3][1], 4); // 3 base (no aisle) + 1 wandering = 4
});

Deno.test("Promenade: wandering critics — fewer than 3 in aisles gives no bonus", () => {
  const grid = emptyGrid(PromenadeLayout);
  place(grid, 0, 0, PatronType.CRITIC); // aisle
  place(grid, 1, 2, PatronType.CRITIC); // aisle
  place(grid, 3, 1, PatronType.CRITIC); // NOT aisle
  const result = scorePlayer(grid, PromenadeLayout);
  // Only 2 critics in aisles → no wandering bonus
  assertEquals(result.perSeat[0][0], 6); // 3+3 aisle only
  assertEquals(result.perSeat[1][2], 6);
  assertEquals(result.perSeat[3][1], 3); // base only
});

// ══════════════════════════════════════════════════════════════════
// Amphitheater Layout Tests
// ══════════════════════════════════════════════════════════════════

import { AmphitheaterLayout, BalconyLayout, CabaretLayout } from "./types.js";

Deno.test("Amphitheater: 18 seats in tiered rows (3-4-5-6)", () => {
  const mask = /** @type {boolean[][]} */ (AmphitheaterLayout.seatMask);
  assertEquals(mask[0].filter(Boolean).length, 3);
  assertEquals(mask[1].filter(Boolean).length, 4);
  assertEquals(mask[2].filter(Boolean).length, 5);
  assertEquals(mask[3].filter(Boolean).length, 6);
});

Deno.test("Amphitheater: no aisle seats", () => {
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 6; c++) {
      assertEquals(isAisleSeat(r, c, AmphitheaterLayout), false);
    }
  }
});

Deno.test("Amphitheater: Critic scores base 3 VP only (no aisles)", () => {
  const grid = emptyGrid(AmphitheaterLayout);
  place(grid, 0, 2, PatronType.CRITIC); // seat exists at (0,2)
  const result = scorePlayer(grid, AmphitheaterLayout);
  assertEquals(result.perSeat[0][2], 3);
});

Deno.test("Amphitheater: neighbors respect seatMask", () => {
  // Row 0 only has seats at cols 2,3,4. A patron at row 0, col 2
  // should NOT have col 1 as a neighbor (no seat there).
  const neighbors = getOrthogonalNeighbors(0, 2, 4, 6, AmphitheaterLayout);
  const hasBadNeighbor = neighbors.some((n) => n.row === 0 && n.col === 1);
  assertEquals(hasBadNeighbor, false);
  // But col 3 should be a neighbor
  const hasGoodNeighbor = neighbors.some((n) => n.row === 0 && n.col === 3);
  assertEquals(hasGoodNeighbor, true);
});

Deno.test("Amphitheater: staggered adjacency includes both seats behind", () => {
  const neighbors = getOrthogonalNeighbors(1, 2, 4, 6, AmphitheaterLayout);
  const hasBackSameCol = neighbors.some((n) => n.row === 2 && n.col === 2);
  const hasBackRightCol = neighbors.some((n) => n.row === 2 && n.col === 3);
  assertEquals(hasBackSameCol, true);
  assertEquals(hasBackRightCol, true);
});

Deno.test("Amphitheater: Friends count staggered behind seat as adjacent", () => {
  const grid = emptyGrid(AmphitheaterLayout);
  place(grid, 1, 2, PatronType.FRIENDS);
  place(grid, 2, 3, PatronType.FRIENDS); // staggered behind-right adjacency
  const result = scorePlayer(grid, AmphitheaterLayout);
  assertEquals(result.perSeat[1][2], 4); // 3 base + 1 adjacent Friend
  assertEquals(result.perSeat[2][3], 4); // symmetric adjacency
});

Deno.test("Amphitheater: Noisy affects staggered behind adjacent seat", () => {
  const grid = emptyGrid(AmphitheaterLayout);
  place(grid, 1, 2, PatronType.STANDARD, Trait.NOISY);
  place(grid, 2, 3, PatronType.STANDARD); // staggered behind-right adjacency
  const result = scorePlayer(grid, AmphitheaterLayout);
  assertEquals(result.perSeat[2][3], 2); // 3 base - 1 noisy adjacency
});

Deno.test("Amphitheater: VIP adjacency penalty applies to staggered behind Kid", () => {
  const grid = emptyGrid(AmphitheaterLayout);
  place(grid, 1, 2, PatronType.VIP); // front row bonus applies on row 1
  place(grid, 2, 3, PatronType.KID); // staggered behind-right adjacency
  const result = scorePlayer(grid, AmphitheaterLayout);
  assertEquals(result.perSeat[1][2], 3); // 3 base +3 front -3 adjacent Kid
});

Deno.test("Amphitheater: Short behind staggered-front Tall gets Tall-in-front penalty", () => {
  const grid = emptyGrid(AmphitheaterLayout);
  place(grid, 1, 2, PatronType.STANDARD, Trait.TALL);
  place(grid, 2, 3, PatronType.STANDARD, Trait.SHORT); // sees (1,2) in front row adjacency
  const result = scorePlayer(grid, AmphitheaterLayout);
  assertEquals(result.perSeat[2][3], 0); // 3 base - 3 Tall-in-front
});

Deno.test("Amphitheater: non-Short behind staggered-front Tall gets behind penalty", () => {
  const grid = emptyGrid(AmphitheaterLayout);
  place(grid, 1, 2, PatronType.STANDARD, Trait.TALL);
  place(grid, 2, 3, PatronType.STANDARD);
  const result = scorePlayer(grid, AmphitheaterLayout);
  assertEquals(result.perSeat[2][3], 1); // 3 base - 2 Tall behind penalty
});

Deno.test("Amphitheater: panorama — +2 VP for completely filled row", () => {
  const grid = emptyGrid(AmphitheaterLayout);
  // Fill row 0 completely (3 seats: cols 2,3,4 — narrow front)
  place(grid, 0, 2, PatronType.STANDARD);
  place(grid, 0, 3, PatronType.STANDARD);
  place(grid, 0, 4, PatronType.STANDARD);
  const result = scorePlayer(grid, AmphitheaterLayout);
  // 3 standards = 9 VP base + 2 panorama = 11
  assertEquals(result.total, 11);
});

Deno.test("Amphitheater: panorama — incomplete row gets no bonus", () => {
  const grid = emptyGrid(AmphitheaterLayout);
  // Fill 2 of 3 seats in row 0
  place(grid, 0, 2, PatronType.STANDARD);
  place(grid, 0, 3, PatronType.STANDARD);
  const result = scorePlayer(grid, AmphitheaterLayout);
  assertEquals(result.total, 6); // just 2 × 3 VP
});

Deno.test("Amphitheater: Lovebirds in back row (row 3) get +2 back bonus", () => {
  const grid = emptyGrid(AmphitheaterLayout);
  place(grid, 3, 2, PatronType.LOVEBIRDS);
  place(grid, 3, 3, PatronType.LOVEBIRDS);
  const result = scorePlayer(grid, AmphitheaterLayout);
  // 1+3+2 = 6 each
  assertEquals(result.perSeat[3][2], 6);
  assertEquals(result.perSeat[3][3], 6);
});

// ══════════════════════════════════════════════════════════════════
// Cabaret Layout Tests
// ══════════════════════════════════════════════════════════════════

Deno.test("Cabaret: 24 seats with gap columns at 2 and 5", () => {
  const mask = /** @type {boolean[][]} */ (CabaretLayout.seatMask);
  assertEquals(mask.flat().filter(Boolean).length, 24);
  // Gap columns
  for (let r = 0; r < 4; r++) {
    assertEquals(mask[r][2], false);
    assertEquals(mask[r][5], false);
  }
});

Deno.test("Cabaret: gaps break adjacency between tables", () => {
  // Col 1 and col 3 are separated by gap col 2
  const neighbors = getOrthogonalNeighbors(0, 1, 4, 8, CabaretLayout);
  const hasCol3 = neighbors.some((n) => n.row === 0 && n.col === 3);
  assertEquals(hasCol3, false); // col 2 is a gap, col 3 is not adjacent
  // But col 0 IS a neighbor
  const hasCol0 = neighbors.some((n) => n.row === 0 && n.col === 0);
  assertEquals(hasCol0, true);
});

Deno.test("Cabaret: Noisy patron only affects tablemates, not other tables", () => {
  const grid = emptyGrid(CabaretLayout);
  place(grid, 0, 1, PatronType.STANDARD, Trait.NOISY); // table 1, right seat
  place(grid, 0, 0, PatronType.STANDARD); // table 1, left seat (adjacent)
  place(grid, 0, 3, PatronType.STANDARD); // table 2, left seat (NOT adjacent)
  const result = scorePlayer(grid, CabaretLayout);
  assertEquals(result.perSeat[0][0], 2); // 3 - 1 noisy
  assertEquals(result.perSeat[0][3], 3); // unaffected by noisy
});

Deno.test("Cabaret: full-tables — +3 VP for full 2×2 table", () => {
  const grid = emptyGrid(CabaretLayout);
  // Fill first table (rows 0-1, cols 0-1)
  place(grid, 0, 0, PatronType.STANDARD);
  place(grid, 0, 1, PatronType.STANDARD);
  place(grid, 1, 0, PatronType.STANDARD);
  place(grid, 1, 1, PatronType.STANDARD);
  const result = scorePlayer(grid, CabaretLayout);
  // 4 × 3 VP = 12 + 3 full table = 15
  assertEquals(result.total, 15);
});

Deno.test("Cabaret: incomplete table gets no bonus", () => {
  const grid = emptyGrid(CabaretLayout);
  place(grid, 0, 0, PatronType.STANDARD);
  place(grid, 0, 1, PatronType.STANDARD);
  place(grid, 1, 0, PatronType.STANDARD);
  // Missing (1,1)
  const result = scorePlayer(grid, CabaretLayout);
  assertEquals(result.total, 9); // 3 × 3 VP, no table bonus
});

Deno.test("Cabaret: 6 table groups defined", () => {
  assertEquals(CabaretLayout.tableGroups?.length ?? 0, 6);
});

Deno.test("Cabaret: adjacency broken between row 1 and row 2", () => {
  // Row 1 can't see row 2 (horizontal gap between row-pairs)
  const neighbors = getOrthogonalNeighbors(1, 0, 4, 8, CabaretLayout);
  const hasRow2 = neighbors.some((n) => n.row === 2);
  assertEquals(hasRow2, false);
  // Row 2 can't see row 1 either
  const neighbors2 = getOrthogonalNeighbors(2, 0, 4, 8, CabaretLayout);
  const hasRow1 = neighbors2.some((n) => n.row === 1);
  assertEquals(hasRow1, false);
  // Row 0 CAN see row 1
  const neighbors0 = getOrthogonalNeighbors(0, 0, 4, 8, CabaretLayout);
  const hasRow1from0 = neighbors0.some((n) => n.row === 1);
  assertEquals(hasRow1from0, true);
});

Deno.test("Cabaret: Kid capped by Teacher at same table", () => {
  // Table at rows 0-1, cols 0-1 (grid cols 0,1)
  const grid = emptyGrid(CabaretLayout);
  grid[0][0] = card(PatronType.KID); // seat (0,0)
  grid[0][1] = card(PatronType.TEACHER); // seat (0,1) — same table
  const result = scorePlayer(grid, CabaretLayout);
  // Kid should be capped (3 VP)
  assertEquals(result.perSeat[0][0], 3);
});

Deno.test("Cabaret: Kid NOT capped without Teacher at same table", () => {
  // Kid at table 1 (rows 0-1, cols 0-1), Teacher at table 2 (rows 0-1, cols 3-4)
  const grid = emptyGrid(CabaretLayout);
  grid[0][0] = card(PatronType.KID); // table 1
  grid[0][3] = card(PatronType.TEACHER); // table 2 — different table
  const result = scorePlayer(grid, CabaretLayout);
  // Kid should NOT be capped (1 VP base)
  assertEquals(result.perSeat[0][0], 1);
});

Deno.test("Cabaret: Teacher scores +1 per adjacent capped Kid", () => {
  // Table at rows 0-1, cols 0-1: Teacher + 2 adjacent Kids
  const grid = emptyGrid(CabaretLayout);
  grid[0][0] = card(PatronType.TEACHER); // adjacent to (0,1) and (1,0)
  grid[0][1] = card(PatronType.KID); // adjacent to teacher
  grid[1][0] = card(PatronType.KID); // adjacent to teacher
  const result = scorePlayer(grid, CabaretLayout);
  // Teacher: 3 base + 2 (two adjacent capped Kids) = 5 VP
  assertEquals(result.perSeat[0][0], 5);
  // Both Kids capped: 3 VP each
  assertEquals(result.perSeat[0][1], 3);
  assertEquals(result.perSeat[1][0], 3);
});

Deno.test("Cabaret: one Teacher caps all Kids at the same table", () => {
  // Fill entire table: 1 Teacher + 3 Kids
  const grid = emptyGrid(CabaretLayout);
  grid[0][0] = card(PatronType.TEACHER);
  grid[0][1] = card(PatronType.KID);
  grid[1][0] = card(PatronType.KID);
  grid[1][1] = card(PatronType.KID);
  const result = scorePlayer(grid, CabaretLayout);
  // All 3 Kids capped (3 VP each)
  assertEquals(result.perSeat[0][1], 3);
  assertEquals(result.perSeat[1][0], 3);
  assertEquals(result.perSeat[1][1], 3);
});

// ══════════════════════════════════════════════════════════════════
// Balcony Layout Tests
// ══════════════════════════════════════════════════════════════════

Deno.test("Balcony: adjacency broken between row 0 and row 1", () => {
  const neighbors = getOrthogonalNeighbors(0, 2, 4, 5, BalconyLayout);
  const hasRow1 = neighbors.some((n) => n.row === 1);
  assertEquals(hasRow1, false);
  // Row 1 also can't see row 0
  const neighbors1 = getOrthogonalNeighbors(1, 2, 4, 5, BalconyLayout);
  const hasRow0 = neighbors1.some((n) => n.row === 0);
  assertEquals(hasRow0, false);
  // Row 1 CAN see row 2
  const hasRow2 = neighbors1.some((n) => n.row === 2);
  assertEquals(hasRow2, true);
});

Deno.test("Balcony: Tall patron in balcony (row 0) doesn't penalize row 1", () => {
  const grid = emptyGrid(BalconyLayout);
  place(grid, 0, 2, PatronType.STANDARD, Trait.TALL);
  place(grid, 1, 2, PatronType.STANDARD);
  const result = scorePlayer(grid, BalconyLayout);
  assertEquals(result.perSeat[0][2], 3); // Tall Standard: base 3
  assertEquals(result.perSeat[1][2], 3); // Standard behind: NO penalty (adjacency broken)
});

Deno.test("Balcony: Tall patron in row 1 still penalizes row 2", () => {
  const grid = emptyGrid(BalconyLayout);
  place(grid, 1, 2, PatronType.STANDARD, Trait.TALL);
  place(grid, 2, 2, PatronType.STANDARD);
  const result = scorePlayer(grid, BalconyLayout);
  assertEquals(result.perSeat[1][2], 3);
  assertEquals(result.perSeat[2][2], 1); // 3 - 2 penalty
});

Deno.test("Balcony: Short patron in balcony (row 0) always gets +2 VP bonus", () => {
  const grid = emptyGrid(BalconyLayout);
  place(grid, 0, 2, PatronType.STANDARD, Trait.SHORT);
  const result = scorePlayer(grid, BalconyLayout);
  assertEquals(result.perSeat[0][2], 5); // 3 + 2 (no one in front)
});

Deno.test("Balcony: Noisy in balcony doesn't affect row 1", () => {
  const grid = emptyGrid(BalconyLayout);
  place(grid, 0, 2, PatronType.STANDARD, Trait.NOISY);
  place(grid, 1, 2, PatronType.STANDARD);
  const result = scorePlayer(grid, BalconyLayout);
  assertEquals(result.perSeat[1][2], 3); // unaffected by Noisy in balcony
});

Deno.test("Balcony: Noisy in balcony still affects other balcony patrons", () => {
  const grid = emptyGrid(BalconyLayout);
  place(grid, 0, 2, PatronType.STANDARD, Trait.NOISY);
  place(grid, 0, 3, PatronType.STANDARD);
  const result = scorePlayer(grid, BalconyLayout);
  assertEquals(result.perSeat[0][3], 2); // 3 - 1 noisy
});

Deno.test("Balcony: Lovebirds in back row (row 3) get +2 back bonus", () => {
  const grid = emptyGrid(BalconyLayout);
  place(grid, 3, 2, PatronType.LOVEBIRDS);
  place(grid, 3, 3, PatronType.LOVEBIRDS);
  const result = scorePlayer(grid, BalconyLayout);
  assertEquals(result.perSeat[3][2], 6);
  assertEquals(result.perSeat[3][3], 6);
});

// ── Rotunda Tests ───────────────────────────────────────────────────

Deno.test("Rotunda: 16 seats in hollow ring (5×5)", () => {
  let seatCount = 0;
  for (let r = 0; r < RotundaLayout.rows; r++) {
    for (let c = 0; c < RotundaLayout.cols; c++) {
      if (RotundaLayout.seatMask && RotundaLayout.seatMask[r][c]) seatCount++;
    }
  }
  assertEquals(seatCount, 16);
});

Deno.test("Rotunda: inner ring seats labeled 'front'", () => {
  // Inner ring = seats adjacent to stage (center hole)
  const expectedFront = [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 1],
    [1, 3],
    [3, 1],
    [3, 3],
    [4, 1],
    [4, 2],
    [4, 3],
  ];
  for (const [r, c] of expectedFront) {
    assertEquals(
      hasSeatLabel(r, c, "front", RotundaLayout),
      true,
      `Seat (${r},${c}) should be front`,
    );
  }
});

Deno.test("Rotunda: outer ring seats labeled 'aisle'", () => {
  const expectedAisle = [
    [1, 0],
    [1, 4],
    [2, 0],
    [2, 4],
    [3, 0],
    [3, 4],
  ];
  for (const [r, c] of expectedAisle) {
    assertEquals(
      hasSeatLabel(r, c, "aisle", RotundaLayout),
      true,
      `Seat (${r},${c}) should be aisle`,
    );
  }
});

Deno.test("Rotunda: no seats labeled 'back'", () => {
  for (let r = 0; r < RotundaLayout.rows; r++) {
    for (let c = 0; c < RotundaLayout.cols; c++) {
      assertEquals(
        hasSeatLabel(r, c, "back", RotundaLayout),
        false,
        `Seat (${r},${c}) should not be back`,
      );
    }
  }
});

Deno.test("Rotunda: VIP in inner ring gets +3 front bonus", () => {
  const grid = emptyGrid(RotundaLayout);
  place(grid, 1, 1, PatronType.VIP); // inner ring = front
  const result = scorePlayer(grid, RotundaLayout);
  assertEquals(result.perSeat[1][1], 6); // 3 base + 3 front
});

Deno.test("Rotunda: VIP in outer ring gets base only", () => {
  const grid = emptyGrid(RotundaLayout);
  place(grid, 2, 0, PatronType.VIP); // outer ring = aisle, not front
  const result = scorePlayer(grid, RotundaLayout);
  assertEquals(result.perSeat[2][0], 3); // 3 base, no front bonus
});

Deno.test("Rotunda: Critic in outer ring scores ×3", () => {
  const grid = emptyGrid(RotundaLayout);
  place(grid, 2, 0, PatronType.CRITIC); // outer ring = aisle
  const result = scorePlayer(grid, RotundaLayout);
  assertEquals(result.perSeat[2][0], 6); // 2 × 3
});

Deno.test("Rotunda: Critic in inner ring scores base only", () => {
  const grid = emptyGrid(RotundaLayout);
  place(grid, 1, 1, PatronType.CRITIC); // inner ring = front, not aisle
  const result = scorePlayer(grid, RotundaLayout);
  assertEquals(result.perSeat[1][1], 3); // base only
});

Deno.test("Rotunda: Lovebirds never get back bonus (no back row)", () => {
  const grid = emptyGrid(RotundaLayout);
  place(grid, 0, 1, PatronType.LOVEBIRDS);
  place(grid, 0, 2, PatronType.LOVEBIRDS);
  const result = scorePlayer(grid, RotundaLayout);
  assertEquals(result.perSeat[0][1], 4); // 1 + 3 adjacent, no back bonus
  assertEquals(result.perSeat[0][2], 4);
});

Deno.test("Rotunda: Bespectacled gets +2 everywhere (no back seats)", () => {
  const grid = emptyGrid(RotundaLayout);
  // Place Bespectacled Standard in inner ring
  place(grid, 1, 1, PatronType.STANDARD, Trait.BESPECTACLED);
  // Place Bespectacled Standard in outer ring
  place(grid, 2, 0, PatronType.STANDARD, Trait.BESPECTACLED);
  const result = scorePlayer(grid, RotundaLayout);
  assertEquals(result.perSeat[1][1], 5); // 3 base + 2 bespectacled
  assertEquals(result.perSeat[2][0], 5); // 3 base + 2 bespectacled (outer ring too!)
});

Deno.test("Rotunda: Short patron facing stage gets +2 empty front bonus", () => {
  const grid = emptyGrid(RotundaLayout);
  // (1,1) has (0,1) in front which is a seat — place Short there
  // (1,1)'s "front" is row 0 col 1 which exists. If empty, Short gets bonus.
  place(grid, 1, 1, PatronType.STANDARD, Trait.SHORT);
  const result = scorePlayer(grid, RotundaLayout);
  // row-1=0, col=1 is a valid seat but empty → emptyFrontBonus = +2
  assertEquals(result.perSeat[1][1], 5); // 3 base + 2 short bonus
});

Deno.test("Rotunda: Short in row 0 has no seat in front → +2 bonus", () => {
  const grid = emptyGrid(RotundaLayout);
  place(grid, 0, 2, PatronType.STANDARD, Trait.SHORT);
  const result = scorePlayer(grid, RotundaLayout);
  // row-1 = -1 → frontBlocked → emptyFrontBonus
  assertEquals(result.perSeat[0][2], 5); // 3 base + 2 short
});

Deno.test("Rotunda: adjacency across stage hole is broken", () => {
  const grid = emptyGrid(RotundaLayout);
  // (1,1) and (1,3) are on opposite sides of the stage
  // They should NOT be orthogonal neighbors
  place(grid, 1, 1, PatronType.LOVEBIRDS);
  place(grid, 1, 3, PatronType.LOVEBIRDS);
  const result = scorePlayer(grid, RotundaLayout);
  // Not adjacent → no pair bonus (1 VP each)
  assertEquals(result.perSeat[1][1], 1);
  assertEquals(result.perSeat[1][3], 1);
});

// ════════════════════════════════════════════════════════════════
// Rebalance-specific Tests
// ════════════════════════════════════════════════════════════════

// ── Lovebirds: Horizontal pair-only ───────────────────────────────

Deno.test("Lovebirds: vertical adjacency does NOT form a pair", () => {
  const grid = emptyGrid();
  place(grid, 1, 2, PatronType.LOVEBIRDS);
  place(grid, 2, 2, PatronType.LOVEBIRDS);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][2], 1); // unpaired
  assertEquals(result.perSeat[2][2], 1); // unpaired
});

Deno.test("Lovebirds: L-L-L triple — first two pair, third unpaired", () => {
  const grid = emptyGrid();
  place(grid, 1, 1, PatronType.LOVEBIRDS);
  place(grid, 1, 2, PatronType.LOVEBIRDS);
  place(grid, 1, 3, PatronType.LOVEBIRDS);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][1], 4); // paired
  assertEquals(result.perSeat[1][2], 4); // paired
  assertEquals(result.perSeat[1][3], 1); // unpaired
});

Deno.test("Lovebirds: L-L-L-L four — two pairs", () => {
  const grid = emptyGrid();
  place(grid, 1, 0, PatronType.LOVEBIRDS);
  place(grid, 1, 1, PatronType.LOVEBIRDS);
  place(grid, 1, 2, PatronType.LOVEBIRDS);
  place(grid, 1, 3, PatronType.LOVEBIRDS);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][0], 4); // pair 1
  assertEquals(result.perSeat[1][1], 4); // pair 1
  assertEquals(result.perSeat[1][2], 4); // pair 2
  assertEquals(result.perSeat[1][3], 4); // pair 2
});

Deno.test("Lovebirds: L-L-L-L-L five — two pairs + 1 unpaired", () => {
  const grid = emptyGrid();
  place(grid, 1, 0, PatronType.LOVEBIRDS);
  place(grid, 1, 1, PatronType.LOVEBIRDS);
  place(grid, 1, 2, PatronType.LOVEBIRDS);
  place(grid, 1, 3, PatronType.LOVEBIRDS);
  place(grid, 1, 4, PatronType.LOVEBIRDS);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][0], 4); // pair 1
  assertEquals(result.perSeat[1][1], 4); // pair 1
  assertEquals(result.perSeat[1][2], 4); // pair 2
  assertEquals(result.perSeat[1][3], 4); // pair 2
  assertEquals(result.perSeat[1][4], 1); // unpaired
});

// ── Critic: Noisy nullifies aisle bonus ────────────────────────

Deno.test("Critic: Noisy neighbor nullifies aisle bonus", () => {
  const grid = emptyGrid();
  place(grid, 1, 0, PatronType.CRITIC); // aisle seat
  place(grid, 1, 1, PatronType.STANDARD, Trait.NOISY);
  const result = scorePlayer(grid, DefaultLayout);
  // Critic: 3 base + 0 (aisle bonus nullified by Noisy) - 1 (Noisy cross-type) = 2
  assertEquals(result.perSeat[1][0], 2);
});

Deno.test("Critic: non-aisle seat with Noisy neighbor scores base - 1", () => {
  const grid = emptyGrid();
  place(grid, 1, 2, PatronType.CRITIC); // non-aisle
  place(grid, 1, 3, PatronType.STANDARD, Trait.NOISY);
  const result = scorePlayer(grid, DefaultLayout);
  // Critic: 3 base - 1 (Noisy cross-type) = 2
  assertEquals(result.perSeat[1][2], 2);
});

Deno.test("Critic: aisle seat without Noisy neighbor gets full bonus", () => {
  const grid = emptyGrid();
  place(grid, 1, 0, PatronType.CRITIC); // aisle seat
  place(grid, 1, 1, PatronType.STANDARD); // non-Noisy neighbor
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][0], 6); // 3 + 3 aisle
});
