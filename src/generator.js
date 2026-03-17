/**
 * @module generator
 *
 * Puzzle generation for SuPoke.
 * This module is responsible for everything that happens before the puzzle is
 * presented to a solver:
 *   1. Selecting a random subset of Pokémon types.
 *   2. Building a valid N×N Latin square (the hidden solution).
 *   3. Extracting the type-effectiveness submatrix for the chosen types.
 *   4. Computing per-cell inflicted / received damage sums from the solution
 *      grid — these sums are the only information given to the solver.
 *
 * This module has no knowledge of solving or counting solutions.
 * It is a pure producer: given N, it creates a self-contained puzzle descriptor
 * that any solver may work against.
 *
 * Dependency graph position:
 *   types.js  →  generator.js  →  main.js
 */

import { types, getEffectiveness, shuffle, getNeighbors } from './types.js';

// ── Type selection ────────────────────────────────────────────────────────────

/**
 * Randomly selects N distinct Pokémon types from the full 18-type pool.
 * The selection is uniformly random on each call, so different puzzles use
 * different type combinations.
 * @param {number} N - Number of types to select (equals the grid dimension).
 * @returns {string[]} Array of N distinct type name strings.
 */
export function selectTypes(N) {
  return shuffle(types).slice(0, N);
}

// ── Latin-square generation ───────────────────────────────────────────────────

/**
 * Generates a random N×N Latin square over the given set of type names.
 * Every type appears exactly once in each row and exactly once in each column.
 *
 * Uses recursive backtracking with a freshly shuffled candidate list at each
 * cell, ensuring that the generated grid is uniformly random among all valid
 * Latin squares for the given type set.
 *
 * @param {string[]} sel - The N selected type names that fill the grid.
 * @returns {string[][]} A complete N×N Latin-square grid of type names.
 */
export function generateLatinSquare(sel) {
  const N    = sel.length;
  const grid = Array.from({length: N}, () => Array(N).fill(null));

  /**
   * Recursively fills the grid starting at position `pos` (row-major order).
   * @param {number} pos - Linear cell index (0 … N²-1).
   * @returns {boolean} True when the grid is fully and validly filled.
   */
  function fill(pos) {
    if (pos === N * N) return true;
    const r = Math.floor(pos / N);
    const c = pos % N;

    for (const t of shuffle(sel)) {
      if (grid[r].includes(t)) continue;            // row uniqueness
      if (grid.some(row => row[c] === t)) continue; // column uniqueness
      grid[r][c] = t;
      if (fill(pos + 1)) return true;
      grid[r][c] = null;                            // backtrack
    }
    return false;
  }

  fill(0);
  return grid;
}

// ── Effectiveness submatrix ───────────────────────────────────────────────────

/**
 * Builds the N×N type-effectiveness submatrix restricted to the selected types.
 * Entry [i][j] is the multiplier when sel[i] attacks sel[j].
 * Displayed to players as a reference; not used directly by the solver.
 * @param {string[]} sel - The selected type names (defines row and column order).
 * @returns {number[][]} N×N matrix of effectiveness multipliers.
 */
export function buildSubmatrix(sel) {
  return sel.map(atk => sel.map(def => getEffectiveness(atk, def)));
}

// ── Constraint computation ────────────────────────────────────────────────────

/**
 * Computes the inflicted and received damage sums for every cell in a filled grid,
 * using 4-directional (Von Neumann) adjacency.
 *
 *   inflicted[i][j]  =  Σ  getEffectiveness(grid[i][j], grid[ni][nj])
 *                       neighbours (ni,nj)
 *
 *   received[i][j]   =  Σ  getEffectiveness(grid[ni][nj], grid[i][j])
 *                       neighbours (ni,nj)
 *
 * These two N×N arrays are the puzzle's public constraints.  The type
 * assignments in the solution grid are never revealed to the solver.
 *
 * @param {string[][]} grid - A fully filled N×N grid of type name strings.
 * @param {number}     N    - Grid dimension.
 * @returns {{ inflicted: number[][], received: number[][] }}
 *   Two N×N arrays of non-negative floating-point constraint values.
 */
export function computeConstraints(grid, N) {
  const inflicted = Array.from({length: N}, () => Array(N).fill(0));
  const received  = Array.from({length: N}, () => Array(N).fill(0));

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      for (const [ni, nj] of getNeighbors(i, j, N)) {
        inflicted[i][j] += getEffectiveness(grid[i][j], grid[ni][nj]);
        received[i][j]  += getEffectiveness(grid[ni][nj], grid[i][j]);
      }
    }
  }

  return { inflicted, received };
}
