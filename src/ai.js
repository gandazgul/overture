/**
 * ========================================================================
 * AI PLAYER - Pure decision logic, no Phaser dependency
 * ========================================================================
 * Provides seat-selection strategies using Epsilon-Greedy Lookahead.
 * The AI ranks plays using the scoring engine and one-card lookahead.
 * Heuristic potential estimates are not a guarantee of optimal play.
 *
 * Difficulty is determined by the Epsilon (ε) exploration rate:
 *   - easy:   ε = 0.75 (Mostly random placements)
 *   - medium: ε = 0.20 (Greedy with occasional mistakes)
 *   - hard:   ε = 0.00 (Deterministic heuristic search over every seat)
 * ========================================================================
 */

import { scorePlayer, scoreSeatDelta, seatExists } from "./scoring.js";
import { hasSeatLabel, PatronDeckSpec, PatronType, Trait } from "./types.js";
import { random, randomInt } from "./utils.js";

/** @typedef {import('./types.js').CardData} CardData */
/** @typedef {import('./types.js').LayoutMeta} LayoutMeta */
/**
 * @typedef {Object} AIConfig
 * @property {number} [epsilon]
 * @property {number} [playerCount] Required to enable the 2P blind-first draw policy.
 * @property {boolean} [blindFirst] Defaults to true for 2P Hard; false restores the pre-promotion draw policy.
 * @property {number} [turnsRemaining] Placements left, including this turn.
 * @property {number} [potentialScale] Experimental combo bonus multiplier; live default 1.
 * @property {number} [futureWeight] Experimental next-placement weight; live default 0.8.
 */
/** @typedef {{row: number, col: number, score: number, bestFutureCard?: CardData}} SeatScore */

/**
 * AI difficulty levels.
 * @readonly
 * @enum {string}
 */
export const AIDifficulty = /** @type {const} */ ({
    EASY: "easy",
    MEDIUM: "medium",
    HARD: "hard",
});
Object.freeze(AIDifficulty);

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Return all empty seat positions on the grid.
 *
 * @param {(CardData | null)[][]} grid
 * @param {LayoutMeta} layout
 * @returns {{row: number, col: number}[]}
 */
export function getEmptySeats(grid, layout) {
    /** @type {{row: number, col: number}[]} */
    const seats = [];
    for (let r = 0; r < layout.rows; r++) {
        for (let c = 0; c < layout.cols; c++) {
            if (seatExists(r, c, layout) && !grid[r][c]) {
                seats.push({ row: r, col: c });
            }
        }
    }
    return seats;
}

/**
 * Maps the human-readable difficulty to an Epsilon exploration rate (0.0 to 1.0).
 *
 * @param {string} difficulty
 * @returns {number}
 */
export function getEpsilon(difficulty) {
    switch (difficulty) {
        case AIDifficulty.EASY:
            return 0.75;
        case AIDifficulty.MEDIUM:
            return 0.20;
        case AIDifficulty.HARD:
            return 0.0;
        default:
            return 0.0;
    }
}

// ── Tactician Evaluation ──────────────────────────────────────────────

/**
 * Evaluate placing a card at a specific seat safely without cloning the grid.
 *
 * @param {(CardData | null)[][]} grid - Current grid state
 * @param {CardData} card - Card to place
 * @param {number} row
 * @param {number} col
 * @param {LayoutMeta} layout
 * @returns {number} VP delta (new total - current total)
 */
export function evaluateSeat(grid, card, row, col, layout) {
    const currentScore = scorePlayer(grid, layout).total;
    grid[row][col] = card; // Mutate temporarily
    const newScore = scorePlayer(grid, layout).total;
    grid[row][col] = null; // Revert immediately
    return newScore - currentScore;
}

/**
 * Fixed heuristic potential beyond immediate scoring, not a calibrated EV.
 * @param {CardData} cardData
 * @param {string} difficulty
 * @returns {number}
 */
