// @ts-check

/**
 * ========================================================================
 * AI PLAYER - Pure decision logic, no Phaser dependency
 * ========================================================================
 * Provides seat-selection strategies for AI-controlled players.
 * Three difficulty levels:
 *   - easy:   random valid seat
 *   - medium: greedy (maximise immediate total VP)
 *   - hard:   greedy + positional heuristics for future value
 * ========================================================================
 */

import {
    getBackRowNeighbors,
    getFrontRowNeighbors,
    getOrthogonalNeighbors,
    scorePlayer,
    seatExists,
} from "./scoring.js";
import { hasSeatLabel, PatronType, Trait } from "./types.js";
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
 * Deep-clone a grid (shallow-copy each cell reference - CardData is immutable).
 *
 * @param {(CardData | null)[][]} grid
 * @returns {(CardData | null)[][]}
 */
function cloneGrid(grid) {
    return grid.map((row) => [...row]);
}

// ── Greedy evaluation ───────────────────────────────────────────────

/**
 * Evaluate placing a card at a specific seat.
 * Returns the delta in total VP compared to the current grid.
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
    const newGrid = cloneGrid(grid);
    newGrid[row][col] = card;
    const newScore = scorePlayer(newGrid, layout).total;
    return newScore - currentScore;
}

/**
 * Score every empty seat for a card placement.
 *
 * @param {(CardData | null)[][]} grid
 * @param {CardData} card
 * @param {LayoutMeta} layout
 * @returns {{row: number, col: number, score: number}[]} Sorted descending by score
 */
export function scoreAllSeats(grid, card, layout) {
    const empty = getEmptySeats(grid, layout);
    const results = empty.map(({ row, col }) => ({
        row,
        col,
        score: evaluateSeat(grid, card, row, col, layout),
    }));
    results.sort((a, b) => b.score - a.score);
    return results;
}

// ── Hard-mode heuristics ────────────────────────────────────────────

/**
 * Compute a heuristic bonus for placing a card at a given position.
 * Rewards strategic placements that set up future scoring opportunities.
 *
 * @param {(CardData | null)[][]} grid
 * @param {CardData} card
 * @param {number} row
 * @param {number} col
 * @param {LayoutMeta} layout
 * @returns {number} Heuristic bonus (can be negative for bad positions)
 */
