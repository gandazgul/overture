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

import {
  DefaultLayout,
  hasSeatLabel,
  PatronScoring,
  PatronType,
  Trait,
  TraitScoring,
} from "./types.js";

/** @typedef {import('./types.js').CardData} CardData */
/** @typedef {import('./types.js').LayoutMeta} LayoutMeta */

/**
 * @typedef {Object} PlayerScore
 * @property {number} total - Total VP for the player
 * @property {number[][]} perSeat - VP per seat: perSeat[row][col]
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
 * Check if adjacency between two rows is broken (e.g. Balcony gap).
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
 * Get orthogonal neighbors (up/down/left/right) for a given position.
 * Respects seatMask (skips non-existent seats) and adjacencyBreaks.
 *
 * @param {number} row
 * @param {number} col
 * @param {number} rows
 * @param {number} cols
 * @param {LayoutMeta} [layout] - Optional layout for seatMask/adjacencyBreaks
 * @returns {{row: number, col: number}[]}
 */
export function getOrthogonalNeighbors(row, col, rows, cols, layout) {
  /** @type {{row: number, col: number}[]} */
  const neighbors = [];
  const candidates = [
    { row: row - 1, col },
    { row: row + 1, col },
    { row, col: col - 1 },
    { row, col: col + 1 },
  ];
  for (const c of candidates) {
    if (c.row < 0 || c.row >= rows || c.col < 0 || c.col >= cols) continue;
    // Check adjacency breaks between rows
    if (layout && c.row !== row && isAdjacencyBroken(row, c.row, layout)) {
      continue;
    }
    // Check seatMask
    if (layout && layout.seatMask && !layout.seatMask[c.row][c.col]) continue;
    neighbors.push(c);
  }
  return neighbors;
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
 * Build a lookup of which Kid columns are capped in each row.
 * Returns a Set for each row containing the column indices of capped Kids.
 *
 * @param {(CardData | null)[][]} grid
 * @param {number} rows
 * @param {number} cols
 * @returns {Set<number>[]} - cappedKids[row] is a Set of capped col indices
 */
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

  // Cabaret table-based capping: a Kid is capped if any Teacher sits at the same table
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
 * Score a single seat on the grid.
 * Two-phase: primary type scoring, then trait scoring.
 *
 * @param {(CardData | null)[][]} grid
 * @param {number} row
 * @param {number} col
 * @param {LayoutMeta} layout
 * @param {Set<number>[]} cappedKids - precomputed capped Kid positions
 * @returns {number} VP for this seat
 */
export function scoreSeat(grid, row, col, layout, cappedKids) {
  const card = grid[row][col];
  if (!card) return 0;

  const { rows, cols } = layout;
  const scoring = PatronScoring[card.type];
  if (!scoring) return 0;

  let vp = scoring.base;

  // ── Phase 1: Primary type scoring ───────────────────────────────

  switch (card.type) {
    case PatronType.STANDARD: {
      // Standard has no special primary scoring (just base VP)
      break;
    }

    case PatronType.VIP: {
      // Front seat bonus
      if (
        hasSeatLabel(row, col, "front", layout) &&
        scoring.rowBonusValue
      ) {
        vp += scoring.rowBonusValue;
      }
      // Adjacency penalty for Kid neighbors
      if (scoring.adjacencyPenaltyTypes && scoring.adjacencyPenaltyPer) {
        const neighbors = getOrthogonalNeighbors(row, col, rows, cols, layout);
        for (const n of neighbors) {
          const neighbor = grid[n.row][n.col];
          if (
            neighbor &&
            scoring.adjacencyPenaltyTypes.includes(neighbor.type)
          ) {
            vp += scoring.adjacencyPenaltyPer;
          }
        }
      }
      // VIP is also penalized by adjacent Noisy-trait patrons
      if (scoring.adjacencyPenaltyNoisyTrait && scoring.adjacencyPenaltyPer) {
        const neighbors = getOrthogonalNeighbors(row, col, rows, cols, layout);
        for (const n of neighbors) {
          const neighbor = grid[n.row][n.col];
          if (neighbor && neighbor.trait === Trait.NOISY) {
            vp += scoring.adjacencyPenaltyPer;
          }
        }
      }
      break;
    }

    case PatronType.LOVEBIRDS: {
      // Score only if adjacent to another Lovebirds
      const neighbors = getOrthogonalNeighbors(row, col, rows, cols, layout);
      let hasAdjacentMatch = false;
      for (const n of neighbors) {
        const neighbor = grid[n.row][n.col];
        if (neighbor && neighbor.type === PatronType.LOVEBIRDS) {
          hasAdjacentMatch = true;
          break;
        }
      }
      if (hasAdjacentMatch && scoring.adjacentMatchBonus) {
        vp += scoring.adjacentMatchBonus;
      }
      // Back row multiplier
      if (
        hasAdjacentMatch &&
        hasSeatLabel(row, col, "back", layout) &&
        scoring.backRowMultiplier
      ) {
        vp *= scoring.backRowMultiplier;
      }
      break;
    }

    case PatronType.KID: {
      if (cappedKids[row].has(col) && scoring.cappedValue !== undefined) {
        vp = scoring.cappedValue;
      }
      // else stays at base (0 uncapped)
      break;
    }

    case PatronType.TEACHER: {
      // Bonus per adjacent Kid that is capped
      if (scoring.perCappedKidBonus) {
        const neighbors = getOrthogonalNeighbors(row, col, rows, cols, layout);
        for (const n of neighbors) {
          const neighbor = grid[n.row][n.col];
          if (
            neighbor &&
            neighbor.type === PatronType.KID &&
            cappedKids[n.row].has(n.col)
          ) {
            vp += scoring.perCappedKidBonus;
          }
        }
      }
      break;
    }

    case PatronType.CRITIC: {
      if (isAisleSeat(row, col, layout) && scoring.aisleMultiplier) {
        vp *= scoring.aisleMultiplier;
      }
      break;
    }
  }

  // ── Phase 2: Trait scoring ──────────────────────────────────────

  if (card.trait) {
    const traitScoring = TraitScoring[card.trait];

    if (traitScoring) {
      // Bespectacled trait: bonus unless in back row
      if (
        card.trait === Trait.BESPECTACLED &&
        !hasSeatLabel(row, col, "back", layout) &&
        traitScoring.rowBonusValue
      ) {
        vp += traitScoring.rowBonusValue;
      }

      // Short trait: check the seat directly in front (row - 1, same col)
      if (card.trait === Trait.SHORT) {
        const frontRow = row - 1;
        const frontBlocked = frontRow < 0 ||
          (layout && isAdjacencyBroken(row, frontRow, layout)) ||
          (layout?.seatMask && !layout.seatMask[frontRow]?.[col]);
        if (frontBlocked || !grid[frontRow]?.[col]) {
          // No one in front (or adjacency broken) — bonus
          vp += traitScoring.emptyFrontBonus ?? 0;
        } else if (grid[frontRow][col]?.trait === Trait.TALL) {
          // Tall-trait patron in front — penalty
          vp += traitScoring.tallInFrontPenalty ?? 0;
        }
      }
    }
  }

  // ── Cross-type modifiers (applied to ANY patron) ────────────────

  // Tall trait behind penalty: if the seat in front (row-1) has a Tall-trait
  // patron, this patron gets the behindPenalty (unless this patron is Short,
  // which has its own tallInFrontPenalty already handled above).
  if (card.trait !== Trait.SHORT) {
    const frontRow = row - 1;
    const frontAccessible = frontRow >= 0 &&
      !(layout && isAdjacencyBroken(row, frontRow, layout)) &&
      !(layout?.seatMask && !layout.seatMask[frontRow]?.[col]);
    if (
      frontAccessible &&
      grid[frontRow][col] &&
      grid[frontRow][col]?.trait === Trait.TALL
    ) {
      vp += TraitScoring[Trait.TALL].behindPenalty ?? 0;
    }
  }

  // Noisy trait adjacency penalty: for each neighbor with the Noisy trait,
  // this patron gets -1 VP.
  {
    const neighbors = getOrthogonalNeighbors(row, col, rows, cols, layout);
    for (const n of neighbors) {
      const neighbor = grid[n.row][n.col];
      if (neighbor && neighbor.trait === Trait.NOISY) {
        vp += TraitScoring[Trait.NOISY].adjacentPenalty ?? 0;
      }
    }
  }

  return vp;
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

    // Royal Theatre: +3 VP to the single highest-scoring patron
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

    // Cabaret: +3 VP for each 2×2 table where all 4 seats are occupied
    case "full-tables": {
      if (layout.tableGroups) {
        for (const table of layout.tableGroups) {
          const full = table.every((pos) => grid[pos.row]?.[pos.col] != null);
          if (full) {
            // Award +3 VP to the top-left seat of the table
            perSeat[table[0].row][table[0].col] += 3;
            bonus += 3;
          }
        }
      }
      break;
    }

    // Balcony: Bird's Eye View is handled in scoreSeat via adjacencyBreaks.
    // No additional end-game bonus needed.
    case "birds-eye-view":
      break;
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

  /** @type {number[][]} */
  const perSeat = [];
  let total = 0;

  for (let r = 0; r < rows; r++) {
    perSeat[r] = [];
    for (let c = 0; c < cols; c++) {
      const vp = scoreSeat(grid, r, c, layout, cappedKids);
      perSeat[r][c] = vp;
      total += vp;
    }
  }

  // Phase 4: House rule scoring
  if (layout.houseRule) {
    total += scoreHouseRule(grid, layout, perSeat);
  }

  return { total, perSeat };
}
