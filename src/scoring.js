// @ts-check

/**
 * ========================================================================
 * SCORING ENGINE — Pure functions, no Phaser dependency
 * ========================================================================
 * Computes victory points for each patron on a player's theater grid.
 * All scoring rules from GAME_DESIGN.md are implemented here.
 *
 * The grid is a 2D array: grid[row][col] = CardData | null
 * Row 0 = front (closest to stage), last row = back.
 *
 * Scoring is two-phase:
 *   1. Primary type scoring (Standard, VIP, Lovebirds, Kid, Teacher, Critic)
 *   2. Trait scoring (Tall, Short, Bespectacled, Noisy)
 * ========================================================================
 */

import { DefaultLayout, hasSeatLabel, PatronScoring, PatronType, Trait, TraitScoring } from "./types.js";

/** @typedef {import('./types.js').CardData} CardData */
/** @typedef {import('./types.js').LayoutMeta} LayoutMeta */

/**
 * @typedef {Object} PlayerScore
 * @property {number} total - Total VP for the player
 * @property {number[][]} perSeat - VP per seat: perSeat[row][col] (patron/trait scoring only)
 * @property {number | null} houseBonus - Aggregate VP from layout house rule (null when no house rule)
 */

/**
 * Check if a seat exists at the given position (respects seatMask).
 *
 * @param {number} row
 * @param {number} col
 * @param {LayoutMeta} layout
 * @returns {boolean}
 */
export function seatExists(row, col, layout) {
    if (row < 0 || row >= layout.rows || col < 0 || col >= layout.cols) {
        return false;
    }
    if (layout.seatMask) return layout.seatMask[row][col];
    return true;
}

/**
 * Check if adjacency between two rows is broken (layout-defined row gap).
 *
 * @param {number} rowA
 * @param {number} rowB
 * @param {LayoutMeta} layout
 * @returns {boolean}
 */
function isAdjacencyBroken(rowA, rowB, layout) {
    if (!layout.adjacencyBreaks) return false;
    return layout.adjacencyBreaks.some(
        ([a, b]) => (a === rowA && b === rowB) || (a === rowB && b === rowA),
    );
}

/**
 * Get adjacent neighbors for a given position.
 *
 * Base model is orthogonal (up/down/left/right). Layouts may opt in to
 * `extendedAdjacency` to add extra one-row front/back links (used by
 * Amphitheater staggered seating).
 *
 * Respects seatMask (skips non-existent seats), adjacencyBreaks, and
 * Royal Box isolation.
 *
 * @param {number} row
 * @param {number} col
 * @param {number} rows
 * @param {number} cols
 * @param {LayoutMeta} [layout] - Optional layout for seat/adjacency constraints
 * @returns {{row: number, col: number}[]}
 */
export function getOrthogonalNeighbors(row, col, rows, cols, layout) {
    /** @type {{row: number, col: number}[]} */
    const neighbors = [];
    const seen = new Set();

    /**
     * @param {number} r
     * @param {number} c
     */
    const tryAdd = (r, c) => {
        if (r < 0 || r >= rows || c < 0 || c >= cols) return;
        if (layout && r !== row && isAdjacencyBroken(row, r, layout)) return;
        if (layout && !seatExists(r, c, layout)) return;
        if (layout) {
            const srcIsBox = hasSeatLabel(row, col, "box", layout);
            const dstIsBox = hasSeatLabel(r, c, "box", layout);
            if (srcIsBox !== dstIsBox) return;
        }
        const key = `${r},${c}`;
        if (seen.has(key)) return;
        seen.add(key);
        neighbors.push({ row: r, col: c });
    };

    // Base orthogonal adjacency
    tryAdd(row - 1, col);
    tryAdd(row + 1, col);
    tryAdd(row, col - 1);
    tryAdd(row, col + 1);

    // Optional layout extension (e.g. Amphitheater staggered rows)
    if (layout?.extendedAdjacency) {
        const frontDeltas = layout.extendedAdjacency.frontColDeltas ?? [];
        const backDeltas = layout.extendedAdjacency.backColDeltas ?? [];

        for (const d of frontDeltas) {
            tryAdd(row - 1, col + d);
        }
        for (const d of backDeltas) {
            tryAdd(row + 1, col + d);
        }
    }

    return neighbors;
}

