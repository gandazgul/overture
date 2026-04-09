// @ts-check
/// <reference lib="deno.ns" />

/**
 * Scoring engine tests — run with `deno test src/scoring.test.js`
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/assert_equals.ts";
import { scorePlayer, getOrthogonalNeighbors, isAisleSeat, findHorizontalKidGroups } from "./scoring.js";
import { PatronType, DefaultLayout, createDeck, PatronInfo } from "./types.js";

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
 * Create a CardData for a given patron type.
 * @param {string} type
 * @returns {CardData}
 */
function card(type) {
  return { type, label: type, emoji: "", description: "" };
}

/**
 * Place a card on a grid and return the grid (for chaining).
 * @param {(CardData | null)[][]} grid
 * @param {number} row
 * @param {number} col
 * @param {string} type
 * @returns {(CardData | null)[][]}
 */
function place(grid, row, col, type) {
  grid[row][col] = card(type);
  return grid;
}

// ── Helper function tests ───────────────────────────────────────────

Deno.test("getOrthogonalNeighbors - center seat has 4 neighbors", () => {
  const n = getOrthogonalNeighbors(2, 2, 4, 5);
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

// ── Standard Patron ─────────────────────────────────────────────────

Deno.test("Standard patron scores 3 VP anywhere", () => {
  const grid = emptyGrid();
  place(grid, 0, 0, PatronType.STANDARD);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[0][0], 3);
  assertEquals(result.total, 3);
});

// ── Bespectacled ────────────────────────────────────────────────────

Deno.test("Bespectacled in front row scores 4 VP (2 base + 2 bonus)", () => {
  const grid = emptyGrid();
  place(grid, 0, 2, PatronType.BESPECTACLED);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[0][2], 4);
});

Deno.test("Bespectacled in back row scores 2 VP (base only)", () => {
  const grid = emptyGrid();
  place(grid, 3, 2, PatronType.BESPECTACLED);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[3][2], 2);
});

// ── VIP ─────────────────────────────────────────────────────────────

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

Deno.test("VIP adjacent to Noisy gets -3 penalty", () => {
  const grid = emptyGrid();
  place(grid, 1, 2, PatronType.VIP);
  place(grid, 1, 3, PatronType.NOISY);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][2], 5); // 8 - 3
});

Deno.test("VIP adjacent to two Kids gets -6 penalty", () => {
  const grid = emptyGrid();
  place(grid, 0, 2, PatronType.VIP);
  place(grid, 0, 1, PatronType.KID);
  place(grid, 0, 3, PatronType.KID);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[0][2], 2); // 8 - 6
});

// ── Critic ──────────────────────────────────────────────────────────

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

// ── Kid / Teacher Capping ───────────────────────────────────────────

Deno.test("findHorizontalKidGroups - single uncapped Kid", () => {
  const row = [null, card(PatronType.KID), null, null, null];
  const groups = findHorizontalKidGroups(row, 5);
  assertEquals(groups.length, 1);
  assertEquals(groups[0].capped, false);
  assertEquals(groups[0].cols, [1]);
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
  assertEquals(groups.length, 1);
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
  // Teacher - Kid - Kid - Teacher
  place(grid, 1, 0, PatronType.TEACHER);
  place(grid, 1, 1, PatronType.KID);
  place(grid, 1, 2, PatronType.KID);
  place(grid, 1, 3, PatronType.TEACHER);
  const result = scorePlayer(grid, DefaultLayout);
  // Kids: 2 VP each = 4
  assertEquals(result.perSeat[1][1], 2);
  assertEquals(result.perSeat[1][2], 2);
  // Teacher at col 0: 1 base + 1 (adjacent capped Kid at col 1) = 2
  assertEquals(result.perSeat[1][0], 2);
  // Teacher at col 3: 1 base + 1 (adjacent capped Kid at col 2) = 2
  assertEquals(result.perSeat[1][3], 2);
  // Total: 2 + 2 + 2 + 2 = 8
  assertEquals(result.total, 8);
});

// ── Tall Person ─────────────────────────────────────────────────────

Deno.test("Tall person scores 1 VP, patron behind gets -2", () => {
  const grid = emptyGrid();
  place(grid, 1, 2, PatronType.TALL);
  place(grid, 2, 2, PatronType.STANDARD);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][2], 1); // Tall base
  assertEquals(result.perSeat[2][2], 1); // Standard 3 - 2 behind penalty
});

Deno.test("Tall person with no one behind - only scores base", () => {
  const grid = emptyGrid();
  place(grid, 3, 2, PatronType.TALL); // back row, no one behind
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[3][2], 1);
  assertEquals(result.total, 1);
});

// ── Short Person ────────────────────────────────────────────────────

Deno.test("Short person with empty front scores 4 VP (2 base + 2 bonus)", () => {
  const grid = emptyGrid();
  place(grid, 2, 2, PatronType.SHORT);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[2][2], 4);
});

Deno.test("Short person in front row (row 0) scores 4 VP (no one can be in front)", () => {
  const grid = emptyGrid();
  place(grid, 0, 2, PatronType.SHORT);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[0][2], 4);
});

Deno.test("Short person behind Tall scores -1 VP (2 base - 3 penalty)", () => {
  const grid = emptyGrid();
  place(grid, 1, 2, PatronType.TALL);
  place(grid, 2, 2, PatronType.SHORT);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[2][2], -1); // 2 - 3
});

