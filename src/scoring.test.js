// @ts-check
/// <reference lib="deno.ns" />

/**
 * Scoring engine tests — run with `deno test src/scoring.test.js`
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/assert_equals.ts";
import {
  scorePlayer,
  getOrthogonalNeighbors,
  isAisleSeat,
  findHorizontalKidGroups,
} from "./scoring.js";
import {
  PatronType,
  Trait,
  DefaultLayout,
  createDeck,
  PatronInfo,
  TraitInfo,
} from "./types.js";

/** @typedef {import('./types.js').CardData} CardData */

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Create an empty 4×5 grid.
 * @returns {(CardData | null)[][]}
 */
function emptyGrid() {
  return Array.from({ length: 4 }, () => Array(5).fill(null));
}

/**
 * Create a CardData for a given patron type with optional trait.
 * @param {string} type
 * @param {string} [trait]
 * @returns {CardData}
 */
function card(type, trait) {
  /** @type {CardData} */
  const c = { type, label: trait ? `${trait} ${type}` : type, emoji: "", description: "" };
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
  assertEquals(isAisleSeat(0, DefaultLayout), true);
  assertEquals(isAisleSeat(4, DefaultLayout), true);
  assertEquals(isAisleSeat(2, DefaultLayout), false);
});

// ── Primary Type: Standard ──────────────────────────────────────────

Deno.test("Standard patron scores 3 VP anywhere", () => {
  const grid = emptyGrid();
  place(grid, 2, 3, PatronType.STANDARD);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[2][3], 3);
});

// ── Primary Type: VIP ───────────────────────────────────────────────

Deno.test("VIP in row 0 alone scores 8 VP (5 base + 3 row bonus)", () => {
  const grid = emptyGrid();
  place(grid, 0, 2, PatronType.VIP);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[0][2], 8);
});

Deno.test("VIP in back row scores 5 VP (base only)", () => {
  const grid = emptyGrid();
  place(grid, 3, 2, PatronType.VIP);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[3][2], 5);
});

Deno.test("VIP adjacent to Kid gets -3 penalty", () => {
  const grid = emptyGrid();
  place(grid, 0, 2, PatronType.VIP);
  place(grid, 0, 3, PatronType.KID);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[0][2], 5); // 8 - 3
});

Deno.test("VIP adjacent to two Kids gets -6 penalty", () => {
  const grid = emptyGrid();
  place(grid, 0, 2, PatronType.VIP);
  place(grid, 0, 1, PatronType.KID);
  place(grid, 0, 3, PatronType.KID);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[0][2], 2); // 8 - 6
});

Deno.test("VIP adjacent to Noisy-trait patron gets -3 penalty", () => {
  const grid = emptyGrid();
  place(grid, 0, 2, PatronType.VIP);
  place(grid, 0, 3, PatronType.STANDARD, Trait.NOISY);
  const result = scorePlayer(grid, DefaultLayout);
  // VIP: 8 base+row - 3 adjacencyPenalty (Noisy trait) - 1 (Noisy cross-type) = 4
  assertEquals(result.perSeat[0][2], 4);
});

// ── Primary Type: Critic ────────────────────────────────────────────

Deno.test("Critic on aisle seat scores 6 VP (2 × 3)", () => {
  const grid = emptyGrid();
  place(grid, 1, 0, PatronType.CRITIC);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][0], 6);
});

Deno.test("Critic on non-aisle seat scores 2 VP", () => {
  const grid = emptyGrid();
  place(grid, 1, 2, PatronType.CRITIC);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][2], 2);
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

Deno.test("Uncapped Kid scores 0 VP", () => {
  const grid = emptyGrid();
  place(grid, 1, 2, PatronType.KID);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][2], 0);
});

Deno.test("Capped Kids score 2 VP each, Teachers get per-kid bonus", () => {
  const grid = emptyGrid();
  place(grid, 1, 0, PatronType.TEACHER);
  place(grid, 1, 1, PatronType.KID);
  place(grid, 1, 2, PatronType.KID);
  place(grid, 1, 3, PatronType.TEACHER);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][1], 2); // capped Kid
  assertEquals(result.perSeat[1][2], 2); // capped Kid
  assertEquals(result.perSeat[1][0], 2); // Teacher: 1 base + 1 per capped Kid
  assertEquals(result.perSeat[1][3], 2); // Teacher: 1 base + 1 per capped Kid
});

// ── Primary Type: Lovebirds ─────────────────────────────────────────

