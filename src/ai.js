// @ts-check

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
        case "Lovebirds": return 2.5;
        case "Kid": return 2.5;
        case "Teacher": return 1.5;
        case "Friends": return 1.0;
        default: return 0;
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
        baseResults.push({ row, col, immediateDelta: newScore - currentScore });
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

// ── Drawing Logic ──────────────────────────────────────────────────────────

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
 * @returns {{source: 'lobby' | 'deck', index?: number} | null} Action to take
 */
export function pickDrawAction(lobby, deckSize, difficulty, grid, layout, currentHand = [], config = {}) {
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

    // Exploit (Greedy Tactician)
    if (hasLobby) {
        let bestScore = -Infinity;
        let bestIdx = -1;

        // The expected EV of drawing an unknown card from the deck is ~3.0 VP 
        // (Base ~2.0 VP + Average Potential ~1.0 VP).
        const deckEV = 3.0;

        for (let i = 0; i < availableLobby.length; i++) {
            const card = availableLobby[i];

            // Evaluate the absolute value of this lobby card, using our current hand as lookahead
            const seats = scoreAllSeats(grid, card, layout, currentHand, difficulty);
            const score = seats.length > 0 ? seats[0].score : 0;

            if (score > bestScore) {
                bestScore = score;
                bestIdx = lobbyStartIndex + i;
            }
        }

        // If the best lobby card is better than an average deck card, take it!
        if (bestScore > deckEV || !hasDeck) {
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
            
            // Pass all remaining cards into one scoreAllSeats call.
            // It will evaluate which of the remaining cards produces the best future score.
            const scoredSeats = scoreAllSeats(grid, playCard, layout, remainingHand, difficulty);
            
            if (scoredSeats.length > 0) {
                const bestSeat = scoredSeats[0];
                const keepCard = bestSeat.bestFutureCard || remainingHand[0];
                
                // Discard the card that isn't the playCard and isn't the keepCard
                const discardIdx = hand.findIndex(c => c !== playCard && c !== keepCard);
                const discardCard = discardIdx >= 0 ? hand[discardIdx] : undefined;
                
                candidates.push({
                    cardData: playCard,
                    row: bestSeat.row,
                    col: bestSeat.col,
                    score: bestSeat.score,
                    discard: discardCard
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