function getCardPotential(cardData, difficulty) {
    if (!cardData || difficulty !== AIDifficulty.HARD) return 0;
    switch (cardData.type) {
        case PatronType.LOVEBIRDS:
            return 2.5;
        case PatronType.KID:
            return 2.5;
        case PatronType.TEACHER:
            return 1.5;
        case PatronType.FRIENDS:
            return 1.0;
        default:
            return 0;
    }
}

/**
 * @param {CardData} card
 * @param {number} row
 * @param {number} col
 * @param {LayoutMeta} layout
 * @returns {boolean}
 */
function seatMatchesCardPreference(card, row, col, layout) {
    return (card.type === PatronType.VIP && hasSeatLabel(row, col, "front", layout)) ||
        (card.type === PatronType.CRITIC && hasSeatLabel(row, col, "aisle", layout)) ||
        (card.type === PatronType.LOVEBIRDS && hasSeatLabel(row, col, "back", layout)) ||
        (card.trait === Trait.SHORT && hasSeatLabel(row, col, "front", layout));
}

/**
 * Small tie-breaker for cards whose strategic seats matter before their full
 * combo is complete. Keep this intentionally below 1 VP so real scoring wins.
 *
 * @param {CardData} card
 * @param {number} row
 * @param {number} col
 * @param {LayoutMeta} layout
 * @param {string} difficulty
 * @returns {number}
 */
function getSeatPreferenceBonus(card, row, col, layout, difficulty) {
    if (difficulty === AIDifficulty.EASY) return 0;
    let bonus = 0;
    if (card.type === PatronType.LOVEBIRDS && hasSeatLabel(row, col, "back", layout)) {
        bonus += 0.25;
    }
    if (card.trait === Trait.SHORT && hasSeatLabel(row, col, "front", layout)) {
        bonus += 0.1;
    }
    return bonus;
}

/**
 * Cache only within a decision: the underlying board must remain unchanged.
 * Two placements have the same final score in either order, so one pair scan
 * supplies both directions of lookahead, including duplicate card types.
 *
 * @param {(CardData | null)[][]} grid
 * @param {LayoutMeta} layout
 * @param {string} difficulty
 * @param {AIConfig} config
 * @returns {(card: CardData, hand?: CardData[]) => SeatScore[]}
 */
function createSeatSearch(grid, layout, difficulty, config) {
    const empty = getEmptySeats(grid, layout);
    const potentialScale = config.potentialScale ?? 1;
    const futureWeight = config.futureWeight ?? 0.8;
    const terminal = (config.turnsRemaining ?? Infinity) <= 1 || empty.length <= 1;
    const useDelta = !layout.houseRule;
    const currentScore = useDelta ? 0 : scorePlayer(grid, layout).total;
    /** @type {Map<string, number[]>} */
    const immediateCache = new Map();
    /** @type {Map<string, number[]>} */
    const pairCache = new Map();
    const key = (/** @type {CardData} */ card) => `${card.type}|${card.trait ?? ""}`;

    const immediate = (/** @type {CardData} */ card) => {
        const cached = immediateCache.get(key(card));
        if (cached) return cached;
        const values = empty.map(({ row, col }) => {
            if (useDelta) return scoreSeatDelta(grid, layout, row, col, card);
            grid[row][col] = card;
            try {
                return scorePlayer(grid, layout).total - currentScore;
            } finally {
                grid[row][col] = null;
            }
        });
        immediateCache.set(key(card), values);
        return values;
    };

    const future = (/** @type {CardData} */ card, /** @type {CardData} */ next) => {
        const pairKey = `${key(card)}>${key(next)}`;
        const cached = pairCache.get(pairKey);
        if (cached) return cached;
        const first = immediate(card);
        const second = immediate(next);
        const forward = empty.map(() => -Infinity);
        const reverse = empty.map(() => -Infinity);
        for (let i = 0; i < empty.length; i++) {
            const seat = empty[i];
            grid[seat.row][seat.col] = card;
            try {
                for (let j = 0; j < empty.length; j++) {
                    if (i === j) continue;
                    const other = empty[j];
                    let joint;
                    if (useDelta) {
                        joint = first[i] + scoreSeatDelta(grid, layout, other.row, other.col, next);
                    } else {
                        grid[other.row][other.col] = next;
                        try {
                            joint = scorePlayer(grid, layout).total - currentScore;
                        } finally {
                            grid[other.row][other.col] = null;
                        }
                    }
                    forward[i] = Math.max(forward[i], joint - first[i]);
                    reverse[j] = Math.max(reverse[j], joint - second[j]);
                }
            } finally {
                grid[seat.row][seat.col] = null;
            }
        }
        pairCache.set(pairKey, forward);
        pairCache.set(`${key(next)}>${key(card)}`, reverse);
        return forward;
    };

    return (card, hand = []) => {
        const values = immediate(card);
        const ordered = empty.map((seat, i) => ({ ...seat, i })).sort((a, b) => values[b.i] - values[a.i]);
        const futures = terminal ? [] : hand.filter((next) => next !== card).map((next) => ({
            card: next,
            values: future(card, next),
            potential: (config.turnsRemaining ?? Infinity) <= 2
                ? 0
                : potentialScale * getCardPotential(next, difficulty),
        }));
        const results = ordered.map((seat, rank) => {
            let best = 0;
            /** @type {CardData | undefined} */
            let bestFutureCard;
            if (
                difficulty === AIDifficulty.HARD || rank < 4 ||
                seatMatchesCardPreference(card, seat.row, seat.col, layout)
            ) {
                for (const next of futures) {
                    const value = next.values[seat.i] + next.potential;
                    if (value > best) {
                        best = value;
                        bestFutureCard = next.card;
                    }
                }
            }
            return {
                row: seat.row,
                col: seat.col,
                score: values[seat.i] +
                    (terminal ? 0 : potentialScale * getCardPotential(card, difficulty) + best * futureWeight +
                        getSeatPreferenceBonus(card, seat.row, seat.col, layout, difficulty)),
                bestFutureCard,
            };
        });
        return results.sort((a, b) => b.score - a.score);
    };
}

