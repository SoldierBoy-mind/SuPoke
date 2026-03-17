/**
 * @module types
 *
 * Foundation layer for SuPoke.
 * Provides the raw Pokémon type data, the effectiveness look-up, and every
 * pure utility that two or more modules share.  Nothing in this file depends
 * on any other project module — it is the leaf node of the dependency graph.
 *
 * Dependency graph position:
 *   types.js  ←  generator.js
 *   types.js  ←  solver.js
 *   types.js  ←  display.js
 */

// ── Type list ─────────────────────────────────────────────────────────────────

/**
 * The 18 canonical Pokémon types in the order they appear as columns in `data`.
 * This ordering is the single source of truth for all index look-ups; never
 * hard-code a column number elsewhere.
 * @type {string[]}
 */
export const types = [
  "Normal", "Fighting", "Flying", "Poison", "Ground", "Rock", "Bug", "Ghost", "Steel",
  "Fire", "Water", "Grass", "Electric", "Psychic", "Ice", "Dragon", "Dark", "Fairy"
];

// ── Effectiveness matrix ──────────────────────────────────────────────────────

/**
 * Type-effectiveness matrix indexed by attacker name.
 * Each row lists the damage multiplier against every defender type in the same
 * order as `types` above.
 * Multipliers: 0 = immune, 0.5 = not very effective, 1 = neutral, 2 = super effective.
 * @type {Object.<string, number[]>}
 */
export const data = {
  "Normal":   [1,1,1,1,1,0.5,1,0,0.5,1,1,1,1,1,1,1,1,1],
  "Fighting": [2,1,0.5,0.5,1,2,0.5,0,2,1,1,1,1,0.5,2,1,2,0.5],
  "Flying":   [1,2,1,1,1,0.5,2,1,0.5,1,1,2,0.5,1,1,1,1,1],
  "Poison":   [1,1,1,0.5,0.5,0.5,1,0.5,0,1,1,2,1,1,1,1,1,2],
  "Ground":   [1,1,0,2,1,2,0.5,1,2,2,1,0.5,2,1,1,1,1,1],
  "Rock":     [1,0.5,2,1,0.5,1,2,1,0.5,2,1,1,1,1,2,1,1,1],
  "Bug":      [1,0.5,0.5,0.5,1,1,1,0.5,0.5,0.5,1,2,1,2,1,1,2,0.5],
  "Ghost":    [0,1,1,1,1,1,1,2,1,1,1,1,1,2,1,1,0.5,0],
  "Steel":    [1,1,1,1,1,2,1,1,0.5,0.5,0.5,1,0.5,1,2,1,1,2],
  "Fire":     [1,1,1,1,1,0.5,2,1,2,0.5,0.5,2,1,1,2,0.5,1,1],
  "Water":    [1,1,1,1,2,2,1,1,1,2,0.5,0.5,1,1,1,0.5,1,1],
  "Grass":    [1,1,0.5,0.5,2,2,0.5,1,0.5,0.5,2,0.5,1,1,1,0.5,1,1],
  "Electric": [1,1,2,1,0,1,1,1,1,1,2,0.5,0.5,1,1,0.5,1,1],
  "Psychic":  [1,2,1,2,1,1,1,1,0.5,1,1,1,1,0.5,1,1,0,1],
  "Ice":      [1,1,2,1,2,1,1,1,0.5,0.5,0.5,2,1,1,0.5,2,1,1],
  "Dragon":   [1,1,1,1,1,1,1,1,0.5,1,1,1,1,1,1,2,1,0],
  "Dark":     [1,0.5,1,1,1,1,1,2,1,1,1,1,1,2,1,1,0.5,0.5],
  "Fairy":    [1,2,1,0.5,1,1,1,1,0.5,0.5,1,1,1,1,1,2,2,1]
};

// ── Integer effectiveness matrix ──────────────────────────────────────────────

/**
 * Integer-scaled version of the effectiveness matrix (all values × 2).
 * Mapping: 0 → 0, 0.5 → 1, 1 → 2, 2 → 4.
 * Used as the default for all computations so that constraint sums and
 * solver bounds stay in whole numbers, avoiding any floating-point drift.
 * The original `data` is kept as the source of truth and is never modified.
 * @type {Object.<string, number[]>}
 */
export const dataInt = Object.fromEntries(
  Object.entries(data).map(([atk, row]) => [atk, row.map(v => v * 2)])
);

// ── Type-effectiveness look-up ────────────────────────────────────────────────

/**
 * Returns the effectiveness value when `attacker` targets `defender`.
 * Uses the integer-scaled matrix by default (0, 1, 2, or 4).
 * Pass `false` as the third argument to get the original float values (0, 0.5, 1, 2).
 * @param {string}  attacker  - Attacking Pokémon type name.
 * @param {string}  defender  - Defending Pokémon type name.
 * @param {boolean} [integer] - Use integer-scaled matrix (default: true).
 * @returns {number} Effectiveness value.
 */
export const getEffectiveness = (attacker, defender, integer = true) => {
  const i = types.indexOf(defender);
  return (integer ? dataInt : data)[attacker][i];
};

// ── Grid geometry ─────────────────────────────────────────────────────────────

/**
 * Unit offsets for 8-directional (Moore) adjacency: all orthogonal and diagonal
 * neighbours. Exported so modules that iterate neighbours can use the same constant.
 * @type {Array<[number, number]>}
 */
export const DIRS = [
  [-1,-1],[-1,0],[-1,1],
  [ 0,-1],       [ 0,1],
  [ 1,-1],[ 1,0],[ 1,1],
];

/**
 * Returns all in-bounds 4-directional neighbours of cell (i, j) in an N×N grid.
 * Border cells simply have fewer neighbours; no virtual padding is applied.
 * @param {number} i - Row index of the cell.
 * @param {number} j - Column index of the cell.
 * @param {number} N - Grid dimension.
 * @returns {Array<[number, number]>} Array of [row, col] neighbour coordinates.
 */
export function getNeighbors(i, j, N) {
  return DIRS
    .map(([di, dj]) => [i + di, j + dj])
    .filter(([ni, nj]) => ni >= 0 && ni < N && nj >= 0 && nj < N);
}

// ── General-purpose utilities ─────────────────────────────────────────────────

/**
 * Returns a new array whose elements are in a uniformly random order.
 * Implements the Fisher-Yates (Knuth) shuffle; does not mutate the original.
 * @param {Array} arr - The source array to shuffle.
 * @returns {Array} A new array containing the same elements in random order.
 */
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Formats a number for human-readable console output.
 * Integers are rendered without a decimal point; all other values to one decimal place.
 * @param {number} n - The number to format.
 * @returns {string} Formatted string (e.g. "2", "0.5").
 */
export function fmt(n) {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}
