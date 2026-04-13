// @ts-check
/// <reference lib="deno.ns" />

/**
 * AI player tests — run with `deno test src/ai.test.js`
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/assert_equals.ts";
import { assert } from "https://deno.land/std@0.224.0/assert/assert.ts";
import {
    AIDifficulty,
    applyHeuristics,
    evaluateSeat,
    getEmptySeats,
    pickCardAndSeat,
    pickSeat,
    scoreAllSeats,
} from "./ai.js";
import {
    AmphitheaterLayout,
    GrandEmpressLayout,
    PatronType,
    Trait,
} from "./types.js";

/** @typedef {import('./types.js').CardData} CardData */
/** @typedef {import('./types.js').LayoutMeta} LayoutMeta */

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Create an empty grid for a layout.
 * @param {LayoutMeta} layout
 * @returns {(CardData | null)[][]}
 */
function emptyGrid(layout) {
    return Array.from({ length: layout.rows }, () => Array.from({ length: layout.cols }).fill(null));
}

/**
 * Create a minimal CardData for testing.
 * @param {string} type
 * @param {string} [trait]
 * @returns {CardData}
 */
function card(type, trait) {
    /** @type {CardData} */
    const c = { type, label: trait ? `${trait} ${type}` : type, emoji: "🃏", description: "" };
    if (trait) c.trait = trait;
    return c;
}

// ══════════════════════════════════════════════════════════════════════
// getEmptySeats
// ══════════════════════════════════════════════════════════════════════

Deno.test("getEmptySeats — all empty on default layout", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    const seats = getEmptySeats(grid, GrandEmpressLayout);
    assertEquals(seats.length, 20); // 4 rows × 5 cols
});

Deno.test("getEmptySeats — one seat occupied reduces count", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    grid[0][0] = card(PatronType.STANDARD);
    const seats = getEmptySeats(grid, GrandEmpressLayout);
    assertEquals(seats.length, 19);
});

Deno.test("getEmptySeats — respects seatMask (Amphitheater)", () => {
    const grid = emptyGrid(AmphitheaterLayout);
    const seats = getEmptySeats(grid, AmphitheaterLayout);
    // Amphitheater: 3 + 4 + 5 + 6 = 18 seats
    assertEquals(seats.length, 18);
});

// ══════════════════════════════════════════════════════════════════════
// evaluateSeat
// ══════════════════════════════════════════════════════════════════════

Deno.test("evaluateSeat — Standard always gives +3 VP", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    const delta = evaluateSeat(grid, card(PatronType.STANDARD), 2, 2, GrandEmpressLayout);
    assertEquals(delta, 3);
});

Deno.test("evaluateSeat — VIP in front row gives +8 VP", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    const delta = evaluateSeat(grid, card(PatronType.VIP), 0, 2, GrandEmpressLayout);
    assertEquals(delta, 8); // 5 base + 3 front row
});

Deno.test("evaluateSeat — Critic in aisle gives +6 VP", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    const delta = evaluateSeat(grid, card(PatronType.CRITIC), 0, 0, GrandEmpressLayout);
    assertEquals(delta, 6); // 2 × 3 aisle
});

Deno.test("evaluateSeat — Critic in non-aisle gives +2 VP", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    const delta = evaluateSeat(grid, card(PatronType.CRITIC), 0, 2, GrandEmpressLayout);
    assertEquals(delta, 2);
});

// ══════════════════════════════════════════════════════════════════════
// scoreAllSeats
// ══════════════════════════════════════════════════════════════════════

Deno.test("scoreAllSeats — returns sorted results for Critic", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    const results = scoreAllSeats(grid, card(PatronType.CRITIC), GrandEmpressLayout);
    // Best seats should be aisle seats (6 VP) at the top
    assert(results.length > 0);
    assertEquals(results[0].score, 6);
    // First result should be an aisle seat
    const isAisle = results[0].col === 0 || results[0].col === 4;
    assert(isAisle, "Best seat for Critic should be an aisle seat");
});

// ══════════════════════════════════════════════════════════════════════
// pickSeat — Easy
// ══════════════════════════════════════════════════════════════════════

Deno.test("pickSeat easy — returns a valid empty seat", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    grid[0][0] = card(PatronType.STANDARD);
    const seat = pickSeat(grid, card(PatronType.STANDARD), GrandEmpressLayout, AIDifficulty.EASY);
    assert(seat !== null, "Should return a seat");
    assert(!(seat.row === 0 && seat.col === 0), "Should not pick occupied seat");
});

Deno.test("pickSeat easy — returns null when grid is full", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    // Fill all seats
    for (let r = 0; r < GrandEmpressLayout.rows; r++) {
        for (let c = 0; c < GrandEmpressLayout.cols; c++) {
            grid[r][c] = card(PatronType.STANDARD);
        }
    }
    const seat = pickSeat(grid, card(PatronType.STANDARD), GrandEmpressLayout, AIDifficulty.EASY);
    assertEquals(seat, null);
});

// ══════════════════════════════════════════════════════════════════════
// pickSeat — Medium (greedy)
// ══════════════════════════════════════════════════════════════════════

Deno.test("pickSeat medium — Critic picks aisle seat", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    const seat = pickSeat(grid, card(PatronType.CRITIC), GrandEmpressLayout, AIDifficulty.MEDIUM);
    assert(seat !== null);
    const isAisle = seat.col === 0 || seat.col === 4;
    assert(isAisle, `Medium AI should pick aisle for Critic, got col ${seat.col}`);
});

