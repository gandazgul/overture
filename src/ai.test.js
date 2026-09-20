/// <reference lib="deno.ns" />

/**
 * AI player tests — run with `deno test src/ai.test.js`
 */

import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
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
import { GrandEmpressLayout, hasSeatLabel, Layouts, PatronType, Trait } from "./types.js";
import { scorePlayer } from "./scoring.js";
import { setGlobalSeed } from "./utils.js";

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

Deno.test("scoreAllSeats — Lovebirds prefer back-row setup seats", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    const lovebirds = card(PatronType.LOVEBIRDS);

    const results = scoreAllSeats(grid, lovebirds, GrandEmpressLayout, [], AIDifficulty.HARD);

    assert(
        hasSeatLabel(results[0].row, results[0].col, "back", GrandEmpressLayout),
        "Unpaired Lovebirds should prefer back-row setup seats",
    );
});

Deno.test("scoreAllSeats — Lovebirds lookahead considers back-row pair seats outside top immediate grid order", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    const firstLovebirds = card(PatronType.LOVEBIRDS);
    const secondLovebirds = card(PatronType.LOVEBIRDS);

    const results = scoreAllSeats(
        grid,
        firstLovebirds,
        GrandEmpressLayout,
        [firstLovebirds, secondLovebirds],
        AIDifficulty.HARD,
    );

    assert(
        hasSeatLabel(results[0].row, results[0].col, "back", GrandEmpressLayout),
        "Lovebirds with another Lovebirds in hand should evaluate back-row pair setup seats",
    );
});

Deno.test("scoreAllSeats — Short trait keeps front seats in the preferred category", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    const shortPatron = card(PatronType.STANDARD, Trait.SHORT);
    const futurePatron = card(PatronType.STANDARD);

    const results = scoreAllSeats(
        grid,
        shortPatron,
        GrandEmpressLayout,
        [shortPatron, futurePatron],
        AIDifficulty.HARD,
    );

    assert(
        hasSeatLabel(results[0].row, results[0].col, "front", GrandEmpressLayout),
        "Short patrons should prefer front seats when available",
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

Deno.test("2P Hard draws blind first, then evaluates the second draw normally", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    const lobby = [card(PatronType.KID), card(PatronType.CRITIC, Trait.SHORT)];
    const hand = [card(PatronType.KID)];
    const config = { playerCount: 2, turnsRemaining: 1 };
    const before = structuredClone({ grid, lobby, hand });
    assertEquals(pickDrawAction(lobby, 2, AIDifficulty.HARD, grid, GrandEmpressLayout, hand, config), {
        source: "deck",
    });
    const unpromoted = pickDrawAction(lobby, 2, AIDifficulty.HARD, grid, GrandEmpressLayout, hand, {
        ...config,
        blindFirst: false,
    });
    assertEquals(unpromoted, { source: "lobby", index: 1 });
    const secondHand = [...hand, card(PatronType.STANDARD)];
    assertEquals(
        pickDrawAction(lobby, 2, AIDifficulty.HARD, grid, GrandEmpressLayout, secondHand, config),
        pickDrawAction(lobby, 2, AIDifficulty.HARD, grid, GrandEmpressLayout, secondHand, {
            ...config,
            blindFirst: false,
        }),
    );
    assertEquals({ grid, lobby, hand }, before);
});

Deno.test("Blind-first preserves deck exhaustion, 3P/4P, missing context, and easier difficulties", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    const lobby = [card(PatronType.KID), card(PatronType.CRITIC, Trait.SHORT)];
    const hand = [card(PatronType.KID)];
    for (const deckSize of [0, 1]) {
        const action = pickDrawAction(lobby, deckSize, AIDifficulty.HARD, grid, GrandEmpressLayout, hand, {
            playerCount: 2,
            turnsRemaining: 1,
        });
        assertEquals(action, { source: "lobby", index: 1 });
    }
    for (const playerCount of [undefined, 3, 4]) {
        assertEquals(
            pickDrawAction(lobby, 2, AIDifficulty.HARD, grid, GrandEmpressLayout, hand, {
                playerCount,
                turnsRemaining: 1,
            }),
            { source: "lobby", index: 1 },
        );
    }
    for (const difficulty of [AIDifficulty.EASY, AIDifficulty.MEDIUM]) {
        for (const epsilon of [0, 1]) {
            const config = { playerCount: 2, epsilon, turnsRemaining: 1 };
            setGlobalSeed(99);
            const action = pickDrawAction(lobby, 2, difficulty, grid, GrandEmpressLayout, hand, config);
            setGlobalSeed(99);
            assertEquals(
                action,
                pickDrawAction(lobby, 2, difficulty, grid, GrandEmpressLayout, hand, {
                    ...config,
                    blindFirst: false,
                }),
            );
        }
    }
    setGlobalSeed(99);
    const randomHard = pickDrawAction(lobby, 2, AIDifficulty.HARD, grid, GrandEmpressLayout, hand, {
        playerCount: 2,
        epsilon: 1,
    });
    setGlobalSeed(99);
    assertEquals(
        randomHard,
        pickDrawAction(lobby, 2, AIDifficulty.HARD, grid, GrandEmpressLayout, hand, {
            playerCount: 2,
            epsilon: 1,
            blindFirst: false,
        }),
    );
    assertEquals(pickDrawAction([], 0, AIDifficulty.HARD, grid, GrandEmpressLayout, hand, { playerCount: 2 }), null);
});