/**
 * Rank placements with one-card lookahead. Hard examines every first seat;
 * easier levels retain selective lookahead. Scores are heuristic, not exact EV.
 * @param {(CardData | null)[][]} grid
 * @param {CardData} card
 * @param {LayoutMeta} layout
 * @param {CardData[]} lookaheadCards
 * @param {string} difficulty
 * @param {AIConfig} config
 * @returns {SeatScore[]}
 */
export function scoreAllSeats(grid, card, layout, lookaheadCards = [], difficulty = AIDifficulty.MEDIUM, config = {}) {
    return createSeatSearch(grid, layout, difficulty, config)(card, lookaheadCards);
}

// ── Drawing Logic ──────────────────────────────────────────────────────────

/**
 * Count cards already revealed (in any grid + lobby + own hand).
 * Used to estimate the remaining deck pool without peeking at opponent hands or discards.
 *
 * @param {(CardData | null)[][]} grid
 * @param {(CardData | null)[][][]} opponentGrids
 * @param {CardData[]} lobby
 * @param {CardData[]} hand
 * @returns {Map<string, number>}
 */
function countVisibleCards(grid, opponentGrids, lobby, hand) {
    /** @type {Map<string, number>} */
    const seen = new Map();
    const add = (/** @type {CardData | null} */ c) => {
        if (!c) return;
        const key = `${c.type}|${c.trait || ""}`;
        seen.set(key, (seen.get(key) || 0) + 1);
    };
    for (const row of grid) for (const c of row) add(c);
    for (const og of opponentGrids) for (const row of og) for (const c of row) add(c);
    for (const c of lobby) add(c);
    for (const c of hand) add(c);
    return seen;
}

/**
 * Singleton synthetic CardData per (type, trait) — used only as a query
 * stand-in for "what could the deck yield." These objects never enter a
 * hand or grid, so identity collisions don't matter here.
 * @type {{ key: string, card: CardData, max: number }[]}
 */
const REMAINING_TEMPLATES = (() => {
    /** @type {{ key: string, card: CardData, max: number }[]} */
    const entries = [];
    for (const [type, trait, count] of PatronDeckSpec) {
        /** @type {CardData} */
        const card = { type, label: trait ? `${trait} ${type}` : type };
        if (trait) card.trait = trait;
        entries.push({ key: `${type}|${trait || ""}`, card, max: count });
    }
    return entries;
})();