/**
 * Get adjacent neighbors in the row directly in front (row - 1),
 * using the same adjacency model as getOrthogonalNeighbors().
 *
 * @param {number} row
 * @param {number} col
 * @param {number} rows
 * @param {number} cols
 * @param {LayoutMeta} [layout]
 * @returns {{row: number, col: number}[]}
 */
export function getFrontRowNeighbors(row, col, rows, cols, layout) {
    return getOrthogonalNeighbors(row, col, rows, cols, layout).filter(
        (n) => n.row === row - 1,
    );
}

/**
 * Get adjacent neighbors in the row directly behind (row + 1),
 * using the same adjacency model as getOrthogonalNeighbors().
 *
 * @param {number} row
 * @param {number} col
 * @param {number} rows
 * @param {number} cols
 * @param {LayoutMeta} [layout]
 * @returns {{row: number, col: number}[]}
 */
export function getBackRowNeighbors(row, col, rows, cols, layout) {
    return getOrthogonalNeighbors(row, col, rows, cols, layout).filter(
        (n) => n.row === row + 1,
    );
}

/**
 * Check if a seat is an aisle seat according to layout metadata.
 * Supports per-row aisles (e.g. Promenade) and Royal Boxes.
 *
 * @param {number} row
 * @param {number} col
 * @param {LayoutMeta} layout
 * @returns {boolean}
 */
export function isAisleSeat(row, col, layout) {
    return hasSeatLabel(row, col, "aisle", layout);
}

/**
 * @typedef {Object} KidGroup
 * @property {number[]} cols - Column indices of Kids in this contiguous group
 * @property {boolean} capped - Whether the group is capped by Teachers on both ends
 */

/**
 * Find all contiguous horizontal groups of Kids in a single row,
 * and determine whether each group is capped (Teacher on both ends).
 *
 * @param {(CardData | null)[]} rowData - One row of the grid
 * @param {number} cols - Number of columns
 * @returns {KidGroup[]}
 */
export function findHorizontalKidGroups(rowData, cols) {
    /** @type {KidGroup[]} */
    const groups = [];
    let i = 0;

    while (i < cols) {
        if (rowData[i] && rowData[i]?.type === PatronType.KID) {
            // Start of a Kid group
            /** @type {number[]} */
            const groupCols = [];
            while (i < cols && rowData[i] && rowData[i]?.type === PatronType.KID) {
                groupCols.push(i);
                i++;
            }

            // Check capping: Teacher must be immediately before and after the group
            const leftCol = groupCols[0] - 1;
            const rightCol = groupCols[groupCols.length - 1] + 1;

            const cappedLeft = leftCol >= 0 &&
                rowData[leftCol] !== null &&
                rowData[leftCol]?.type === PatronType.TEACHER;
            const cappedRight = rightCol < cols &&
                rowData[rightCol] !== null &&
                rowData[rightCol]?.type === PatronType.TEACHER;

            groups.push({
                cols: groupCols,
                capped: cappedLeft && cappedRight,
            });
        } else {
            i++;
        }
    }

    return groups;
}

/**
 * Build a lookup of which Lovebirds are part of a valid horizontal pair.
 * Scans each row left-to-right, greedily pairing adjacent Lovebirds.
 * L-L → pair. L-L-L → first two pair, third unpaired. L-L-L-L → two pairs.
 *
 * @param {(CardData | null)[][]} grid
 * @param {number} rows
 * @param {number} cols
 * @param {LayoutMeta} [layout]
 * @returns {Set<string>} Set of "row,col" keys for paired Lovebirds
 */
