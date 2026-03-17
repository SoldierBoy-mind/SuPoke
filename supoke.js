'use strict';

// ── Data ─────────────────────────────────────────────────────────────────────

const types = [
  "Normal", "Fighting", "Flying", "Poison", "Ground", "Rock", "Bug", "Ghost", "Steel",
  "Fire", "Water", "Grass", "Electric", "Psychic", "Ice", "Dragon", "Dark", "Fairy"
];

// Each row is an attacker; columns follow the same order as `types` above.
const data = {
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

/**
 * Returns the damage multiplier when `attacker` targets `defender`.
 * Uses `types` as the column index map to avoid hard-coded offsets.
 * @param {string} attacker - Attacking Pokémon type.
 * @param {string} defender - Defending Pokémon type.
 * @returns {number} Effectiveness multiplier (0, 0.5, 1, or 2).
 */
const getEffectiveness = (attacker, defender) => {
  const i = types.indexOf(defender);
  return data[attacker][i];
};

// ── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Returns a new array with its elements in a uniformly random order.
 * Uses the Fisher-Yates algorithm; does not mutate the input.
 * @param {Array} arr - The source array.
 * @returns {Array} A new shuffled array.
 */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Formats a number for console display.
 * Integers are shown without a decimal point; all others are shown to 1 d.p.
 * @param {number} n - The number to format.
 * @returns {string} Formatted string representation.
 */
function fmt(n) {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

// Up, down, left, right — used for 4-directional adjacency throughout.
const DIRS = [[-1,0],[1,0],[0,-1],[0,1]];

/**
 * Returns all valid 4-directional neighbours of cell (i, j) within an N×N grid.
 * Cells on the border simply have fewer neighbours; no padding is assumed.
 * @param {number} i - Row index of the cell.
 * @param {number} j - Column index of the cell.
 * @param {number} N - Grid dimension.
 * @returns {Array<[number, number]>} Array of [row, col] pairs.
 */
function getNeighbors(i, j, N) {
  return DIRS
    .map(([di, dj]) => [i + di, j + dj])
    .filter(([ni, nj]) => ni >= 0 && ni < N && nj >= 0 && nj < N);
}

// ── Generation ────────────────────────────────────────────────────────────────

/**
 * Randomly selects N distinct Pokémon types from the full type pool.
 * @param {number} N - How many types to pick.
 * @returns {string[]} Array of N distinct type name strings.
 */
function selectTypes(N) {
  return shuffle(types).slice(0, N);
}

/**
 * Generates a random N×N Latin square over the given type set.
 * Every type appears exactly once in each row and exactly once in each column.
 * Uses backtracking with a shuffled candidate order for randomness.
 * @param {string[]} sel - The N selected type names.
 * @returns {string[][]} A complete N×N grid.
 */
function generateLatinSquare(sel) {
  const N    = sel.length;
  const grid = Array.from({length: N}, () => Array(N).fill(null));

  function fill(pos) {
    if (pos === N * N) return true;
    const r = Math.floor(pos / N);
    const c = pos % N;
    for (const t of shuffle(sel)) {
      if (grid[r].includes(t)) continue;
      if (grid.some(row => row[c] === t)) continue;
      grid[r][c] = t;
      if (fill(pos + 1)) return true;
      grid[r][c] = null;
    }
    return false;
  }

  fill(0);
  return grid;
}

/**
 * Builds the N×N type-effectiveness submatrix restricted to the selected types.
 * Entry [i][j] represents the multiplier when sel[i] attacks sel[j].
 * @param {string[]} sel - The selected type names.
 * @returns {number[][]} N×N matrix of effectiveness multipliers.
 */
function buildSubmatrix(sel) {
  return sel.map(atk => sel.map(def => getEffectiveness(atk, def)));
}

/**
 * Computes the inflicted and received damage sums for every cell in a filled grid.
 * Both sums are derived from 4-directional adjacency:
 *   inflicted[i][j] = Σ effectiveness(grid[i][j] → neighbour)
 *   received[i][j]  = Σ effectiveness(neighbour → grid[i][j])
 * These values become the puzzle's public constraints; the types remain hidden.
 * @param {string[][]} grid - A fully filled N×N type grid.
 * @param {number}     N    - Grid dimension.
 * @returns {{ inflicted: number[][], received: number[][] }}
 */
function computeConstraints(grid, N) {
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

// ── Solving ───────────────────────────────────────────────────────────────────

/**
 * Creates the three pruning helpers shared by the solver and the uniqueness counter.
 * All three functions close over `grid`, so callers interact with the live working
 * grid without passing it on every call.
 *
 * Separating pruning into a factory avoids duplicating the logic between
 * `solvePuzzle` and `countSolutions` while keeping each function self-contained.
 *
 * @param {(string|null)[][]} grid      - Working grid, mutated in place during search.
 * @param {number[][]}        inflicted - Target inflicted sums from the puzzle.
 * @param {number[][]}        received  - Target received sums from the puzzle.
 * @param {number}            N         - Grid dimension.
 * @returns {{ canPlace: Function }}
 */
function makePruner(grid, inflicted, received, N) {
  /**
   * Computes partial inflicted/received sums for cell (i, j) using only the
   * neighbours that have already been assigned a type.
   * @param {number} i - Row index.
   * @param {number} j - Column index.
   * @returns {{ inf: number, rec: number, filled: number, total: number }}
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
   * Returns false if the current assignment of cell (i, j) cannot possibly lead
   * to a valid solution, based on two pruning rules:
   *   1. The partial sum must not already exceed the target.
   *   2. Even filling every remaining neighbour with max effectiveness (2×) must
   *      still be able to reach the target — otherwise prune.
   * When all neighbours are filled, the match must be exact (float-tolerance 1e-9).
   * @param {number} i - Row index.
   * @param {number} j - Column index.
   * @returns {boolean} True if cell is still feasible.
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
   * Returns false if placing the type currently stored in grid[r][c] violates any
   * constraint — either for the cell itself or for its already-placed neighbours.
   * Neighbours must be re-checked because assigning (r, c) changes their partial sums.
   * @param {number} r - Row index.
   * @param {number} c - Column index.
   * @returns {boolean} True if the placement keeps all constraints feasible.
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

/**
 * Finds the first valid solution to the puzzle using backtracking with pruning.
 * Stops as soon as one complete, constraint-satisfying assignment is found.
 * @param {string[]}   sel       - The selected type names.
 * @param {number[][]} inflicted - Target inflicted sums.
 * @param {number[][]} received  - Target received sums.
 * @param {number}     N         - Grid dimension.
 * @returns {string[][]|null} The solved grid, or null if no solution exists.
 */
function solvePuzzle(sel, inflicted, received, N) {
  const grid = Array.from({length: N}, () => Array(N).fill(null));
  const { canPlace } = makePruner(grid, inflicted, received, N);

  function backtrack(pos) {
    if (pos === N * N) return true;
    const r = Math.floor(pos / N);
    const c = pos % N;

    for (const t of sel) {
      if (grid[r].includes(t)) continue;            // row uniqueness
      if (grid.some(row => row[c] === t)) continue; // column uniqueness

      grid[r][c] = t;
      if (canPlace(r, c) && backtrack(pos + 1)) return true;
      grid[r][c] = null;
    }

    return false;
  }

  return backtrack(0) ? grid : null;
}

/**
 * Counts the number of valid solutions to the puzzle, capped at 2.
 * Counting to 2 (rather than exhaustively) is sufficient to distinguish the
 * three cases — no solution, unique, or ambiguous — while stopping the search
 * as early as possible.
 * @param {string[]}   sel       - The selected type names.
 * @param {number[][]} inflicted - Target inflicted sums.
 * @param {number[][]} received  - Target received sums.
 * @param {number}     N         - Grid dimension.
 * @returns {number} 0, 1, or 2 (where 2 means "two or more").
 */
function countSolutions(sel, inflicted, received, N) {
  const grid = Array.from({length: N}, () => Array(N).fill(null));
  const { canPlace } = makePruner(grid, inflicted, received, N);
  let count = 0;

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
      grid[r][c] = null;
    }
  }

  backtrack(0);
  return count;
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Independently verifies a solution by recomputing constraints from scratch and
 * comparing them to the puzzle targets. This is a final sanity-check that catches
 * any divergence between the solver and the constraint generator.
 * @param {string[][]} solution  - The candidate solution grid.
 * @param {number[][]} inflicted - Expected inflicted sums.
 * @param {number[][]} received  - Expected received sums.
 * @param {number}     N         - Grid dimension.
 * @returns {boolean} True if every cell's inflicted and received sums match.
 */
function verifySolution(solution, inflicted, received, N) {
  const { inflicted: si, received: sr } = computeConstraints(solution, N);
  return solution.every((row, i) =>
    row.every((_, j) =>
      Math.abs(si[i][j] - inflicted[i][j]) < 1e-9 &&
      Math.abs(sr[i][j] - received[i][j])  < 1e-9
    )
  );
}

// ── Orchestration ─────────────────────────────────────────────────────────────

/**
 * Generates puzzle candidates for an N×N grid until one is found with exactly
 * one solution, then returns it.
 *
 * Each attempt independently selects random types and builds a fresh Latin square,
 * so repeated attempts produce structurally different puzzles. A safety limit of
 * `maxAttempts` prevents an infinite loop in the unlikely event that no unique
 * puzzle can be found (e.g. a degenerate type combination).
 *
 * @param {number} N           - Grid dimension (also the number of types used).
 * @param {number} maxAttempts - Maximum generation attempts before throwing. Default: 100.
 * @returns {{ sel: string[], solutionGrid: string[][], eSub: number[][],
 *             inflicted: number[][], received: number[][] }}
 * @throws {Error} If a unique puzzle cannot be found within `maxAttempts` attempts.
 */
function generateUniquePuzzle(N, maxAttempts = 100) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`  [Attempt ${attempt}] Generating puzzle...`);

    const sel          = selectTypes(N);
    const solutionGrid = generateLatinSquare(sel);
    const eSub         = buildSubmatrix(sel);
    const { inflicted, received } = computeConstraints(solutionGrid, N);

    console.log(`  [Attempt ${attempt}] Checking uniqueness...`);

    const count = countSolutions(sel, inflicted, received, N);

    if (count === 1) {
      console.log(`  [Attempt ${attempt}] Puzzle accepted (unique solution)\n`);
      return { sel, solutionGrid, eSub, inflicted, received };
    }

    const reason = count === 0 ? 'no solution found' : 'multiple solutions found';
    console.log(`  [Attempt ${attempt}] Rejected — ${reason}. Regenerating...`);
  }

  throw new Error(
    `Failed to generate a unique puzzle for N=${N} after ${maxAttempts} attempts.`
  );
}