Deno.test("Hard final turn maximizes actual VP, not future combo potential", () => {
    for (const layout of Object.values(Layouts)) {
        const grid = emptyGrid(layout);
        for (const seat of getEmptySeats(grid, layout).slice(0, 11)) {
            grid[seat.row][seat.col] = card(PatronType.STANDARD);
        }
        const before = structuredClone(grid);
        const hand = [card(PatronType.KID), card(PatronType.STANDARD), card(PatronType.STANDARD)];
        const result = pickCardAndSeat(grid, hand, 2, layout, AIDifficulty.HARD, { turnsRemaining: 1 });
        assert(result);
        assertEquals(result.play.cardData.type, PatronType.STANDARD, layout.id);
        const bestActual = Math.max(
            ...hand.flatMap((current) =>
                getEmptySeats(grid, layout).map((seat) => evaluateSeat(grid, current, seat.row, seat.col, layout))
            ),
        );
        assertEquals(evaluateSeat(grid, result.play.cardData, result.play.row, result.play.col, layout), bestActual);
        assertEquals(grid, before);
        assert(hand.includes(result.play.cardData));
        assert(result.discard && hand.includes(result.discard.cardData));
        assert(result.discard.cardData !== result.play.cardData);
    }
});

Deno.test("Hard final draw uses terminal VP even when the lobby still has cards", () => {
    const result = pickDrawAction(
        [card(PatronType.KID), card(PatronType.STANDARD)],
        0,
        AIDifficulty.HARD,
        emptyGrid(GrandEmpressLayout),
        GrandEmpressLayout,
        [],
        { turnsRemaining: 1 },
    );
    assertEquals(result, { source: "lobby", index: 1 });
});

Deno.test("Experimental potential settings preserve terminal VP and accept zero", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    const kid = card(PatronType.KID);
    const baseline = scoreAllSeats(grid, kid, GrandEmpressLayout, [], AIDifficulty.HARD);
    const noPotential = scoreAllSeats(grid, kid, GrandEmpressLayout, [], AIDifficulty.HARD, { potentialScale: 0 });
    assertAlmostEquals(baseline[0].score - noPotential[0].score, 2.5);
    const terminal = scoreAllSeats(grid, kid, GrandEmpressLayout, [card(PatronType.TEACHER)], AIDifficulty.HARD, {
        turnsRemaining: 1,
        potentialScale: 2,
        futureWeight: 2,
    });
    for (const seat of terminal) {
        assertEquals(seat.score, evaluateSeat(grid, kid, seat.row, seat.col, GrandEmpressLayout));
    }
    assertEquals(grid, emptyGrid(GrandEmpressLayout));
});

Deno.test("Hard sees back-row Teacher/Kid setups beyond the old top-12 cutoff", () => {
    const grid = emptyGrid(GrandEmpressLayout);
    grid[3][2] = card(PatronType.TEACHER);
    const kid = card(PatronType.KID);
    const teacher = card(PatronType.TEACHER);
    const results = scoreAllSeats(grid, kid, GrandEmpressLayout, [kid, teacher], AIDifficulty.HARD);
    assertAlmostEquals(results[0].score, 11.1);
    assertAlmostEquals(results.find((s) => s.row === 3 && s.col === 1)?.score ?? 0, 11.1);
    assertEquals(results[0].bestFutureCard, teacher);
});