function buildLovebirdsPairMap(grid, rows, cols, layout) {
    /** @type {Set<string>} */
    const paired = new Set();

    for (let r = 0; r < rows; r++) {
        let c = 0;
        while (c < cols - 1) {
            // Check seatMask
            if (layout?.seatMask && !layout.seatMask[r][c]) {
                c++;
                continue;
            }
            if (grid[r][c]?.type === PatronType.LOVEBIRDS) {
                // Look for adjacent Lovebirds to the right (skip gap columns)
                const next = c + 1;
                // If next col doesn't have a seat, it's a gap — no pair
                if (layout?.seatMask && !layout.seatMask[r][next]) {
                    c++;
                    continue;
                }
                // Royal Box isolation: box and non-box seats are not adjacent
                if (layout) {
                    const srcIsBox = hasSeatLabel(r, c, "box", layout);
                    const dstIsBox = hasSeatLabel(r, next, "box", layout);
                    if (srcIsBox !== dstIsBox) {
                        c++;
                        continue;
                    }
                }
                if (next < cols && grid[r][next]?.type === PatronType.LOVEBIRDS) {
                    paired.add(`${r},${c}`);
                    paired.add(`${r},${next}`);
                    c = next + 1; // skip past the pair
                    continue;
                }
            }
            c++;
        }
    }

    return paired;
}

/**
 * @param {(CardData | null)[][]} grid
 * @param {number} rows
 * @param {number} cols
 * @param {LayoutMeta} [layout]
 */
function buildCappedKidMap(grid, rows, cols, layout) {
    /** @type {Set<number>[]} */
    const cappedKids = [];
    for (let r = 0; r < rows; r++) {
        cappedKids[r] = new Set();
    }

    // Dinner Playhouse table-based capping: a Kid is capped if any Teacher sits at the same table
    if (layout && layout.tableGroups) {
        for (const table of layout.tableGroups) {
            const hasTeacher = table.some(
                (pos) => grid[pos.row]?.[pos.col]?.type === PatronType.TEACHER,
            );
            if (hasTeacher) {
                for (const pos of table) {
                    if (grid[pos.row]?.[pos.col]?.type === PatronType.KID) {
                        cappedKids[pos.row].add(pos.col);
                    }
                }
            }
        }
        return cappedKids;
    }

    // Default: horizontal chain capping (Teacher at both ends)
    for (let r = 0; r < rows; r++) {
        const groups = findHorizontalKidGroups(grid[r], cols);
        for (const group of groups) {
            if (group.capped) {
                for (const c of group.cols) {
                    cappedKids[r].add(c);
                }
            }
        }
    }
    return cappedKids;
}

/**
 * @typedef {Object} ScoreModifier
 * @property {string} label
 * @property {number} value
 * @property {boolean} applied
 * @property {string} [reason]
 */

/**
 * @typedef {Object} SeatScoreBreakdown
 * @property {number} base
 * @property {number} total
 * @property {ScoreModifier[]} modifiers
 */

/**
 * Score breakdown for one occupied seat.
 *
 * @param {(CardData | null)[][]} grid
 * @param {number} row
 * @param {number} col
 * @param {LayoutMeta} layout
 * @param {Set<number>[]} cappedKids
 * @param {Set<string>} lovebirdsPairs
 * @returns {SeatScoreBreakdown}
 */
