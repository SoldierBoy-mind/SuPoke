/**
 * @module solver
 *
 * Puzzle solving for SuPoke.
 * This module operates entirely on the public puzzle descriptor produced by the
 * generator — the selected type names and the per-cell inflicted / received
 * constraint arrays — without any knowledge of how that descriptor was created.
 *
 * Public surface:
 *   solvePuzzle      — finds the first valid solution (stops immediately).
 *   countSolutions   — counts valid solutions up to 2 (for uniqueness testing).
 *   verifySolution   — independently validates a candidate grid against targets.
 *
 * `makePruner` is an internal factory and is not exported.
 *
 * Dependency graph position:
 *   types.js  →  solver.js  →  main.js
 */

import { getEffectiveness, getNeighbors } from './types.js';

// ── Pruning factory (private) ─────────────────────────────────────────────────

/**
 * Creates the constraint-checking helpers shared by `solvePuzzle` and
 * `countSolutions`.  All returned functions close over `grid` so the caller
 * interacts with the live working grid without threading it through every call.
 *
 * Isolating the pruning logic in a factory avoids duplicating it between the
 * two backtracking functions while keeping each exported function self-contained.
 *
 * @param {(string|null)[][]} grid      - Working grid, mutated in place during search.
 * @param {number[][]}        inflicted - Target inflicted sums from the puzzle.
 * @param {number[][]}        received  - Target received sums from the puzzle.
 * @param {number}            N         - Grid dimension.
 * @returns {{ canPlace: Function }}
 */
function makePruner(grid, inflicted, received, N) {

  /**
   * Computes inflicted and received sums for cell (i, j) using only the
   * neighbours that already hold a type assignment.  Unfilled neighbours
   * are excluded; their contribution will be added when they are placed.
   * @param {number} i - Row index.
   * @param {number} j - Column index.
   * @returns {{ inf: number, rec: number, filled: number, total: number }}
   *   Partial sums and neighbour counts needed for both pruning checks.
   */
  function partialSums(i, j) {
    const nbrs = getNeighbors(i, j, N);
    let inf = 0, rec = 0, filled = 0;

    for (const [ni, nj] of nbrs) {
      if (grid[ni][nj] !== null) {
        inf += getEffectiveness(grid[i][j], grid[ni][nj]);
        rec += getEffectiveness(grid[ni][nj], grid[i][j]);
        filled++;
      }
    }

    return { inf, rec, filled, total: nbrs.length };
  }

  /**
   * Returns false if the current type assignment at (i, j) cannot possibly
   * lead to a complete solution, based on two complementary pruning rules:
   *
   *   Lower-bound check: the partial sum must not already exceed the target.
   *   Upper-bound check: even filling every remaining neighbour with the
   *     maximum effectiveness (2×) must still be able to reach the target.
   *
   * When all neighbours are filled the match must be exact.  A float tolerance
   * of 1e-9 is applied throughout because effectiveness values are stored as
   * JavaScript IEEE-754 doubles.
   *
   * @param {number} i - Row index.
   * @param {number} j - Column index.
   * @returns {boolean} True if the cell's current assignment is still feasible.
   */
  function isConsistent(i, j) {
    const { inf, rec, filled, total } = partialSums(i, j);
    const rem = total - filled;

    if (inf > inflicted[i][j] + 1e-9) return false;
    if (rec > received[i][j]  + 1e-9) return false;
    if (inflicted[i][j] - inf > rem * 2 + 1e-9) return false;
    if (received[i][j]  - rec > rem * 2 + 1e-9) return false;

    // When all neighbours are known the sums must match exactly.
    // Tolerance of 1e-9 guards against floating-point rounding in the matrix.
    if (rem === 0) {
      if (Math.abs(inf - inflicted[i][j]) > 1e-9) return false;
      if (Math.abs(rec - received[i][j])  > 1e-9) return false;
    }

    return true;
  }

  /**
   * Returns false if placing the type currently stored in grid[r][c] makes any
   * constraint infeasible — either for the cell itself or for its already-placed
   * neighbours.  Neighbours must be re-checked because assigning (r, c) increases
   * their `filled` count and therefore changes their partial sums.
   * @param {number} r - Row index.
   * @param {number} c - Column index.
   * @returns {boolean} True if the placement keeps all reachable constraints feasible.
   */
  function canPlace(r, c) {
    if (!isConsistent(r, c)) return false;

    // Placing (r,c) changes the partial sums of its already-placed neighbours,
    // so we must re-check them too.
    for (const [ni, nj] of getNeighbors(r, c, N)) {
      if (grid[ni][nj] !== null && !isConsistent(ni, nj)) return false;
    }

    return true;
  }

  return { canPlace };
}

// ── Solver ────────────────────────────────────────────────────────────────────

