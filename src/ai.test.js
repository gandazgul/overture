/// <reference lib="deno.ns" />

/**
 * AI player tests — run with `deno test src/ai.test.js`
 */

import { assert, assertEquals } from "@std/assert";
import {
    AIDifficulty,
    evaluateSeat,
    getEmptySeats,
    getEpsilon,
    pickCardAndSeat,
    pickDrawAction,
    pickSeat,
    scoreAllSeats,
} from "./ai.js";
import { GrandEmpressLayout, PatronType } from "./types.js";

/** @typedef {import('./types.js').CardData} CardData */
/** @typedef {import('./types.js').LayoutMeta} LayoutMeta */

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * @param {LayoutMeta} layout
 * @returns {(CardData | null)[][]}
 */
function emptyGrid(layout) {
    return Array.from({ length: layout.rows }, () => Array.from({ length: layout.cols }).fill(null));
}

/**
 * @param {string} type
 * @param {string} [trait]
 * @returns {CardData}
 */
function card(type, trait) {
    /** @type {CardData} */
    const c = { type, label: trait ? `${trait} ${type}` : type };
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

// ══════════════════════════════════════════════════════════════════════
// evaluateSeat
// ══════════════════════════════════════════════════════════════════════

Deno.test("evaluateSeat — Standard always gives +3 VP", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    const delta = evaluateSeat(grid, card(PatronType.STANDARD), 2, 2, GrandEmpressLayout);
    assertEquals(delta, 3);
});

Deno.test("evaluateSeat — VIP in front row gives +5 VP", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    const delta = evaluateSeat(grid, card(PatronType.VIP), 0, 2, GrandEmpressLayout);
    assertEquals(delta, 5);
});

// ══════════════════════════════════════════════════════════════════════
// scoreAllSeats (Lookahead Tactician Logic)
// ══════════════════════════════════════════════════════════════════════

Deno.test("scoreAllSeats — returns sorted results naturally finding game rules", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    const results = scoreAllSeats(grid, card(PatronType.CRITIC), GrandEmpressLayout);

    assert(results.length > 0);
    assertEquals(results[0].score, 5);
    const isAisle = results[0].col === 0 || results[0].col === 4;
    assert(isAisle, "Highest scored seat for Critic should naturally be an aisle seat");
});

Deno.test("scoreAllSeats — Lookahead values hand setups (Kid + Teacher)", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    const kid = card(PatronType.KID);
    const teacher = card(PatronType.TEACHER);

    // Score Kid alone
    const noLookahead = scoreAllSeats(grid, kid, GrandEmpressLayout);
    const bestNoLookahead = noLookahead[0].score;

    // Score Kid with Teacher in hand
    const withLookahead = scoreAllSeats(grid, kid, GrandEmpressLayout, [teacher]);
    const bestWithLookahead = withLookahead[0].score;

    assert(
        bestWithLookahead > bestNoLookahead,
        "Lookahead should value the setup higher due to future capping potential",
    );
});

// ══════════════════════════════════════════════════════════════════════
// Epsilon Config Tests
// ══════════════════════════════════════════════════════════════════════

Deno.test("getEpsilon — validates difficulty mappings", () => {
    assertEquals(getEpsilon(AIDifficulty.EASY), 0.75);
    assertEquals(getEpsilon(AIDifficulty.HARD), 0.0);
});

Deno.test("pickSeat config override — Force random placement via epsilon", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    // Even if it's HARD, config.epsilon = 1.0 forces it to pick a random seat
    // instead of the mathematically optimal one.
    let pickedRandomly = false;

    // Testing randomness is tricky, but over 50 iterations, a 100% random placement
    // will almost certainly place a Critic outside of the optimal aisle seats.
    for (let i = 0; i < 50; i++) {
        const seat = pickSeat(grid, card(PatronType.CRITIC), GrandEmpressLayout, AIDifficulty.HARD, { epsilon: 1.0 });
        if (seat && seat.col !== 0 && seat.col !== 4) {
            pickedRandomly = true;
            break;
        }
    }
    assert(pickedRandomly, "Epsilon override should force suboptimal random exploration");
});

// ══════════════════════════════════════════════════════════════════════
// pickCardAndSeat
// ══════════════════════════════════════════════════════════════════════

Deno.test("pickCardAndSeat — tactician picks better card to play", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    const vip = card(PatronType.VIP);
    const kid = card(PatronType.KID);
    const std = card(PatronType.STANDARD);
    const result = pickCardAndSeat(grid, [vip, kid, std], 2, GrandEmpressLayout, AIDifficulty.HARD);

    assert(result !== null);
    assertEquals(result.play.cardData, vip, "Should play VIP over Kid/Standard on an empty board");
    // a tactician evaluates which card to keep for maximum future value.
    // In an empty board, Kid has higher potential (cappedValue) than Standard.
    // Therefore, the tactician should KEEP the Kid and DISCARD the Standard patron.
    assertEquals(result.discard?.cardData, std, "Should discard Standard patron");
});

Deno.test("pickCardAndSeat — returns null on empty hand", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    const result = pickCardAndSeat(grid, [], 2, GrandEmpressLayout, AIDifficulty.HARD);
    assertEquals(result, null);
});

// ══════════════════════════════════════════════════════════════════════
// pickDrawAction (lobby frozen-slot edge cases)
// ══════════════════════════════════════════════════════════════════════

Deno.test("pickDrawAction — deck empty allows drawing former frozen slot 0", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    const lobby = [card(PatronType.VIP)];

    const hard = pickDrawAction(lobby, 0, AIDifficulty.HARD, grid, GrandEmpressLayout);
    assertEquals(hard, { source: "lobby", index: 0 });
});

Deno.test("pickDrawAction — slot 0 stays unavailable while deck has cards", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    const lobby = [card(PatronType.VIP), card(PatronType.STANDARD)];

    const hard = pickDrawAction(lobby, 1, AIDifficulty.HARD, grid, GrandEmpressLayout);
    assertEquals(hard?.index === 0, false);
});