function buildSeatScoreBreakdown(grid, row, col, layout, cappedKids, lovebirdsPairs) {
    const card = grid[row][col];
    const scoring = card ? PatronScoring[card.type] : null;
    if (!card || !scoring) {
        return { base: 0, total: 0, modifiers: [] };
    }

    const { rows, cols } = layout;
    let vp = scoring.base;
    /** @type {ScoreModifier[]} */
    const modifiers = [];

    /**
     * @param {string} label
     * @param {number} value
     * @param {boolean} [applied]
     * @param {string} [reason]
     */
    const pushModifier = (label, value, applied = true, reason) => {
        if (value === 0) {
            return;
        }
        modifiers.push({ label, value, applied, reason });
        if (applied) {
            vp += value;
        }
    };

    switch (card.type) {
        case PatronType.STANDARD:
            break;

        case PatronType.VIP: {
            if (hasSeatLabel(row, col, "front", layout) && scoring.rowBonusValue) {
                pushModifier("Front row bonus", scoring.rowBonusValue);
            }
            if (scoring.adjacencyPenaltyTypes && scoring.adjacencyPenaltyPer) {
                const neighbors = getOrthogonalNeighbors(row, col, rows, cols, layout);
                for (const n of neighbors) {
                    const neighbor = grid[n.row][n.col];
                    if (neighbor && scoring.adjacencyPenaltyTypes.includes(neighbor.type)) {
                        pushModifier("Adjacent Kid penalty", scoring.adjacencyPenaltyPer);
                    }
                }
            }
            if (scoring.adjacencyPenaltyNoisyTrait && scoring.adjacencyPenaltyPer) {
                const neighbors = getOrthogonalNeighbors(row, col, rows, cols, layout);
                for (const n of neighbors) {
                    const neighbor = grid[n.row][n.col];
                    if (neighbor && neighbor.trait === Trait.NOISY) {
                        pushModifier("Adjacent Noisy penalty", scoring.adjacencyPenaltyPer);
                    }
                }
            }
            break;
        }

        case PatronType.LOVEBIRDS: {
            const isPaired = lovebirdsPairs.has(`${row},${col}`);
            if (isPaired && scoring.adjacentMatchBonus) {
                pushModifier("Paired Lovebirds bonus", scoring.adjacentMatchBonus);
            }
            if (isPaired && hasSeatLabel(row, col, "back", layout) && scoring.backRowBonus) {
                pushModifier("Back row pair bonus", scoring.backRowBonus);
            }
            break;
        }

        case PatronType.KID: {
            if (cappedKids[row].has(col) && scoring.cappedValue !== undefined) {
                const delta = scoring.cappedValue - scoring.base;
                if (delta !== 0) {
                    pushModifier("Capped by Teachers", delta);
                }
            }
            break;
        }

        case PatronType.TEACHER: {
            if (scoring.perCappedKidBonus) {
                // Dinner Playhouse/table layouts: Teacher scores from capped Kids at the same table
                if (layout.tableGroups) {
                    const table = layout.tableGroups.find((group) =>
                        group.some((pos) => pos.row === row && pos.col === col)
                    );

                    if (table) {
                        let cappedKidCount = 0;
                        for (const pos of table) {
                            const neighbor = grid[pos.row]?.[pos.col];
                            if (neighbor && neighbor.type === PatronType.KID && cappedKids[pos.row].has(pos.col)) {
                                cappedKidCount += 1;
                            }
                        }

                        if (cappedKidCount > 0) {
                            pushModifier(
                                "Capped Kid table bonus",
                                scoring.perCappedKidBonus * cappedKidCount,
                            );
                        }
                        break;
                    }
                }

                // Default layouts: Teacher scores from orthogonally adjacent capped Kids
                const neighbors = getOrthogonalNeighbors(row, col, rows, cols, layout);
                for (const n of neighbors) {
                    const neighbor = grid[n.row][n.col];
                    if (neighbor && neighbor.type === PatronType.KID && cappedKids[n.row].has(n.col)) {
                        pushModifier("Adjacent capped Kid bonus", scoring.perCappedKidBonus);
                    }
                }
            }
            break;
        }

        case PatronType.CRITIC: {
            if (isAisleSeat(row, col, layout) && scoring.aisleBonus) {
                const neighbors = getOrthogonalNeighbors(row, col, rows, cols, layout);
                let hasNoisyNeighbor = false;
                for (const n of neighbors) {
                    const neighbor = grid[n.row][n.col];
                    if (neighbor && neighbor.trait === Trait.NOISY) {
                        hasNoisyNeighbor = true;
                        break;
                    }
                }
                pushModifier(
                    "Aisle bonus",
                    scoring.aisleBonus,
                    !hasNoisyNeighbor,
                    hasNoisyNeighbor ? "Noisy neighbor" : undefined,
                );
            }
            break;
        }

        case PatronType.FRIENDS: {
            if (scoring.perNeighborMatchBonus) {
                const neighbors = getOrthogonalNeighbors(row, col, rows, cols, layout);
                for (const n of neighbors) {
                    const neighbor = grid[n.row][n.col];
                    if (neighbor && neighbor.type === PatronType.FRIENDS) {
                        pushModifier("Adjacent Friend bonus", scoring.perNeighborMatchBonus);
                    }
                }
            }
            break;
        }
    }

    if (card.trait) {
        const traitScoring = TraitScoring[card.trait];

        if (traitScoring) {
            if (
                card.trait === Trait.BESPECTACLED &&
                !hasSeatLabel(row, col, "back", layout) &&
                traitScoring.rowBonusValue
            ) {
                pushModifier("Bespectacled row bonus", traitScoring.rowBonusValue);
            }

            if (card.trait === Trait.SHORT) {
                const frontNeighbors = getFrontRowNeighbors(row, col, rows, cols, layout);
                const frontCards = frontNeighbors
                    .map((n) => grid[n.row]?.[n.col])
                    .filter((x) => !!x);

                if (frontCards.length === 0) {
                    pushModifier("Short: empty front bonus", traitScoring.emptyFrontBonus ?? 0);
                } else if (frontCards.some((x) => x?.trait === Trait.TALL)) {
                    pushModifier("Short: Tall in front penalty", traitScoring.tallInFrontPenalty ?? 0);
                }
            }
        }
    }

    if (card.trait !== Trait.SHORT) {
        const frontNeighbors = getFrontRowNeighbors(row, col, rows, cols, layout);
        for (const n of frontNeighbors) {
            if (grid[n.row]?.[n.col]?.trait === Trait.TALL) {
                pushModifier("Tall ahead penalty", TraitScoring[Trait.TALL].behindPenalty ?? 0);
            }
        }
    }

    {
        const neighbors = getOrthogonalNeighbors(row, col, rows, cols, layout);
        for (const n of neighbors) {
            const neighbor = grid[n.row][n.col];
            if (neighbor && neighbor.trait === Trait.NOISY) {
                pushModifier("Adjacent Noisy penalty", TraitScoring[Trait.NOISY].adjacentPenalty ?? 0);
            }
        }
    }

    return { base: scoring.base, total: vp, modifiers };
}