Deno.test("Short person behind non-Tall patron scores 2 VP (base only)", () => {
  const grid = emptyGrid();
  place(grid, 1, 2, PatronType.STANDARD);
  place(grid, 2, 2, PatronType.SHORT);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[2][2], 2); // base, no bonus, no penalty
});

// ── Noisy Patron ────────────────────────────────────────────────────

Deno.test("Noisy patron scores 0 VP, adjacent Standard gets -2 (net 1 VP)", () => {
  const grid = emptyGrid();
  place(grid, 1, 2, PatronType.NOISY);
  place(grid, 1, 3, PatronType.STANDARD);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][2], 0); // Noisy base
  assertEquals(result.perSeat[1][3], 1); // Standard 3 - 2
});

Deno.test("Noisy patron does NOT affect non-Standard neighbors", () => {
  const grid = emptyGrid();
  place(grid, 1, 2, PatronType.NOISY);
  place(grid, 1, 3, PatronType.BESPECTACLED);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][3], 4); // Bespectacled 2 base + 2 row bonus (row 1 qualifies), NOT penalized by Noisy
});

Deno.test("Standard adjacent to two Noisy patrons gets -4", () => {
  const grid = emptyGrid();
  place(grid, 1, 1, PatronType.NOISY);
  place(grid, 1, 2, PatronType.STANDARD);
  place(grid, 1, 3, PatronType.NOISY);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][2], -1); // 3 - 4
});

// ── Lovebirds ───────────────────────────────────────────────────────

Deno.test("Lovebirds alone scores 0 VP", () => {
  const grid = emptyGrid();
  place(grid, 2, 2, PatronType.LOVEBIRDS);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[2][2], 0);
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

// ── Empty grid ──────────────────────────────────────────────────────

Deno.test("Empty grid scores 0 VP total", () => {
  const grid = emptyGrid();
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.total, 0);
});

// ── Cross-type: Tall behind penalty on non-Short patron ─────────────

Deno.test("Tall behind penalty does NOT double-apply to Short (uses tallInFrontPenalty instead)", () => {
  const grid = emptyGrid();
  place(grid, 1, 2, PatronType.TALL);
  place(grid, 2, 2, PatronType.SHORT);
  const result = scorePlayer(grid, DefaultLayout);
  // Short: 2 base - 3 tallInFrontPenalty = -1 (NOT also -2 from behindPenalty)
  assertEquals(result.perSeat[2][2], -1);
});

// ── Bespectacled row boundary ───────────────────────────────────────

Deno.test("Bespectacled in row 2 (last bonus row) scores 4 VP", () => {
  const grid = emptyGrid();
  place(grid, 2, 2, PatronType.BESPECTACLED);
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[2][2], 4);
});

// ── Unknown patron type ─────────────────────────────────────────────

Deno.test("Unknown patron type scores 0 VP", () => {
  const grid = emptyGrid();
  grid[1][1] = { type: "UNKNOWN", label: "UNKNOWN", emoji: "", description: "" };
  const result = scorePlayer(grid, DefaultLayout);
  assertEquals(result.perSeat[1][1], 0);
});

// ── Tall behindPenalty applied to non-Short patron ──────────────────

Deno.test("Non-Short patron behind Tall gets behindPenalty", () => {
  const grid = emptyGrid();
  place(grid, 0, 2, PatronType.TALL);      // front
  place(grid, 1, 2, PatronType.STANDARD);  // behind Tall
  const result = scorePlayer(grid, DefaultLayout);
  // Standard: 3 base + (-2) behindPenalty = 1
  assertEquals(result.perSeat[1][2], 1);
});

// ── Short with non-Tall patron in front (no bonus, no penalty) ──────

Deno.test("Short with non-Tall, non-empty front gets base only", () => {
  const grid = emptyGrid();
  place(grid, 0, 2, PatronType.STANDARD);  // non-Tall in front
  place(grid, 1, 2, PatronType.SHORT);
  const result = scorePlayer(grid, DefaultLayout);
  // Short: 2 base, no bonus, no penalty
  assertEquals(result.perSeat[1][2], 2);
});

// ── createDeck tests ────────────────────────────────────────────────

Deno.test("createDeck returns 56 cards", () => {
  const deck = createDeck();
  assertEquals(deck.length, 56);
});

Deno.test("createDeck includes correct count per patron type", () => {
  const deck = createDeck();
  /** @type {Record<string, number>} */
  const counts = {};
  for (const c of deck) {
    counts[c.type] = (counts[c.type] ?? 0) + 1;
  }
  assertEquals(counts[PatronType.STANDARD], 8);
  assertEquals(counts[PatronType.BESPECTACLED], 8);
  assertEquals(counts[PatronType.VIP], 4);
  assertEquals(counts[PatronType.LOVEBIRDS], 8);
  assertEquals(counts[PatronType.KID], 8);
  assertEquals(counts[PatronType.TEACHER], 5);
  assertEquals(counts[PatronType.TALL], 4);
  assertEquals(counts[PatronType.SHORT], 3);
  assertEquals(counts[PatronType.CRITIC], 4);
  assertEquals(counts[PatronType.NOISY], 4);
});

Deno.test("createDeck cards have emoji and description from PatronInfo", () => {
  const deck = createDeck();
  for (const c of deck) {
    const info = PatronInfo[c.type];
    assertEquals(c.emoji, info.emoji);
    assertEquals(c.description, info.description);
  }
});