// ── Display ───────────────────────────────────────────────────────────────────

/**
 * Prints a full-width section header to visually separate puzzle outputs.
 * @param {string} title - The heading text.
 */
function printSection(title) {
  const bar = '═'.repeat(64);
  console.log('\n' + bar);
  console.log(`  ${title}`);
  console.log(bar);
}

/**
 * Prints the N×N type-effectiveness submatrix as an aligned table.
 * Rows are attackers; columns are defenders; values are multipliers.
 * @param {string[]}   sel  - Selected type names used as row and column labels.
 * @param {number[][]} eSub - The submatrix to display.
 */
function printSubmatrix(sel, eSub) {
  const N  = sel.length;
  const LW = Math.max(...sel.map(t => t.length)) + 2; // row-label width
  const CW = 9;                                         // column width

  const header = 'ATK \\ DEF'.padEnd(LW) + sel.map(t => t.padStart(CW)).join('');
  console.log('\n' + header);
  console.log('─'.repeat(LW + CW * N));
  for (let i = 0; i < N; i++) {
    const row = sel[i].padEnd(LW) + eSub[i].map(v => fmt(v).padStart(CW)).join('');
    console.log(row);
  }
}

/**
 * Renders a 2-D array of strings as a bordered ASCII grid.
 * All cells in a column share the same width; content is left-padded with spaces.
 * @param {string[][]} cells     - 2-D array of cell content strings.
 * @param {number}     N         - Grid dimension.
 * @param {number}     cellWidth - Fixed width for each cell's content area.
 */
