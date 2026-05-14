/**
 * ========================================================================
 * AI PLAYER - Pure decision logic, no Phaser dependency
 * ========================================================================
 * Provides seat-selection strategies using Epsilon-Greedy Lookahead.
 * The AI "discovers" optimal plays by temporarily placing cards on the grid
 * and evaluating the actual scoring engine, looking one turn ahead.
 *
 * Difficulty is determined by the Epsilon (ε) exploration rate:
 *   - easy:   ε = 0.75 (Mostly random placements)
 *   - medium: ε = 0.20 (Greedy with occasional mistakes)
 *   - hard:   ε = 0.00 (Pure tactician, always maximizes Lookahead VP)
 * ========================================================================
 */

import { scorePlayer, seatExists } from "./scoring.js";
import { PatronDeckSpec } from "./types.js";
import { random, randomInt } from "./utils.js";

/** @typedef {import('./types.js').CardData} CardData */
/** @typedef {import('./types.js').LayoutMeta} LayoutMeta */

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
 * Expected Value (EV) potential of a card beyond its immediate placement score.
 * Represents the likelihood of completing its combo in future turns.
 * @param {CardData} cardData
 * @param {string} difficulty
 * @returns {number}
 */
function getCardPotential(cardData, difficulty) {
    if (!cardData || difficulty !== AIDifficulty.HARD) return 0;
    switch (cardData.type) {
        case "Lovebirds":
            return 2.5;
        case "Kid":
            return 2.5;
        case "Teacher":
            return 1.5;
        case "Friends":
            return 1.0;
        default:
            return 0;
    }
}

/**
 * Score every empty seat for a card placement, looking one turn ahead to measure
 * synergistic potential with the remaining hand. Uses Top-K pruning for performance.
 *
 * @param {(CardData | null)[][]} grid
 * @param {CardData} card
 * @param {LayoutMeta} layout
 * @param {CardData[]} lookaheadCards - Other cards currently in hand/lobby to evaluate setup potential
 * @param {string} [difficulty=AIDifficulty.MEDIUM] - Used to dynamically scale the pruning factor
 * @returns {{row: number, col: number, score: number, bestFutureCard?: CardData}[]} Sorted descending by score
 */
export function scoreAllSeats(grid, card, layout, lookaheadCards = [], difficulty = AIDifficulty.MEDIUM) {
    const empty = getEmptySeats(grid, layout);
    const currentScore = scorePlayer(grid, layout).total;

    // 1. Calculate IMMEDIATE scores for all empty seats
    const baseResults = [];
    for (const { row, col } of empty) {
        grid[row][col] = card;
        const newScore = scorePlayer(grid, layout).total;
        grid[row][col] = null;
        baseResults.push({
            row,
            col,
            immediateDelta: newScore - currentScore,
            /** @type {CardData | undefined} */
            bestFutureCard: undefined,
        });
    }

    // Sort by immediate score descending
    baseResults.sort((a, b) => b.immediateDelta - a.immediateDelta);

    // 2. Lookahead Pruning: Only calculate deep future synergies for the Top K immediate moves
    const TOP_K = difficulty === AIDifficulty.HARD ? 12 : 4;
    const results = [];

    for (let i = 0; i < baseResults.length; i++) {
        const candidate = baseResults[i];
        let lookaheadDelta = 0;

        // Only do the heavy math if we have lookahead cards AND it's a top candidate
        if (lookaheadCards.length > 0 && i < TOP_K) {
            grid[candidate.row][candidate.col] = card; // Apply base placement
            const remainingEmpty = empty.filter((e) => e.row !== candidate.row || e.col !== candidate.col);
            let bestFuture = 0;
            let bestFutureCard = undefined;

            for (const futureCard of lookaheadCards) {
                for (const fSeat of remainingEmpty) {
                    grid[fSeat.row][fSeat.col] = futureCard; // Apply future placement
                    const futureScore = scorePlayer(grid, layout).total;
                    grid[fSeat.row][fSeat.col] = null; // Revert future

                    const fDelta = futureScore - (currentScore + candidate.immediateDelta);
                    const heuristicDelta = fDelta + getCardPotential(futureCard, difficulty);

                    if (heuristicDelta > bestFuture) {
                        bestFuture = heuristicDelta;
                        bestFutureCard = futureCard;
                    }
                }
            }
            grid[candidate.row][candidate.col] = null; // Revert base placement

            // Weight future potential at 80% to prioritize immediate guaranteed points
            lookaheadDelta = bestFuture * 0.8;
            candidate.bestFutureCard = bestFutureCard;
        }

        results.push({
            row: candidate.row,
            col: candidate.col,
            score: candidate.immediateDelta + getCardPotential(card, difficulty) + lookaheadDelta,
            bestFutureCard: candidate.bestFutureCard,
        });
    }

    // Final sort incorporating lookahead bonuses
    results.sort((a, b) => b.score - a.score);
    return results;
}