export function applyHeuristics(grid, card, row, col, layout) {
    let bonus = 0;
    const { rows, cols } = layout;
    const neighbors = getOrthogonalNeighbors(row, col, rows, cols, layout);

    // ── Type-specific heuristics ───────────────────────────────────

    switch (card.type) {
        case PatronType.LOVEBIRDS: {
            // Prefer back row for ×2 multiplier
            if (hasSeatLabel(row, col, "back", layout)) {
                bonus += 2;
            }
            // Bonus for being near empty seats (future Lovebirds can pair up)
            const emptyNeighbors = neighbors.filter((n) => !grid[n.row][n.col]);
            bonus += emptyNeighbors.length * 0.5;
            // Bonus for being near existing Lovebirds
            const lovebirdNeighbors = neighbors.filter(
                (n) => grid[n.row]?.[n.col]?.type === PatronType.LOVEBIRDS,
            );
            bonus += lovebirdNeighbors.length * 1.5;
            break;
        }

        case PatronType.VIP: {
            // Prefer front row seats
            if (hasSeatLabel(row, col, "front", layout)) {
                bonus += 1.5;
            }
            // Avoid seats adjacent to Kids or Noisy patrons
            for (const n of neighbors) {
                const nb = grid[n.row]?.[n.col];
                if (nb?.type === PatronType.KID) {
                    bonus -= 1;
                }
                if (nb?.trait === Trait.NOISY) {
                    bonus -= 1;
                }
            }
            break;
        }

        case PatronType.CRITIC: {
            // Strongly prefer aisle seats
            if (hasSeatLabel(row, col, "aisle", layout)) {
                bonus += 3;
            }
            break;
        }

        case PatronType.KID: {
            // Prefer positions that could be capped (between empty slots for Teachers)
            // Check if left or right neighbors are empty (potential Teacher spots)
            const leftEmpty = col > 0 && seatExists(row, col - 1, layout) && !grid[row][col - 1];
            const rightEmpty = col < cols - 1 && seatExists(row, col + 1, layout) && !grid[row][col + 1];
            if (leftEmpty && rightEmpty) {
                bonus += 1;
            }
            // Bonus for being next to an existing Teacher
            const teacherNeighbors = neighbors.filter(
                (n) => grid[n.row]?.[n.col]?.type === PatronType.TEACHER,
            );
            bonus += teacherNeighbors.length;
            // Bonus for being next to other Kids (Teacher can cap a chain)
            const kidNeighbors = neighbors.filter(
                (n) => grid[n.row]?.[n.col]?.type === PatronType.KID && n.col === col - 1 || n.col === col + 1,
            );
            bonus += kidNeighbors.length * 0.5;
            break;
        }

        case PatronType.TEACHER: {
            // Prefer positions adjacent to Kids
            const adjacentKids = neighbors.filter(
                (n) => grid[n.row]?.[n.col]?.type === PatronType.KID,
            );
            bonus += adjacentKids.length * 1.5;
            break;
        }

        case PatronType.STANDARD: {
            // No special heuristic - Standards are flexible
            break;
        }

        case PatronType.FRIENDS: {
            // Prefer seats adjacent to existing Friends
            const friendNeighbors = neighbors.filter(
                (n) => grid[n.row]?.[n.col]?.type === PatronType.FRIENDS,
            );
            bonus += friendNeighbors.length * 1.5;
            // Bonus for empty seats nearby (future Friends can cluster)
            const emptyNearby = neighbors.filter((n) => !grid[n.row][n.col]);
            bonus += emptyNearby.length * 0.3;
            break;
        }
    }

    // ── Trait-specific heuristics ──────────────────────────────────

    if (card.trait) {
        switch (card.trait) {
            case Trait.TALL: {
                // Prefer back row (fewer adjacent seats behind to penalize)
                if (hasSeatLabel(row, col, "back", layout)) {
                    bonus += 2;
                }
                // Penalty if someone is already in adjacent behind seat(s)
                const behindNeighbors = getBackRowNeighbors(row, col, rows, cols, layout);
                const occupiedBehind = behindNeighbors.filter((n) => grid[n.row]?.[n.col]);
                bonus -= occupiedBehind.length * 2;
                break;
            }

            case Trait.SHORT: {
                // Prefer seats with no adjacent patrons in front row
                const frontNeighbors = getFrontRowNeighbors(row, col, rows, cols, layout);
                const frontCards = frontNeighbors
                    .map((n) => grid[n.row]?.[n.col])
                    .filter((x) => !!x);

                if (frontCards.length === 0) {
                    bonus += row === 0 ? 1.5 : 1;
                }
                // Avoid placing behind Tall patron(s)
                if (frontCards.some((x) => x?.trait === Trait.TALL)) {
                    bonus -= 2;
                }
                break;
            }

            case Trait.BESPECTACLED: {
                // Prefer non-back rows
                if (!hasSeatLabel(row, col, "back", layout)) {
                    bonus += 1;
                }
                break;
            }

            case Trait.NOISY: {
                // Prefer seats with fewer occupied neighbors (minimize damage)
                const occupiedNeighbors = neighbors.filter((n) => grid[n.row]?.[n.col]);
                bonus -= occupiedNeighbors.length * 0.5;
                // Prefer edge/corner seats
                if (neighbors.length <= 2) {
                    bonus += 1;
                }
                break;
            }
        }
    }

    return bonus;
}

// ── Drawing Logic ──────────────────────────────────────────────────────────

/**
 * Decide whether to draw from the lobby or the deck.
 *
 * @param {CardData[]} lobby - The lobby cards (index 0 is frozen while deck has cards)
 * @param {number} deckSize - Current size of the deck
 * @param {string} difficulty - AI difficulty
 * @param {(CardData | null)[][]} grid - Current grid to evaluate lobby cards
 * @param {LayoutMeta} layout - Current theater layout
 * @returns {{source: 'lobby' | 'deck', index?: number} | null} Action to take
 */
export function pickDrawAction(lobby, deckSize, difficulty, grid, layout) {
    const lobbyStartIndex = deckSize > 0 ? 1 : 0;
    const availableLobby = lobby.slice(lobbyStartIndex);
    const hasLobby = availableLobby.length > 0;
    const hasDeck = deckSize > 0;

    const debugAI = import.meta.env?.VITE_DEBUG_AI === "true";
    if (debugAI) {
        console.log(
            `[AI DEBUG] Evaluating draw: LobbySize=${availableLobby.length}, DeckSize=${deckSize}, Difficulty=${difficulty}`,
        );
    }

    if (!hasLobby && !hasDeck) {
        return null;
    }

    switch (difficulty) {
        case AIDifficulty.EASY: {
            const sources = [];
            if (hasLobby) {
                sources.push("lobby");
            }
            if (hasDeck) {
                sources.push("deck");
            }
            const choice = sources[randomInt(sources.length - 1)];
            if (choice === "lobby") {
                return {
                    source: "lobby",
                    index: lobbyStartIndex + randomInt(availableLobby.length - 1),
                };
            }

            return { source: "deck" };
        }

        case AIDifficulty.MEDIUM: {
            if (hasLobby) {
                let bestScore = -Infinity;
                let bestIdx = -1;

                for (let i = 0; i < availableLobby.length; i++) {
                    const card = availableLobby[i];
                    const seats = scoreAllSeats(grid, card, layout);
                    const score = seats.length > 0 ? seats[0].score : 0;
                    if (debugAI) {
                        console.log(
                            `[AI DEBUG] Lobby Card ${i + lobbyStartIndex} (${card.label || card.type}) potential: ${score} VP`,
                        );
                    }
                    if (score > bestScore) {
                        bestScore = score;
                        bestIdx = lobbyStartIndex + i;
                    }
                }
                return { source: "lobby", index: bestIdx };
            }
            return hasDeck ? { source: "deck" } : null;
        }

        case AIDifficulty.HARD: {
            if (hasLobby) {
                let bestScore = -Infinity;
                let bestIdx = -1;

                for (let i = 0; i < availableLobby.length; i++) {
                    const card = availableLobby[i];
                    const seats = scoreAllSeats(grid, card, layout);
                    if (seats.length > 0) {
                        const score = seats[0].score + applyHeuristics(grid, card, seats[0].row, seats[0].col, layout);
                        if (debugAI) {
                            console.log(
                                `[AI DEBUG] Lobby Card ${i + lobbyStartIndex} (${card.label || card.type}) heuristic score: ${score} VP`,
                            );
                        }
                        if (score > bestScore) {
                            bestScore = score;
                            bestIdx = lobbyStartIndex + i;
                        }
                    }
                }

                if (bestScore > 3) {
                    return { source: "lobby", index: bestIdx };
                }
            }
            return hasDeck
                ? { source: "deck" }
                : (hasLobby ? { source: "lobby", index: lobbyStartIndex } : null);
        }

        default:
            return hasDeck
                ? { source: "deck" }
                : (hasLobby ? { source: "lobby", index: lobbyStartIndex } : null);
    }
}