/**
 * Build the pool of cards that could still come from the deck.
 * Overestimates by including opponents' hands + discards (hidden), but those are
 * unobservable so this is the best public-info estimate.
 *
 * @param {Map<string, number>} seen
 * @returns {Array<{card: CardData, count: number}>}
 */
function buildRemainingPool(seen) {
    /** @type {Array<{card: CardData, count: number}>} */
    const out = [];
    for (const t of REMAINING_TEMPLATES) {
        const remaining = t.max - (seen.get(t.key) || 0);
        if (remaining > 0) out.push({ card: t.card, count: remaining });
    }
    return out;
}

/**
 * Best achievable play score given a hand on a grid, with one-turn lookahead.
 * Iterates each card as the "played" card and uses the others as synergy lookahead.
 *
 * @param {CardData[]} hand
 * @param {(card: CardData, hand?: CardData[]) => SeatScore[]} search
 * @returns {number}
 */
function bestPlayWithHand(hand, search) {
    let best = -Infinity;
    for (let i = 0; i < hand.length; i++) {
        // scoreAllSeats skips hand[i] in its lookahead by identity, so passing
        // the full hand avoids allocating a "rest of hand" array per iteration.
        const s = search(hand[i], hand);
        if (s.length > 0 && s[0].score > best) best = s[0].score;
    }
    return best === -Infinity ? 0 : best;
}

/**
 * HARD AI draw decision. Combines:
 *  1. Real deckEV from remaining-deck composition (not a magic number).
 *  2. Lookahead via scoreAllSeats with combined hand (this turn + next placement).
 *  3. Opportunity cost: subtract opponent's best play of any cards we leave behind.
 *
 * @param {CardData[]} lobby - Full lobby (slot 0 may be frozen)
 * @param {CardData[]} availableLobby - The slice the AI is allowed to pick from
 * @param {number} lobbyStartIndex
 * @param {boolean} hasLobby
 * @param {boolean} hasDeck
 * @param {(CardData | null)[][]} grid
 * @param {LayoutMeta} layout
 * @param {CardData[]} currentHand
 * @param {(CardData | null)[][][]} opponentGrids
 * @param {AIConfig} config
 * @returns {{source: 'lobby' | 'deck', index?: number} | null}
 */
