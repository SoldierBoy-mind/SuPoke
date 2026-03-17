/**
 * @module main
 *
 * Entry point and orchestration layer for SuPoke.
 * This module is the only place that imports from all other modules.  It owns
 * the two responsibilities that require coordinating generation and solving:
 *
 *   generateUniquePuzzle — retry loop that guarantees a unique puzzle.
 *   runPuzzle            — full pipeline for one value of N.
 *
 * Keeping orchestration here (rather than in generator or solver) is what
 * prevents a circular dependency: generator.js never imports solver.js, and
 * solver.js never imports generator.js.
 *
 * Dependency graph (no cycles):
 *
 *   types.js ──► generator.js ──┐
 *   types.js ──► solver.js    ──┼──► main.js
 *   types.js ──► display.js  ──┘
 */

import { selectTypes, generateLatinSquare, buildSubmatrix, computeConstraints }
  from './src/generator.js';

import { solvePuzzle, countSolutions, verifySolution }
  from './src/solver.js';

import { printSection, printSubmatrix, printBoxGrid }
  from './src/display.js';

import { fmt } from './src/types.js';

// ── Orchestration ─────────────────────────────────────────────────────────────

/**
 * Generates puzzle candidates for an N×N grid, repeating until one is found
 * that has exactly one valid solution.
 *
 * Each attempt independently selects a fresh random type combination and builds
 * a new Latin square, so successive attempts produce structurally different
 * puzzles.  A `maxAttempts` ceiling prevents an infinite loop in the unlikely
 * event that no unique puzzle can be produced for a given N (e.g. a degenerate
 * type combination where all effectiveness values are identical).
 *
 * Console messages emitted per attempt:
 *   "Generating puzzle..."                    — puzzle candidate created.
 *   "Checking uniqueness..."                  — solution count under way.
 *   "Puzzle accepted (unique solution)"       — candidate accepted.
 *   "Rejected — <reason>. Regenerating..."   — candidate discarded.
 *
 * @param {number} N           - Grid dimension and number of types used.
 * @param {number} maxAttempts - Upper bound on generation attempts. Default: 100.
 * @returns {{ sel: string[], solutionGrid: string[][], eSub: number[][],
 *             inflicted: number[][], received: number[][] }}
 *   A fully validated puzzle descriptor ready for display and solving.
 * @throws {Error} If no unique puzzle is found within `maxAttempts` attempts.
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

// ── Puzzle runner ─────────────────────────────────────────────────────────────

/**
 * Executes the complete SuPoke pipeline for a single N×N puzzle:
 *   1. Generates a puzzle guaranteed to have exactly one solution.
 *   2. Displays the selected type set and the effectiveness submatrix.
 *   3. Displays the puzzle grid (constraint values only — types are hidden).
 *   4. Solves the puzzle with backtracking.
 *   5. Displays the solution grid.
 *   6. Independently verifies the solution against the original constraints.
 *
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
    // Should be unreachable: generateUniquePuzzle guarantees exactly one solution.
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

// ── Entry point ───────────────────────────────────────────────────────────────

[3, 4, 5].forEach(runPuzzle);