// ── Draft Phase ──────────────────────────────────────────────────────

/**
 * Pick the best card from a draft pool using scoreAllSeats evaluation.
 * Evaluates each card against an empty grid and picks the highest scorer.
 * Uses epsilon-based exploration for non-hard difficulties.
 *
 * @param {CardData[]} pool - The draft pool (must be non-empty)
 * @param {string} difficulty - AIDifficulty value
 * @returns {CardData | null} The selected card (removed from pool)
 */
export function pickBestCardFromPool(pool, difficulty) {
    if (pool.length === 0) return null;
    if (pool.length === 1) return pool[0];

    const epsilon = getEpsilon(difficulty);

    // Explore (Random)
    if (random() < epsilon) {
        const idx = randomInt(pool.length - 1);
        return pool.splice(idx, 1)[0];
    }

    // Exploit (Greedy — score each card on empty grid)
    let bestScore = -Infinity;
    let bestCard = pool[0];

    // Stub layout + grid matching 1×1 dimensions (no adjacency bonuses possible)
    const stubLayout = /** @type {LayoutMeta} */ ({ rows: 1, cols: 1, seatMask: [[true]] });
    const stubGrid = [[null]];

    for (const card of pool) {
        const seats = scoreAllSeats(stubGrid, card, stubLayout, [], difficulty);
        const score = seats.length > 0 ? seats[0].score : 0;
        if (score > bestScore) {
            bestScore = score;
            bestCard = card;
        }
    }

    const idx = pool.indexOf(bestCard);
    if (idx >= 0) pool.splice(idx, 1);
    return bestCard;
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
    for (const [type, trait, count] of PatronDeckSpec) {
        const key = `${type}|${trait || ""}`;
        const used = seen.get(key) || 0;
        const remaining = count - used;
        if (remaining > 0) {
            /** @type {CardData} */
            const card = { type, label: trait ? `${trait} ${type}` : type };
            if (trait) card.trait = trait;
            out.push({ card, count: remaining });
        }
    }
    return out;
}

/**
 * Best achievable play score given a hand on a grid, with one-turn lookahead.
 * Iterates each card as the "played" card and uses the others as synergy lookahead.
 *
 * @param {(CardData | null)[][]} grid
 * @param {CardData[]} hand
 * @param {LayoutMeta} layout
 * @param {string} difficulty
 * @returns {number}
 */
function bestPlayWithHand(grid, hand, layout, difficulty) {
    let best = 0;
    for (let i = 0; i < hand.length; i++) {
        const others = hand.filter((_, idx) => idx !== i);
        const s = scoreAllSeats(grid, hand[i], layout, others, difficulty);
        if (s.length > 0 && s[0].score > best) best = s[0].score;
    }
    return best;
}

/**
 * Approximate opponent gain from a pool of cards they could pick (on their grid).
 * Returns the average over opponentGrids of their best-of-pool placement score.
 *
 * @param {(CardData | null)[][][]} opponentGrids
 * @param {CardData[]} pool
 * @param {LayoutMeta} layout
 * @param {string} difficulty
 * @returns {number}
 */