/**
 * Finds the first valid solution to the puzzle using constraint-pruned backtracking.
 * Cells are filled in row-major order.  At each cell every candidate type is tried;
 * candidates that immediately violate a Latin-square or constraint rule are skipped.
 * The search terminates as soon as one complete, valid assignment is found.
 *
 * @param {string[]}   sel       - The N selected type names (defines the candidate set).
 * @param {number[][]} inflicted - Target inflicted damage sums (N×N).
 * @param {number[][]} received  - Target received damage sums (N×N).
 * @param {number}     N         - Grid dimension.
 * @returns {string[][]|null} The completed solution grid, or null if no solution exists.
 */
export function solvePuzzle(sel, inflicted, received, N) {
  const grid = Array.from({length: N}, () => Array(N).fill(null));
  const { canPlace } = makePruner(grid, inflicted, received, N);

  /**
   * Recursively assigns types starting at cell `pos` (row-major index).
   * @param {number} pos - Current cell index (0 … N²-1).
   * @returns {boolean} True when the entire grid is validly filled.
   */
  function backtrack(pos) {
    if (pos === N * N) return true;
    const r = Math.floor(pos / N);
    const c = pos % N;

    for (const t of sel) {
      if (grid[r].includes(t)) continue;            // row uniqueness
      if (grid.some(row => row[c] === t)) continue; // column uniqueness

      grid[r][c] = t;
      if (canPlace(r, c) && backtrack(pos + 1)) return true;
      grid[r][c] = null;                            // backtrack
    }

    return false;
  }

  return backtrack(0) ? grid : null;
}

// ── Solution counter ──────────────────────────────────────────────────────────

/**
 * Counts the number of valid solutions to the puzzle, capped at 2.
 *
 * Counting to exactly 2 — rather than running to exhaustion — is sufficient to
 * classify a puzzle into one of three cases:
 *   0  → unsolvable   (regenerate)
 *   1  → unique       (accept)
 *   2+ → ambiguous    (regenerate)
 * The early-exit at count ≥ 2 makes this significantly faster than a full count
 * for ambiguous puzzles, which is the common rejection case.
 *
 * @param {string[]}   sel       - The N selected type names.
 * @param {number[][]} inflicted - Target inflicted damage sums (N×N).
 * @param {number[][]} received  - Target received damage sums (N×N).
 * @param {number}     N         - Grid dimension.
 * @returns {number} 0, 1, or 2 — where 2 means "two or more valid solutions".
 */
export function countSolutions(sel, inflicted, received, N) {
  const grid = Array.from({length: N}, () => Array(N).fill(null));
  const { canPlace } = makePruner(grid, inflicted, received, N);
  let count = 0;

  /**
   * Recursively explores the search space without stopping at the first solution.
   * @param {number} pos - Current cell index (0 … N²-1).
   */
  function backtrack(pos) {
    if (pos === N * N) {
      count++;
      return; // Do not stop — continue searching for a second solution.
    }
    const r = Math.floor(pos / N);
    const c = pos % N;

    for (const t of sel) {
      if (count >= 2) return;                        // Early exit: ambiguity confirmed.
      if (grid[r].includes(t)) continue;            // row uniqueness
      if (grid.some(row => row[c] === t)) continue; // column uniqueness

      grid[r][c] = t;
      if (canPlace(r, c)) backtrack(pos + 1);
      grid[r][c] = null;                            // backtrack
    }
  }

  backtrack(0);
  return count;
}

// ── Verification ──────────────────────────────────────────────────────────────

/**
 * Independently verifies a candidate solution by recomputing its inflicted and
 * received sums from scratch and comparing them to the puzzle targets.
 *
 * This function intentionally recomputes constraints without calling the
 * generator's `computeConstraints`, keeping the solver module free of any
 * generator dependency.  The check short-circuits on the first mismatching cell.
 *
 * @param {string[][]} solution  - The candidate solution grid to verify.
 * @param {number[][]} inflicted - Expected inflicted damage sums (N×N).
 * @param {number[][]} received  - Expected received damage sums (N×N).
 * @param {number}     N         - Grid dimension.
 * @returns {boolean} True if every cell's recomputed sums match the targets.
 */
export function verifySolution(solution, inflicted, received, N) {
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      let inf = 0, rec = 0;

      for (const [ni, nj] of getNeighbors(i, j, N)) {
        inf += getEffectiveness(solution[i][j], solution[ni][nj]);
        rec += getEffectiveness(solution[ni][nj], solution[i][j]);
      }

      // Float tolerance of 1e-9 for the same reason as in makePruner.
      if (Math.abs(inf - inflicted[i][j]) > 1e-9) return false;
      if (Math.abs(rec - received[i][j])  > 1e-9) return false;
    }
  }
  return true;
}
