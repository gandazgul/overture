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
 * ========================================================================
 */

import { PatronType, PatronScoring, DefaultLayout } from "./types.js";

/** @typedef {import('./types.js').CardData} CardData */
/** @typedef {import('./types.js').LayoutMeta} LayoutMeta */

/**
 * @typedef {Object} PlayerScore
 * @property {number} total - Total VP for the player
 * @property {number[][]} perSeat - VP per seat: perSeat[row][col]
 */

/**
 * Get orthogonal neighbors (up/down/left/right) for a given position.
 *
 * @param {number} row
 * @param {number} col
 * @param {number} rows
 * @param {number} cols
 * @returns {{row: number, col: number}[]}
 */
export function getOrthogonalNeighbors(row, col, rows, cols) {
  /** @type {{row: number, col: number}[]} */
  const neighbors = [];
  if (row > 0) neighbors.push({ row: row - 1, col });
  if (row < rows - 1) neighbors.push({ row: row + 1, col });
  if (col > 0) neighbors.push({ row, col: col - 1 });
  if (col < cols - 1) neighbors.push({ row, col: col + 1 });
  return neighbors;
}

/**
 * Check if a column is an aisle seat according to layout metadata.
 *
 * @param {number} col
 * @param {LayoutMeta} layout
 * @returns {boolean}
 */
export function isAisleSeat(col, layout) {
  return layout.aisleCols.includes(col);
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

      const cappedLeft =
        leftCol >= 0 &&
        rowData[leftCol] !== null &&
        rowData[leftCol]?.type === PatronType.TEACHER;
      const cappedRight =
        rightCol < cols &&
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
function buildCappedKidMap(grid, rows, cols) {
  /** @type {Set<number>[]} */
  const cappedKids = [];
  for (let r = 0; r < rows; r++) {
    cappedKids[r] = new Set();
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

  // ── Type-specific scoring ───────────────────────────────────────

  switch (card.type) {
    case PatronType.STANDARD: {
      // Check if a Noisy patron is adjacent — each one applies a penalty
      const neighbors = getOrthogonalNeighbors(row, col, rows, cols);
      for (const n of neighbors) {
        const neighbor = grid[n.row][n.col];
        if (neighbor && neighbor.type === PatronType.NOISY) {
          vp += PatronScoring[PatronType.NOISY].adjacentStandardPenalty ?? 0;
        }
      }
      break;
    }

    case PatronType.BESPECTACLED: {
      if (
        scoring.rowBonusRows &&
        scoring.rowBonusRows.includes(row) &&
        scoring.rowBonusValue
      ) {
        vp += scoring.rowBonusValue;
      }
      break;
    }

    case PatronType.VIP: {
      // Row bonus
      if (
        scoring.rowBonusRows &&
        scoring.rowBonusRows.includes(row) &&
        scoring.rowBonusValue
      ) {
        vp += scoring.rowBonusValue;
      }
      // Adjacency penalty for Kid or Noisy neighbors
      if (scoring.adjacencyPenaltyTypes && scoring.adjacencyPenaltyPer) {
        const neighbors = getOrthogonalNeighbors(row, col, rows, cols);
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
      break;
    }

    case PatronType.LOVEBIRDS: {
      // Score only if adjacent to another Lovebirds
      const neighbors = getOrthogonalNeighbors(row, col, rows, cols);
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
      const backRows = scoring.backRows ?? layout.backRows;
      if (
        hasAdjacentMatch &&
        backRows.includes(row) &&
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
        const neighbors = getOrthogonalNeighbors(row, col, rows, cols);
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

    case PatronType.TALL: {
      // Tall patron scores their base. The penalty is applied to the
      // patron behind them (handled in that patron's scoring).
      break;
    }

    case PatronType.SHORT: {
      // Check the seat directly in front (row - 1, same col)
      const frontRow = row - 1;
      if (frontRow < 0 || !grid[frontRow][col]) {
        // No one in front — bonus
        vp += scoring.emptyFrontBonus ?? 0;
      } else if (grid[frontRow][col]?.type === PatronType.TALL) {
        // Tall in front — penalty
        vp += scoring.tallInFrontPenalty ?? 0;
      }
      break;
    }

    case PatronType.CRITIC: {
      if (isAisleSeat(col, layout) && scoring.aisleMultiplier) {
        vp *= scoring.aisleMultiplier;
      }
      break;
    }

    case PatronType.NOISY: {
      // Noisy patron scores their base (0). The penalty is applied
      // to adjacent Standards (handled in Standard's scoring).
      break;
    }
  }

  // ── Cross-type modifiers applied to ANY patron ──────────────────

  // Tall person behind penalty: if the seat in front (row-1) has a Tall patron,
  // this patron gets the behindPenalty (unless this patron is Short, which
  // has its own tallInFrontPenalty already handled above).
  if (card.type !== PatronType.SHORT) {
    const frontRow = row - 1;
    if (
      frontRow >= 0 &&
      grid[frontRow][col] &&
      grid[frontRow][col]?.type === PatronType.TALL
    ) {
      vp += PatronScoring[PatronType.TALL].behindPenalty ?? 0;
    }
  }

  return vp;
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
  const cappedKids = buildCappedKidMap(grid, rows, cols);

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

  return { total, perSeat };
}