/**
 * Score a single seat on the grid.
 * Two-phase: primary type scoring, then trait scoring.
 *
 * @param {(CardData | null)[][]} grid
 * @param {number} row
 * @param {number} col
 * @param {LayoutMeta} layout
 * @param {Set<number>[]} cappedKids - precomputed capped Kid positions
 * @param {Set<string>} lovebirdsPairs - precomputed paired Lovebirds positions
 * @returns {number} VP for this seat
 */
export function scoreSeat(grid, row, col, layout, cappedKids, lovebirdsPairs) {
    return buildSeatScoreBreakdown(grid, row, col, layout, cappedKids, lovebirdsPairs).total;
}

/**
 * Public helper for UI: score breakdown for one occupied seat.
 *
 * @param {(CardData | null)[][]} grid
 * @param {number} row
 * @param {number} col
 * @param {LayoutMeta} [layout]
 * @returns {SeatScoreBreakdown}
 */
export function scoreSeatBreakdown(grid, row, col, layout = DefaultLayout) {
    const { rows, cols } = layout;
    const cappedKids = buildCappedKidMap(grid, rows, cols, layout);
    const lovebirdsPairs = buildLovebirdsPairMap(grid, rows, cols, layout);
    return buildSeatScoreBreakdown(grid, row, col, layout, cappedKids, lovebirdsPairs);
}

/**
 * Apply house rule scoring bonuses.
 * Called after per-seat scoring is complete. Mutates perSeat in-place.
 *
 * @param {(CardData | null)[][]} grid
 * @param {LayoutMeta} layout
 * @param {number[][]} perSeat - Per-seat VP scores (mutated)
 * @returns {number} Additional VP from house rule
 */