Deno.test("Exploration keeps the last card when a 2P hand only has two cards", () => {
    setGlobalSeed(7);
    const result = pickCardAndSeat(
        emptyGrid(GrandEmpressLayout),
        [card(PatronType.STANDARD), card(PatronType.KID)],
        2,
        GrandEmpressLayout,
        AIDifficulty.HARD,
        { epsilon: 1 },
    );
    assert(result);
    assertEquals(result.discard, undefined);
});

/**
 * Deliberately slow reference: no delta scoring, memoization, or pruning.
 * @param {(CardData | null)[][]} grid
 * @param {CardData[]} hand
 * @param {LayoutMeta} layout
 */
function exhaustiveHandScores(grid, hand, layout) {
    const empty = getEmptySeats(grid, layout);
    const baseline = scorePlayer(grid, layout).total;
    /** @type {Record<string, number>} */
    const potentials = { Lovebirds: 2.5, Kid: 2.5, Teacher: 1.5, Friends: 1 };
    const results = [];
    for (const current of hand) {
        for (const seat of empty) {
            grid[seat.row][seat.col] = current;
            const placedScore = scorePlayer(grid, layout).total;
            let future = 0;
            for (const next of hand) {
                if (next === current) continue;
                for (const other of empty) {
                    if (other.row === seat.row && other.col === seat.col) continue;
                    grid[other.row][other.col] = next;
                    future = Math.max(
                        future,
                        scorePlayer(grid, layout).total - placedScore + (potentials[next.type] ?? 0),
                    );
                    grid[other.row][other.col] = null;
                }
            }
            grid[seat.row][seat.col] = null;
            const preference =
                (current.type === PatronType.LOVEBIRDS && hasSeatLabel(seat.row, seat.col, "back", layout) ? 0.25 : 0) +
                (current.trait === Trait.SHORT && hasSeatLabel(seat.row, seat.col, "front", layout) ? 0.1 : 0);
            results.push({
                card: current,
                ...seat,
                score: placedScore - baseline + (potentials[current.type] ?? 0) + 0.8 * future + preference,
            });
        }
    }
    return results;
}

Deno.test("Cached Hard search matches exhaustive scoring across every layout and duplicate cards", () => {
    for (const layout of Object.values(Layouts)) {
        const grid = emptyGrid(layout);
        const seats = getEmptySeats(grid, layout);
        const placed = [
            card(PatronType.TEACHER),
            card(PatronType.KID),
            card(PatronType.LOVEBIRDS),
            card(PatronType.STANDARD, Trait.NOISY),
            card(PatronType.FRIENDS, Trait.TALL),
        ];
        placed.forEach((current, i) => {
            const seat = seats[i * 2];
            grid[seat.row][seat.col] = current;
        });
        const before = structuredClone(grid);
        const hands = [
            [card(PatronType.KID), card(PatronType.TEACHER), card(PatronType.CRITIC, Trait.SHORT)],
            [card(PatronType.LOVEBIRDS), card(PatronType.LOVEBIRDS), card(PatronType.STANDARD, Trait.NOISY)],
        ];
        for (const hand of hands) {
            const reference = exhaustiveHandScores(grid, hand, layout);
            for (const current of hand) {
                const scores = scoreAllSeats(grid, current, layout, hand, AIDifficulty.HARD);
                for (const scored of scores) {
                    const expected = reference.find((r) =>
                        r.card === current && r.row === scored.row && r.col === scored.col
                    );
                    assert(expected);
                    assertAlmostEquals(scored.score, expected.score, 1e-9, layout.id);
                }
            }
            const choice = pickCardAndSeat(grid, hand, 2, layout, AIDifficulty.HARD);
            assert(choice);
            const chosen = reference.find((r) =>
                r.card === choice.play.cardData && r.row === choice.play.row && r.col === choice.play.col
            );
            assert(chosen);
            assertAlmostEquals(chosen.score, Math.max(...reference.map((r) => r.score)), 1e-9, layout.id);
            assertEquals(grid, before);
        }
    }
});
