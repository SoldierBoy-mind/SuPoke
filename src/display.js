/**
 * @module display
 *
 * Console rendering for SuPoke.
 * All formatted output lives here so that generator, solver, and orchestration
 * code remain free of presentation concerns.  Functions in this module are pure
 * with respect to game state: they receive already-computed data and write it
 * to stdout; they do not modify anything.
 *
 * Dependency graph position:
 *   types.js  →  display.js  →  main.js
 */

import { fmt } from './types.js';

// ── Section header ────────────────────────────────────────────────────────────

/**
 * Prints a full-width double-rule section header that visually separates each
 * puzzle run in the terminal output.
 * @param {string} title - The heading text to display between the rules.
 */
export function printSection(title) {
  const bar = '═'.repeat(64);
  console.log('\n' + bar);
  console.log(`  ${title}`);
  console.log(bar);
}

// ── Submatrix table ───────────────────────────────────────────────────────────

/**
 * Prints the N×N type-effectiveness submatrix as an aligned table.
 * Rows represent attackers; columns represent defenders.
 * Column widths adapt to the longest type name in the selected set.
 * @param {string[]}   sel  - Selected type names used as both row and column labels.
 * @param {number[][]} eSub - N×N matrix of effectiveness multipliers to display.
 */
export function printSubmatrix(sel, eSub) {
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

// ── Box grid ──────────────────────────────────────────────────────────────────

/**
 * Renders a 2-D array of strings as a bordered ASCII box grid.
 * Every cell is padded to `cellWidth` characters.  A dividing line is printed
 * above every row (including the first), giving the grid a uniform grid-line style.
 * @param {string[][]} cells     - 2-D array of pre-formatted cell content strings.
 * @param {number}     N         - Grid dimension (number of rows and columns).
 * @param {number}     cellWidth - Fixed content width for every cell.
 */
export function printBoxGrid(cells, N, cellWidth) {
  const divider = '+' + ('─'.repeat(cellWidth + 2) + '+').repeat(N);
  console.log('\n' + divider);

  for (let i = 0; i < N; i++) {
    const row = '| ' + cells[i].map(c => c.padEnd(cellWidth)).join(' | ') + ' |';
    console.log(row);
    console.log(divider);
  }
}