function pickDrawActionHard(
    lobby,
    availableLobby,
    lobbyStartIndex,
    hasLobby,
    hasDeck,
    grid,
    layout,
    currentHand,
    opponentGrids,
    config,
) {
    const diff = AIDifficulty.HARD;
    const search = createSeatSearch(grid, layout, diff, config);

    // 1. Deck EV from remaining composition (with hand-synergy lookahead)
    let deckEV = 0;
    if (hasDeck) {
        const seen = countVisibleCards(grid, opponentGrids, lobby, currentHand);
        const remaining = buildRemainingPool(seen);
        let sum = 0;
        let weight = 0;
        for (const { card, count } of remaining) {
            const combined = [card, ...currentHand];
            sum += bestPlayWithHand(combined, search) * count;
            weight += count;
        }
        deckEV = weight > 0 ? sum / weight : 0;
    }

    // 2. Opportunity cost: opponent's MARGINAL gain from getting cards we leave.
    //    Marginal = max(0, opp_best_lobby - opp_deckEV). If opp would prefer deck anyway,
    //    they don't actually pick the lobby card and our action doesn't cost us anything.
    //
    //    Both per-opp `oppDeckEV` AND per-(opp, lobbyIdx) score are INVARIANT across our
    //    choice of action — they don't depend on which lobby card we pick. So we precompute
    //    them once, then derive `marginalOppCost(skipIdx)` as a pool-exclusion max in O(L).
    const oppCount = opponentGrids.length;
    /** @type {number[]} */
    const oppDeckEVs = new Array(oppCount);
    /** @type {number[][]} */
    const lobbyScoresByOpp = new Array(oppCount);

    for (let o = 0; o < oppCount; o++) {
        const og = opponentGrids[o];
        const opponentSearch = createSeatSearch(og, layout, diff, config);

        // Opp deck EV on their grid (no hand context — public info only)
        const seen = countVisibleCards(og, [grid], lobby, []);
        const remaining = buildRemainingPool(seen);
        let sum = 0;
        let weight = 0;
        for (const { card, count } of remaining) {
            const s = opponentSearch(card);
            sum += (s.length > 0 ? s[0].score : 0) * count;
            weight += count;
        }
        oppDeckEVs[o] = weight > 0 ? sum / weight : 0;

        // Per-lobby-card best score on this opp's grid
        /** @type {number[]} */
        const scores = new Array(lobby.length);
        for (let l = 0; l < lobby.length; l++) {
            const s = opponentSearch(lobby[l]);
            scores[l] = s.length > 0 ? s[0].score : 0;
        }
        lobbyScoresByOpp[o] = scores;
    }

    /**
     * Marginal opponent cost when we leave behind `lobby[start..]` minus
     * (optionally) one excluded index. Pure arithmetic — no scoring.
     *
     * @param {number} start - First lobby index in the pool (inclusive)
     * @param {number} skipIdx - Lobby index to exclude (or -1 for none)
     * @returns {number}
     */
    const marginalOppCost = (start, skipIdx) => {
        if (oppCount === 0 || start >= lobby.length) return 0;
        // If the only candidate seat would also be excluded, pool is empty.
        if (skipIdx >= start && lobby.length - start - 1 <= 0) return 0;

        let total = 0;
        for (let o = 0; o < oppCount; o++) {
            const scores = lobbyScoresByOpp[o];
            let oppLobbyBest = 0;
            for (let l = start; l < lobby.length; l++) {
                if (l === skipIdx) continue;
                if (scores[l] > oppLobbyBest) oppLobbyBest = scores[l];
            }
            total += Math.max(0, oppLobbyBest - oppDeckEVs[o]);
        }
        return total / oppCount;
    };

    // 3. Compare options on (myGain - marginal opp gain)
    const OPP_COST_WEIGHT = 1.0;
    const oppCostOnDeck = OPP_COST_WEIGHT * marginalOppCost(lobbyStartIndex, -1);

    let bestNet = hasDeck ? deckEV - oppCostOnDeck : -Infinity;
    let bestSource = /** @type {'lobby' | 'deck'} */ ("deck");
    let bestIdx = -1;

    if (hasLobby) {
        for (let i = 0; i < availableLobby.length; i++) {
            const L = availableLobby[i];
            const combined = [L, ...currentHand];
            const myGain = bestPlayWithHand(combined, search);

            const myAbsoluteIdx = lobbyStartIndex + i;
            // Pool = entire lobby except the card we picked (opp could still take the
            // frozen slot 0 if it had value — keep `start = 0`, not `lobbyStartIndex`).
            const oppCost = OPP_COST_WEIGHT * marginalOppCost(0, myAbsoluteIdx);

            const net = myGain - oppCost;
            if (net > bestNet) {
                bestNet = net;
                bestSource = "lobby";
                bestIdx = myAbsoluteIdx;
            }
        }
    }

    if (bestSource === "lobby") return { source: "lobby", index: bestIdx };
    if (hasDeck) return { source: "deck" };
    return null;
}

/**
 * Decide whether to draw from the lobby or the deck.
 *
 * @param {CardData[]} lobby
 * @param {number} deckSize
 * @param {string} difficulty
 * @param {(CardData | null)[][]} grid
 * @param {LayoutMeta} layout
 * @param {CardData[]} currentHand - Used to evaluate synergy with the lobby card
 * @param {AIConfig} config
 * @param {(CardData | null)[][][]} opponentGrids - Other players' grids (public info)
 * @returns {{source: 'lobby' | 'deck', index?: number} | null} Action to take
 */