function scoreHouseRule(grid, layout, perSeat) {
    const { rows, cols } = layout;
    let bonus = 0;

    switch (layout.houseRule) {
        // Blackbox: +1 VP per patron with 3+ orthogonal neighbors
        case "intimate-venue": {
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (!grid[r][c]) continue;
                    const neighbors = getOrthogonalNeighbors(r, c, rows, cols, layout);
                    let occupied = 0;
                    for (const n of neighbors) {
                        if (grid[n.row][n.col]) occupied++;
                    }
                    if (occupied >= 3) {
                        perSeat[r][c] += 1;
                        bonus += 1;
                    }
                }
            }
            break;
        }

        // Opera House: +3 VP to the single highest-scoring patron
        // Tiebreak: front-most row, then left-most column
        case "royal-approval": {
            let bestR = -1;
            let bestC = -1;
            let bestVP = -Infinity;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (!grid[r][c]) continue;
                    if (perSeat[r][c] > bestVP) {
                        bestVP = perSeat[r][c];
                        bestR = r;
                        bestC = c;
                    }
                }
            }
            if (bestR >= 0) {
                perSeat[bestR][bestC] += 3;
                bonus += 3;
            }
            break;
        }

        // Promenade: +1 VP per Critic if you have 3+ Critics in aisle seats
        case "wandering-critics": {
            /** @type {{row: number, col: number}[]} */
            const criticsInAisle = [];
            /** @type {{row: number, col: number}[]} */
            const allCritics = [];
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (grid[r][c]?.type === PatronType.CRITIC) {
                        allCritics.push({ row: r, col: c });
                        if (isAisleSeat(r, c, layout)) {
                            criticsInAisle.push({ row: r, col: c });
                        }
                    }
                }
            }
            if (criticsInAisle.length >= 3) {
                for (const pos of allCritics) {
                    perSeat[pos.row][pos.col] += 1;
                    bonus += 1;
                }
            }
            break;
        }

        // Amphitheater: +2 VP for each completely filled row (respects seatMask)
        case "panorama": {
            for (let r = 0; r < rows; r++) {
                let rowComplete = true;
                let hasSeat = false;
                for (let c = 0; c < cols; c++) {
                    const exists = layout.seatMask ? layout.seatMask[r][c] : true;
                    if (exists) {
                        hasSeat = true;
                        if (!grid[r][c]) {
                            rowComplete = false;
                            break;
                        }
                    }
                }
                if (hasSeat && rowComplete) {
                    // Distribute +2 VP to the first occupied seat in the row
                    for (let c = 0; c < cols; c++) {
                        if (grid[r][c]) {
                            perSeat[r][c] += 2;
                            bonus += 2;
                            break;
                        }
                    }
                }
            }
            break;
        }

        // Dinner Playhouse: +3 VP for each 2×2 table where all 4 seats are occupied
        case "full-tables": {
            if (layout.tableGroups) {
                for (const table of layout.tableGroups) {
                    const full = table.every((pos) => grid[pos.row]?.[pos.col] != null);
                    if (full) {
                        // Award +3 VP to total only (table-level bonus, not seat-level)
                        bonus += 3;
                    }
                }
            }
            break;
        }

    }

    return bonus;
}

/**
 * Calculate total VP and per-seat breakdown for one player's theater grid.
 *
 * @param {(CardData | null)[][]} grid - The player's placedPatrons grid
 * @param {LayoutMeta} [layout] - Layout metadata (defaults to DefaultLayout)
 * @returns {PlayerScore}
 */
export function scorePlayer(grid, layout = DefaultLayout) {
    const { rows, cols } = layout;

    // Precompute capped Kids for all rows
    const cappedKids = buildCappedKidMap(grid, rows, cols, layout);

    // Precompute Lovebirds horizontal pairs
    const lovebirdsPairs = buildLovebirdsPairMap(grid, rows, cols, layout);

    /** @type {number[][]} */
    const perSeat = [];
    let total = 0;

    for (let r = 0; r < rows; r++) {
        perSeat[r] = [];
        for (let c = 0; c < cols; c++) {
            const vp = scoreSeat(grid, r, c, layout, cappedKids, lovebirdsPairs);
            perSeat[r][c] = vp;
            total += vp;
        }
    }

    // Phase 4: House rule scoring
    /** @type {number | null} */
    let houseBonus = null;
    if (layout.houseRule) {
        houseBonus = scoreHouseRule(grid, layout, perSeat);
        total += houseBonus;
    }

    return { total, perSeat, houseBonus };
}