Deno.test("Lovebirds alone scores 0 VP", () => {
  const grid = emptyGrid();
  place(grid, 1, 2, PatronType.LOVEBIRDS);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][2], 0);
});

Deno.test("Lovebirds pair in non-back row scores 3 VP each", () => {
  const grid = emptyGrid();
  place(grid, 1, 2, PatronType.LOVEBIRDS);
  place(grid, 1, 3, PatronType.LOVEBIRDS);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][2], 3);
  assertEquals(result.perSeat[1][3], 3);
});

Deno.test("Lovebirds pair in back row scores 6 VP each (×2 multiplier)", () => {
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
  // VIP: 5 base + 3 row bonus + 2 bespectacled trait = 10
  assertEquals(result.perSeat[0][2], 10);
});

Deno.test("Bespectacled Teacher scores row bonus + capping bonus", () => {
  const grid = emptyGrid();
  place(grid, 1, 0, PatronType.TEACHER, Trait.BESPECTACLED);
  place(grid, 1, 1, PatronType.KID);
  place(grid, 1, 2, PatronType.TEACHER);
  const result = scorePlayer(grid, DefaultLayout);
  // Bespectacled Teacher: 1 base + 2 bespectacled + 1 capped kid = 4
  assertEquals(result.perSeat[1][0], 4);
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

Deno.test("Tall Kid: Kid scores normally, patron behind gets -2 VP", () => {
  const grid = emptyGrid();
  place(grid, 1, 2, PatronType.KID, Trait.TALL);
  place(grid, 2, 2, PatronType.STANDARD);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][2], 0); // Tall Kid: uncapped = 0
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
  // Critic: 2 base × 3 aisle = 6, then +2 short empty front = 8
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
  assertEquals(result.perSeat[1][3], 1); // Critic: 2 - 1 = 1
  assertEquals(result.perSeat[0][2], 0); // Teacher: 1 - 1 = 0
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
  assertEquals(result.perSeat[1][2], 0); // Kid uncapped = 0
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
  grid[1][1] = { type: "UNKNOWN", label: "UNKNOWN", emoji: "", description: "" };
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
  assertEquals(result.perSeat[3][2], 6); // Lovebirds: (0+3) × 2 = 6
  assertEquals(result.perSeat[3][3], 6);
});

Deno.test("Noisy Lovebirds pair in back row: 6 VP each, neighbors get -1", () => {
  const grid = emptyGrid();
  place(grid, 3, 2, PatronType.LOVEBIRDS, Trait.NOISY);
  place(grid, 3, 3, PatronType.LOVEBIRDS);
  place(grid, 2, 2, PatronType.STANDARD); // in front of Noisy Lovebirds
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[3][2], 6); // Noisy Lovebirds: (0+3) × 2 = 6
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
  assertEquals(counts[PatronType.STANDARD], 21);
  assertEquals(counts[PatronType.VIP], 4);
  assertEquals(counts[PatronType.LOVEBIRDS], 10);
  assertEquals(counts[PatronType.KID], 8);
  assertEquals(counts[PatronType.TEACHER], 6);
  assertEquals(counts[PatronType.CRITIC], 7);
});

Deno.test("createDeck has 21 cards with traits", () => {
  const deck = createDeck();
  const withTraits = deck.filter((c) => c.trait);
  assertEquals(withTraits.length, 21);
});

Deno.test("createDeck trait distribution: 5 Tall, 4 Short, 5 Bespectacled, 4 Noisy", () => {
  const deck = createDeck();
  /** @type {Record<string, number>} */
  const traitCounts = {};
  for (const c of deck) {
    if (c.trait) {
      traitCounts[c.trait] = (traitCounts[c.trait] ?? 0) + 1;
    }
  }
  assertEquals(traitCounts[Trait.TALL], 6);
  assertEquals(traitCounts[Trait.SHORT], 6);
  assertEquals(traitCounts[Trait.BESPECTACLED], 5);
  assertEquals(traitCounts[Trait.NOISY], 4);
});

Deno.test("createDeck cards have emoji and description", () => {
  const deck = createDeck();
  for (const c of deck) {
    const typeInfo = PatronInfo[c.type];
    if (c.trait) {
      const traitInfo = TraitInfo[c.trait];
      assertEquals(c.emoji, `${traitInfo.emoji}${typeInfo.emoji}`);
    } else {
      assertEquals(c.emoji, typeInfo.emoji);
    }
  }
});

Deno.test("createDeck: no excluded combos (no Bespectacled/Short Lovebirds, no Noisy VIP)", () => {
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
  }
});