/**
 * Pick the best seat for a card given the AI difficulty level.
 *
 * @param {(CardData | null)[][]} grid - Current grid state
 * @param {CardData} card - Card to place
 * @param {LayoutMeta} layout
 * @param {string} difficulty - One of AIDifficulty values
 * @returns {{row: number, col: number} | null} Best seat, or null if no seats available
 */
export function pickSeat(grid, card, layout, difficulty) {
    const empty = getEmptySeats(grid, layout);
    if (empty.length === 0) {
        return null;
    }

    switch (difficulty) {
        case AIDifficulty.EASY: {
            // Random seat
            const idx = randomInt(empty.length - 1);
            return empty[idx];
        }

        case AIDifficulty.MEDIUM: {
            // Greedy: maximize immediate VP delta
            const scored = scoreAllSeats(grid, card, layout);
            return scored.length > 0 ? { row: scored[0].row, col: scored[0].col } : null;
        }

        case AIDifficulty.HARD: {
            // Greedy + heuristics + jitter
            const scored = scoreAllSeats(grid, card, layout);
            if (scored.length === 0) {
                return null;
            }

            // Add heuristic bonus
            const enhanced = scored.map((s) => ({
                row: s.row,
                col: s.col,
                score: s.score + applyHeuristics(grid, card, s.row, s.col, layout),
            }));

            // Add slight jitter (±0.5) to avoid perfectly predictable play
            for (const e of enhanced) {
                e.score += random() - 0.5;
            }

            enhanced.sort((a, b) => b.score - a.score);
            return { row: enhanced[0].row, col: enhanced[0].col };
        }

        default:
            // Fallback to random
            return empty[randomInt(empty.length - 1)];
    }
}

/**
 * For 2-player mode: pick which card to play (and where) and which to discard.
 * Returns the card to play + its best seat, and the card to discard.
 *
 * @param {(CardData | null)[][]} grid
 * @param {CardData[]} hand - The player's hand (2+ cards)
 * @param {number} payerCount - Number of payers in the game (to determine if discards matter)
 * @param {LayoutMeta} layout
 * @param {string} difficulty
 * @returns {{play: {cardData: CardData, row: number, col: number}, discard?: {cardData: CardData}} | null}
 */
export function pickCardAndSeat(grid, hand, payerCount, layout, difficulty) {
    if (hand.length === 0) return null;

    const empty = getEmptySeats(grid, layout);
    if (empty.length === 0) return null;

    // end of the game we only have 1 card
    if (hand.length === 1) {
        const seat = pickSeat(grid, hand[0], layout, difficulty);
        if (!seat) return null;

        return { play: { cardData: hand[0], ...seat } };
    }

    // Evaluate each card's best seat
    /** @type {{cardData: CardData, row: number, col: number, score: number}[]} */
    const candidates = [];

    for (const cardData of hand) {
        const seat = pickSeat(grid, cardData, layout, difficulty);
        if (seat) {
            const score = evaluateSeat(grid, cardData, seat.row, seat.col, layout);

            candidates.push({ cardData, ...seat, score });
        }
    }

    if (candidates.length === 0) return null;

    // Sort by score descending - play the best, discard the worst
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    const worst = candidates.at(-1);

    if (payerCount === 2 && worst && worst.cardData !== best.cardData) {
        return {
            play: { cardData: best.cardData, row: best.row, col: best.col },
            discard: { cardData: worst.cardData },
        };
    }

    return {
        play: { cardData: best.cardData, row: best.row, col: best.col },
    };
}
