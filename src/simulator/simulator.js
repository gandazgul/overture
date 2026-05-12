/** @typedef {import('../types.js').CardData} CardData */

import { createDeck, Layouts } from "../types.js";
import { scorePlayer } from "../scoring.js";
import { pickCardAndSeat, pickDrawAction } from "../ai.js";

/**
 * @param {{ playerCount: number, layoutId: string, aiDifficulty: string }} config
 */
export function simulateGame(config) {
    const layout = Layouts[config.layoutId];
    if (!layout) throw new Error(`Unknown layout: ${config.layoutId}`);

    const deck = createDeck();
    /** @type {CardData[]} */
    const lobby = [];
    /** @type {CardData[][]} */
    const hands = Array.from({ length: config.playerCount }, () => []);
    const grids = Array.from(
        { length: config.playerCount },
        () => Array.from({ length: layout.rows }, () => Array(layout.cols).fill(null)),
    );

    // Track analytics
    /** @type {Object.<string, number>[]} */
    const lobbyPicks = Array.from({ length: config.playerCount }, () => ({}));

    // ── Setup ───────────────────────────────────────────────────────────
    for (let p = 0; p < config.playerCount; p++) {
        const card = deck.pop();
        if (card) hands[p].push(card);
    }

    if (config.playerCount === 3) deck.pop();
    if (config.playerCount === 2) {
        deck.pop();
        deck.pop();
    }

    const maxCardsInHand = config.playerCount === 2 ? 3 : 2;

    // ── Core Loop ───────────────────────────────────────────────────────
    let round = 1;
    while (round <= 14) {
        for (let p = 0; p < config.playerCount; p++) {
            while (lobby.length < 3 && deck.length > 0) {
                const card = deck.pop();
                if (card) lobby.push(card);
            }

            while (hands[p].length < maxCardsInHand && (deck.length > 0 || lobby.length > 0)) {
                const action = pickDrawAction(lobby, deck.length, config.aiDifficulty, grids[p], layout);
                if (!action) break;

                if (action.source === "lobby" && action.index !== undefined) {
                    const card = lobby.splice(action.index, 1)[0];
                    hands[p].push(card);

                    // Track the lobby pick
                    const key = card.trait ? `${card.trait} ${card.type}` : card.type;
                    lobbyPicks[p][key] = (lobbyPicks[p][key] || 0) + 1;

                    if (deck.length > 0) {
                        const refill = deck.pop();
                        if (refill) lobby.unshift(refill);
                    }
                } else {
                    const card = deck.pop();
                    if (card) hands[p].push(card);
                }
            }

            if (hands[p].length > 0) {
                const action = pickCardAndSeat(grids[p], hands[p], config.playerCount, layout, config.aiDifficulty);
                if (action) {
                    grids[p][action.play.row][action.play.col] = action.play.cardData;
                    hands[p] = hands[p].filter((c) => c !== action.play.cardData);
                    if (action.discard) {
                        hands[p] = hands[p].filter((c) => c !== action.discard?.cardData);
                    }
                }
            }
        }
        round++;
    }

    // ── Scoring & Breakdown ─────────────────────────────────────────────
    const playerResults = grids.map((grid, p) => {
        const score = scorePlayer(grid, layout);
        /** @type {Object.<string, { vp: number, count: number }>} */
        const typeBreakdown = {};

        for (let r = 0; r < layout.rows; r++) {
            for (let c = 0; c < layout.cols; c++) {
                const card = grid[r][c];
                if (card) {
                    if (!typeBreakdown[card.type]) {
                        typeBreakdown[card.type] = { vp: 0, count: 0 };
                    }
                    typeBreakdown[card.type].vp += score.perSeat[r][c];
                    typeBreakdown[card.type].count += 1;
                }
            }
        }
        return { total: score.total, typeBreakdown, lobbyPicks: lobbyPicks[p] };
    });

    return { players: playerResults };
}