function opponentBestFromPool(opponentGrids, pool, layout, difficulty) {
    if (opponentGrids.length === 0 || pool.length === 0) return 0;
    let total = 0;
    for (const og of opponentGrids) {
        let best = 0;
        for (const c of pool) {
            const s = scoreAllSeats(og, c, layout, [], difficulty);
            if (s.length > 0 && s[0].score > best) best = s[0].score;
        }
        total += best;
    }
    return total / opponentGrids.length;
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
) {
    const diff = AIDifficulty.HARD;

    // 1. Deck EV from remaining composition (with hand-synergy lookahead)
    let deckEV = 0;
    if (hasDeck) {
        const seen = countVisibleCards(grid, opponentGrids, lobby, currentHand);
        const remaining = buildRemainingPool(seen);
        let sum = 0;
        let weight = 0;
        for (const { card, count } of remaining) {
            const combined = [card, ...currentHand];
            sum += bestPlayWithHand(grid, combined, layout, diff) * count;
            weight += count;
        }
        deckEV = weight > 0 ? sum / weight : 0;
    }

    // 2. Opportunity cost: opponent's MARGINAL gain from getting cards we leave.
    //    Marginal = max(0, opp_best_lobby - opp_deckEV). If opp would prefer deck anyway,
    //    they don't actually pick the lobby card and our action doesn't cost us anything.
    /**
     * @param {CardData[]} pool
     * @returns {number}
     */
    const marginalOppCost = (pool) => {
        if (opponentGrids.length === 0 || pool.length === 0) return 0;
        let total = 0;
        for (const og of opponentGrids) {
            // Opp's best play of any card in pool (no opp hand context — public info only)
            let oppLobbyBest = 0;
            for (const c of pool) {
                const s = scoreAllSeats(og, c, layout, [], diff);
                if (s.length > 0 && s[0].score > oppLobbyBest) oppLobbyBest = s[0].score;
            }
            // Opp's deck EV on their grid (no hand context)
            const seen = countVisibleCards(og, [grid], lobby, []);
            const remaining = buildRemainingPool(seen);
            let sum = 0;
            let weight = 0;
            for (const { card, count } of remaining) {
                const s = scoreAllSeats(og, card, layout, [], diff);
                sum += (s.length > 0 ? s[0].score : 0) * count;
                weight += count;
            }
            const oppDeckEV = weight > 0 ? sum / weight : 0;
            total += Math.max(0, oppLobbyBest - oppDeckEV);
        }
        return total / opponentGrids.length;
    };

    // 3. Compare options on (myGain - marginal opp gain)
    const OPP_COST_WEIGHT = 1.0;
    const oppCostOnDeck = OPP_COST_WEIGHT * marginalOppCost(lobby.slice(lobbyStartIndex));

    let bestNet = hasDeck ? deckEV - oppCostOnDeck : -Infinity;
    let bestSource = /** @type {'lobby' | 'deck'} */ ("deck");
    let bestIdx = -1;

    if (hasLobby) {
        for (let i = 0; i < availableLobby.length; i++) {
            const L = availableLobby[i];
            const combined = [L, ...currentHand];
            const myGain = bestPlayWithHand(grid, combined, layout, diff);

            const myAbsoluteIdx = lobbyStartIndex + i;
            const oppPool = lobby.filter((_, idx) => idx !== myAbsoluteIdx);
            const oppCost = OPP_COST_WEIGHT * marginalOppCost(oppPool);

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
 * @param {{ epsilon?: number }} config
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
        );
    }

    // MEDIUM (and EASY when exploit fires): hand-aware threshold with magic +2.5 deckEV
    if (hasLobby) {
        let bestScore = -Infinity;
        let bestIdx = -1;

        // Baseline: best move achievable using ONLY the current hand.
        // The expected EV of an unknown deck card is ~2.5 VP on top of this baseline.
        let deckBaseScore = 0;
        if (currentHand.length > 0) {
            for (let i = 0; i < currentHand.length; i++) {
                const remaining = currentHand.filter((_, idx) => idx !== i);
                const s = scoreAllSeats(grid, currentHand[i], layout, remaining, difficulty);
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
                const remaining = combinedHand.filter((_, idx) => idx !== j);
                const s = scoreAllSeats(grid, combinedHand[j], layout, remaining, difficulty);
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
 * @param {{ epsilon?: number }} config
 * @returns {{row: number, col: number} | null}
 */
export function pickSeat(grid, card, layout, difficulty, config = {}) {
    const empty = getEmptySeats(grid, layout);
    if (empty.length === 0) return null;

    const epsilon = config.epsilon ?? getEpsilon(difficulty);

    if (random() < epsilon) {
        return empty[randomInt(empty.length - 1)];
    }

    const scored = scoreAllSeats(grid, card, layout, [], difficulty);
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
 * @param {{ epsilon?: number }} config
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

        if (playerCount === 2 && hand.length > 1) {
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

    if (playerCount === 2 && mustDiscardCount > 0) {
        for (let playIdx = 0; playIdx < hand.length; playIdx++) {
            const playCard = hand[playIdx];
            const remainingHand = hand.filter((_, idx) => idx !== playIdx);

            const scoredSeats = scoreAllSeats(grid, playCard, layout, remainingHand, difficulty);

            if (scoredSeats.length > 0) {
                const bestSeat = scoredSeats[0];

                // To decide what to discard, we identify the "Keep" card.
                // The keepCard is the one with the highest synergistic potential (bestFutureCard).
                const keepCard = bestSeat.bestFutureCard || remainingHand[0];

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
            const remainingHand = hand.filter((_, idx) => idx !== i);
            const scoredSeats = scoreAllSeats(grid, card, layout, remainingHand, difficulty);

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