function printBoxGrid(cells, N, cellWidth) {
  const divider = '+' + ('─'.repeat(cellWidth + 2) + '+').repeat(N);
  console.log('\n' + divider);
  for (let i = 0; i < N; i++) {
    const row = '| ' + cells[i].map(c => c.padEnd(cellWidth)).join(' | ') + ' |';
    console.log(row);
    console.log(divider);
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

/**
 * Runs the complete SuPoke pipeline for an N×N puzzle:
 *   1. Generates a puzzle guaranteed to have exactly one solution.
 *   2. Displays the type set and effectiveness submatrix.
 *   3. Displays the puzzle grid (constraints only — types are hidden).
 *   4. Solves the puzzle and displays the solution grid.
 *   5. Independently verifies the solution against the original constraints.
 * @param {number} N - Grid dimension (3, 4, or 5 in the standard game).
 */
function runPuzzle(N) {
  printSection(`SUPOKE  ·  N = ${N}  (${N}×${N} grid)`);

  const { sel, eSub, inflicted, received } = generateUniquePuzzle(N);

  console.log(`  Types : ${sel.join('  ·  ')}`);

  console.log('\n  Effectiveness Submatrix  (row = attacker, col = defender)');
  printSubmatrix(sel, eSub);

  // The puzzle presents only the damage sums — the type assignments are unknown.
  console.log('\n  Puzzle Grid  (I = total damage inflicted on neighbours,');
  console.log('               R = total damage received from neighbours)');
  const puzzleCells = Array.from({length: N}, (_, i) =>
    Array.from({length: N}, (_, j) => `I:${fmt(inflicted[i][j])} R:${fmt(received[i][j])}`)
  );
  printBoxGrid(puzzleCells, N, 13);

  const solution = solvePuzzle(sel, inflicted, received, N);

  console.log('\n  Solution Grid');
  if (!solution) {
    // Should never happen after generateUniquePuzzle guarantees exactly one solution.
    console.error('  ERROR: solver returned no solution for a verified-unique puzzle.');
    return;
  }

  const typeW = Math.max(...sel.map(t => t.length));
  printBoxGrid(solution, N, typeW);

  const ok = verifySolution(solution, inflicted, received, N);
  console.log(ok
    ? `\n  ✓  All ${N * N * 2} constraints satisfied.\n`
    : `\n  ✗  Verification FAILED!\n`
  );
}

[3, 4, 5].forEach(runPuzzle);