export function pickDrawAction(
    lobby,
    deckSize,
    difficulty,
    grid,
    layout,
    currentHand = [],
    config = {},
    opponentGrids = [],
) {
    const lobbyStartIndex = deckSize > 0 ? 1 : 0;
    const availableLobby = lobby.slice(lobbyStartIndex);
    const hasLobby = availableLobby.length > 0;
    const hasDeck = deckSize > 0;
    const epsilon = config.epsilon ?? getEpsilon(difficulty);

    if (!hasLobby && !hasDeck) return null;
    if (!hasLobby) return { source: "deck" };

    // Explore (Random)
    if (random() < epsilon) {
        const sources = [];
        if (hasLobby) sources.push("lobby");
        if (hasDeck) sources.push("deck");
        const choice = sources[randomInt(sources.length - 1)];

        if (choice === "lobby") {
            return {
                source: "lobby",
                index: lobbyStartIndex + randomInt(availableLobby.length - 1),
            };
        }
        return { source: "deck" };
    }

    // HARD AI: deck-composition-aware EV + marginal opponent opportunity cost
    if (difficulty === AIDifficulty.HARD) {
        // Preserve the Lobby choice until a blind card is known. With one deck
        // card left, exhaustion changes draw legality, so use normal evaluation.
        if (config.playerCount === 2 && config.blindFirst !== false && deckSize >= 2 && currentHand.length === 1) {
            return { source: "deck" };
        }
        return pickDrawActionHard(
            lobby,
            availableLobby,
            lobbyStartIndex,
            hasLobby,
            hasDeck,
            grid,
            layout,
            currentHand,
            opponentGrids,
            config,
        );
    }

    // MEDIUM (and EASY when exploit fires): hand-aware threshold with magic +2.5 deckEV
    if (hasLobby) {
        const search = createSeatSearch(grid, layout, difficulty, config);
        let bestScore = -Infinity;
        let bestIdx = -1;

        // Baseline: best move achievable using ONLY the current hand.
        // The expected EV of an unknown deck card is ~2.5 VP on top of this baseline.
        let deckBaseScore = 0;
        if (currentHand.length > 0) {
            for (let i = 0; i < currentHand.length; i++) {
                const s = search(currentHand[i], currentHand);
                if (s.length > 0 && s[0].score > deckBaseScore) {
                    deckBaseScore = s[0].score;
                }
            }
        }

        const deckThreshold = deckBaseScore + 2.5;

        for (let i = 0; i < availableLobby.length; i++) {
            const card = availableLobby[i];
            const combinedHand = [...currentHand, card];

            // Best move available if we add this lobby card to our hand
            let maxCombinedScore = 0;
            for (let j = 0; j < combinedHand.length; j++) {
                const s = search(combinedHand[j], combinedHand);
                if (s.length > 0 && s[0].score > maxCombinedScore) {
                    maxCombinedScore = s[0].score;
                }
            }

            if (maxCombinedScore > bestScore) {
                bestScore = maxCombinedScore;
                bestIdx = lobbyStartIndex + i;
            }
        }

        if (bestScore > deckThreshold || !hasDeck) {
            return { source: "lobby", index: bestIdx };
        }
    }

    return { source: "deck" };
}

/**
 * Pick the best seat for a single card (Used primarily for EndGame/1-card scenarios).
 *
 * @param {(CardData | null)[][]} grid
 * @param {CardData} card
 * @param {LayoutMeta} layout
 * @param {string} difficulty
 * @param {AIConfig} config
 * @returns {{row: number, col: number} | null}
 */
export function pickSeat(grid, card, layout, difficulty, config = {}) {
    const empty = getEmptySeats(grid, layout);
    if (empty.length === 0) return null;

    const epsilon = config.epsilon ?? getEpsilon(difficulty);

    if (random() < epsilon) {
        return empty[randomInt(empty.length - 1)];
    }

    const scored = scoreAllSeats(grid, card, layout, [], difficulty, config);
    return scored.length > 0 ? { row: scored[0].row, col: scored[0].col } : null;
}

/**
 * Pick which card to play (and where) and which to discard, evaluating hand synergies.
 *
 * @param {(CardData | null)[][]} grid
 * @param {CardData[]} hand
 * @param {number} playerCount
 * @param {LayoutMeta} layout
 * @param {string} difficulty
 * @param {AIConfig} config
 * @returns {{play: {cardData: CardData, row: number, col: number}, discard?: {cardData: CardData}} | null}
 */