Deno.test("pickSeat medium — VIP picks front row", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    const seat = pickSeat(grid, card(PatronType.VIP), GrandEmpressLayout, AIDifficulty.MEDIUM);
    assert(seat !== null);
    assert(seat.row <= 1, `Medium AI should pick front row for VIP, got row ${seat.row}`);
});

Deno.test("pickSeat medium — Lovebirds next to existing Lovebirds", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    grid[3][2] = card(PatronType.LOVEBIRDS); // back row center
    const seat = pickSeat(grid, card(PatronType.LOVEBIRDS), GrandEmpressLayout, AIDifficulty.MEDIUM);
    assert(seat !== null);
    // Should be adjacent to the existing Lovebirds
    const isAdjacent = (Math.abs(seat.row - 3) + Math.abs(seat.col - 2)) === 1;
    assert(isAdjacent, `Medium AI should place Lovebirds adjacent to existing one, got (${seat.row}, ${seat.col})`);
});

// ══════════════════════════════════════════════════════════════════════
// pickSeat — Hard (greedy + heuristics)
// ══════════════════════════════════════════════════════════════════════

Deno.test("pickSeat hard — Lovebirds prefers back row", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    const seat = pickSeat(grid, card(PatronType.LOVEBIRDS), GrandEmpressLayout, AIDifficulty.HARD);
    assert(seat !== null);
    // On an empty grid, Lovebirds scores 0 everywhere, but heuristics should push to back row
    assertEquals(seat.row, 3, `Hard AI should prefer back row for Lovebirds, got row ${seat.row}`);
});

Deno.test("pickSeat hard — Tall patron prefers back row", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    const seat = pickSeat(grid, card(PatronType.STANDARD, Trait.TALL), GrandEmpressLayout, AIDifficulty.HARD);
    assert(seat !== null);
    // Heuristics should push Tall to back row
    assertEquals(seat.row, 3, `Hard AI should prefer back row for Tall, got row ${seat.row}`);
});

// ══════════════════════════════════════════════════════════════════════
// applyHeuristics
// ══════════════════════════════════════════════════════════════════════

Deno.test("applyHeuristics — Critic gets bonus for aisle seat", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    const aisleBonus = applyHeuristics(grid, card(PatronType.CRITIC), 0, 0, GrandEmpressLayout);
    const nonAisleBonus = applyHeuristics(grid, card(PatronType.CRITIC), 0, 2, GrandEmpressLayout);
    assert(aisleBonus > nonAisleBonus, "Critic should get higher heuristic in aisle seat");
});

Deno.test("applyHeuristics — Tall patron gets bonus in back row", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    const backBonus = applyHeuristics(grid, card(PatronType.STANDARD, Trait.TALL), 3, 2, GrandEmpressLayout);
    const frontBonus = applyHeuristics(grid, card(PatronType.STANDARD, Trait.TALL), 0, 2, GrandEmpressLayout);
    assert(backBonus > frontBonus, "Tall patron should prefer back row");
});

Deno.test("applyHeuristics — Noisy prefers fewer neighbors", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    grid[1][2] = card(PatronType.STANDARD);
    grid[0][1] = card(PatronType.STANDARD);
    // Corner (0,0) has fewer potential occupied neighbors than center
    const cornerBonus = applyHeuristics(grid, card(PatronType.STANDARD, Trait.NOISY), 0, 0, GrandEmpressLayout);
    const centerBonus = applyHeuristics(grid, card(PatronType.STANDARD, Trait.NOISY), 0, 2, GrandEmpressLayout);
    assert(cornerBonus >= centerBonus, "Noisy should prefer seats with fewer occupied neighbors");
});

// ══════════════════════════════════════════════════════════════════════
// pickCardAndSeat (2-player discard logic)
// ══════════════════════════════════════════════════════════════════════

Deno.test("pickCardAndSeat — picks better card to play", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    const vip = card(PatronType.VIP);
    const kid = card(PatronType.KID);
    const result = pickCardAndSeat(grid, [vip, kid], GrandEmpressLayout, AIDifficulty.MEDIUM);
    assert(result !== null);
    assertEquals(result.play.card, vip, "Should play VIP over Kid");
    assertEquals(result.discard, kid, "Should discard Kid");
});

Deno.test("pickCardAndSeat — returns null on empty hand", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    const result = pickCardAndSeat(grid, [], GrandEmpressLayout, AIDifficulty.MEDIUM);
    assertEquals(result, null);
});

Deno.test("pickCardAndSeat — returns null on full grid", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    for (let r = 0; r < GrandEmpressLayout.rows; r++) {
        for (let c = 0; c < GrandEmpressLayout.cols; c++) {
            grid[r][c] = card(PatronType.STANDARD);
        }
    }
    const result = pickCardAndSeat(grid, [card(PatronType.VIP)], GrandEmpressLayout, AIDifficulty.MEDIUM);
    assertEquals(result, null);
});

Deno.test("pickCardAndSeat — works with single card in hand", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    const vip = card(PatronType.VIP);
    const result = pickCardAndSeat(grid, [vip], GrandEmpressLayout, AIDifficulty.MEDIUM);
    assert(result !== null);
    assertEquals(result.play.card, vip);
});