export function pickCardAndSeat(grid, hand, playerCount, layout, difficulty, config = {}) {
    if (hand.length === 0) return null;

    const empty = getEmptySeats(grid, layout);
    if (empty.length === 0) return null;

    const epsilon = config.epsilon ?? getEpsilon(difficulty);

    // End of the game, only 1 card left
    if (hand.length === 1) {
        const seat = pickSeat(grid, hand[0], layout, difficulty, config);
        if (!seat) return null;
        return { play: { cardData: hand[0], ...seat } };
    }

    // Explore (Random)
    if (random() < epsilon) {
        const randomCardIdx = randomInt(hand.length - 1);
        const randomSeatIdx = randomInt(empty.length - 1);
        const playCard = hand[randomCardIdx];
        const seat = empty[randomSeatIdx];

        /** @type {{play: {cardData: CardData, row: number, col: number}, discard?: {cardData: CardData}}} */
        const result = { play: { cardData: playCard, row: seat.row, col: seat.col } };

        if (playerCount === 2 && hand.length > 2) {
            let discardIdx = randomInt(hand.length - 1);
            while (discardIdx === randomCardIdx) {
                discardIdx = randomInt(hand.length - 1);
            }
            result.discard = { cardData: hand[discardIdx] };
        }
        return result;
    }

    // Exploit (Greedy Tactician with Hand Lookahead)
    /** @type {{cardData: CardData, row: number, col: number, score: number, discard?: CardData}[]} */
    const candidates = [];

    // Evaluate pairs of (Play, Keep) if we have to discard
    const mustDiscardCount = Math.max(0, hand.length - 2);
    const search = createSeatSearch(grid, layout, difficulty, config);

    if (playerCount === 2 && mustDiscardCount > 0) {
        for (let playIdx = 0; playIdx < hand.length; playIdx++) {
            const playCard = hand[playIdx];
            const scoredSeats = search(playCard, hand);

            if (scoredSeats.length > 0) {
                const bestSeat = scoredSeats[0];

                // To decide what to discard, we identify the "Keep" card.
                // The keepCard is the one with the highest synergistic potential (bestFutureCard).
                // Fallback: first hand card other than playCard (preserving previous semantics
                // of `remainingHand[0]` from `hand.filter((_, idx) => idx !== playIdx)`).
                const fallbackKeep = hand[playIdx === 0 ? 1 : 0];
                const keepCard = bestSeat.bestFutureCard || fallbackKeep;

                // Discard the card that is not the playCard and not the keepCard.
                // In a 3-card hand (VIP, Kid, Std) where VIP is played and Std is kept, Kid is discarded.
                const discardIdx = hand.findIndex((c) => c !== playCard && c !== keepCard);
                const discardCard = discardIdx >= 0 ? hand[discardIdx] : undefined;

                candidates.push({
                    cardData: playCard,
                    row: bestSeat.row,
                    col: bestSeat.col,
                    score: bestSeat.score,
                    discard: discardCard,
                });
            }
        }
    } else {
        // Normal lookahead without discarding
        for (let i = 0; i < hand.length; i++) {
            const card = hand[i];
            const scoredSeats = search(card, hand);

            if (scoredSeats.length > 0) {
                candidates.push({
                    cardData: card,
                    row: scoredSeats[0].row,
                    col: scoredSeats[0].col,
                    score: scoredSeats[0].score,
                });
            }
        }
    }

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];

    /** @type {{play: {cardData: CardData, row: number, col: number}, discard?: {cardData: CardData}}} */
    const result = {
        play: { cardData: best.cardData, row: best.row, col: best.col },
    };

    if (best.discard) {
        result.discard = { cardData: best.discard };
    } else if (playerCount === 2 && mustDiscardCount > 0) {
        // Fallback just in case
        const worst = candidates.at(-1);
        if (worst && worst.cardData !== best.cardData) {
            result.discard = { cardData: worst.cardData };
        }
    }

    return result;
}
