/**
 * SuPoke — Frontend application.
 *
 * Manages all client-side behaviour:
 *   - Grid-size selection
 *   - Communicating with the backend API
 *   - Rendering the puzzle constraint grid and solution grid
 *   - Status messages and loading states
 *
 * No external libraries are used. The module is a plain script loaded at the
 * bottom of index.html so all DOM elements are available immediately.
 */

// ── Type colours ──────────────────────────────────────────────────────────────

/**
 * Background and foreground colours for all 18 Pokémon types.
 * Used to colour type badges, matrix headers, and solution-grid cells.
 * @type {Record<string, { bg: string, text: string }>}
 */
const TYPE_COLORS = {
  Normal:   { bg: '#A8A878', text: '#fff' },
  Fighting: { bg: '#C03028', text: '#fff' },
  Flying:   { bg: '#A890F0', text: '#fff' },
  Poison:   { bg: '#A040A0', text: '#fff' },
  Ground:   { bg: '#E0C068', text: '#333' },
  Rock:     { bg: '#B8A038', text: '#fff' },
  Bug:      { bg: '#A8B820', text: '#fff' },
  Ghost:    { bg: '#705898', text: '#fff' },
  Steel:    { bg: '#B8B8D0', text: '#333' },
  Fire:     { bg: '#F08030', text: '#fff' },
  Water:    { bg: '#6890F0', text: '#fff' },
  Grass:    { bg: '#78C850', text: '#fff' },
  Electric: { bg: '#F8D030', text: '#333' },
  Psychic:  { bg: '#F85888', text: '#fff' },
  Ice:      { bg: '#98D8D8', text: '#333' },
  Dragon:   { bg: '#7038F8', text: '#fff' },
  Dark:     { bg: '#705848', text: '#fff' },
  Fairy:    { bg: '#EE99AC', text: '#333' },
};

// ── Application state ─────────────────────────────────────────────────────────

/**
 * Central state object. Mutated by event handlers; read by render functions.
 * @type {{ n: number, puzzle: object|null, solution: object|null }}
 */
const state = {
  n:        3,
  puzzle:   null,   // Response from POST /api/generate
  solution: null,   // Response from POST /api/solve
};

// ── DOM references ────────────────────────────────────────────────────────────

const dom = {
  generateBtn:     document.getElementById('generate-btn'),
  solveBtn:        document.getElementById('solve-btn'),
  status:          document.getElementById('status'),
  puzzleArea:      document.getElementById('puzzle-area'),
  typesDisplay:    document.getElementById('types-display'),
  matrixToggle:    document.getElementById('matrix-toggle'),
  matrixContent:   document.getElementById('matrix-content'),
  effMatrix:       document.getElementById('eff-matrix'),
  puzzleGrid:      document.getElementById('puzzle-grid'),
  solutionSection: document.getElementById('solution-section'),
  solutionGrid:    document.getElementById('solution-grid'),
  verifyResult:    document.getElementById('verify-result'),
};

// ── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Formats a number for display: integers without decimal point, others to 1 d.p.
 * @param {number} n
 * @returns {string}
 */
function formatNum(n) {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

/**
 * Returns the colour pair for a given type name, falling back to neutral grey.
 * @param {string} type
 * @returns {{ bg: string, text: string }}
 */
function typeColor(type) {
  return TYPE_COLORS[type] ?? { bg: '#888', text: '#fff' };
}

/**
 * Applies a type's colours directly to a DOM element's inline styles.
 * @param {HTMLElement} el
 * @param {string}      type
 */
function applyTypeStyle(el, type) {
  const { bg, text } = typeColor(type);
  el.style.backgroundColor = bg;
  el.style.color            = text;
}

// ── Status bar ────────────────────────────────────────────────────────────────

/**
 * Updates the status bar.
 * @param {'loading'|'success'|'error'|''} kind    - Visual style variant.
 * @param {string}                          message - Text to display.
 */
function setStatus(kind, message = '') {
  dom.status.className = 'status-bar' + (kind ? ` status-${kind}` : '');
  dom.status.innerHTML = kind === 'loading'
    ? `<span class="spinner" aria-hidden="true"></span>${message}`
    : message;
}

// ── Reset ─────────────────────────────────────────────────────────────────────

/**
 * Hides the puzzle area and clears all ephemeral state.
 * Called before generating a new puzzle or when the grid size changes.
 */
function resetPuzzle() {
  state.puzzle   = null;
  state.solution = null;
  dom.puzzleArea.hidden      = true;
  dom.solutionSection.hidden = true;
  setStatus('');
}

// ── Event handlers ────────────────────────────────────────────────────────────

// Grid-size buttons
document.querySelectorAll('.size-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.n = parseInt(btn.dataset.n, 10);
    resetPuzzle();
  });
});

// Generate button — calls POST /api/generate
dom.generateBtn.addEventListener('click', async () => {
  dom.generateBtn.disabled    = true;
  dom.generateBtn.textContent = 'Generating…';
  resetPuzzle();
  setStatus('loading', 'Generating puzzle…');

  try {
    const res = await fetch('/api/generate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ n: state.n }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `Server error ${res.status}`);
    }

    state.puzzle = await res.json();
    const a = state.puzzle.attempts;
    setStatus('success', `Unique puzzle generated in ${a} attempt${a === 1 ? '' : 's'}.`);
    renderPuzzle();
    dom.puzzleArea.hidden = false;

  } catch (err) {
    setStatus('error', err.message);

  } finally {
    dom.generateBtn.disabled    = false;
    dom.generateBtn.textContent = 'Generate Puzzle';
  }
});

// Solve button — calls POST /api/solve
dom.solveBtn.addEventListener('click', async () => {
  if (!state.puzzle) return;
  dom.solveBtn.disabled    = true;
  dom.solveBtn.textContent = 'Solving…';
  setStatus('loading', 'Solving puzzle…');

  try {
    const { sel, inflicted, received, n } = state.puzzle;
    const res = await fetch('/api/solve', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ sel, inflicted, received, n }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `Server error ${res.status}`);
    }

    state.solution = await res.json();
    const label = state.solution.unique ? 'Unique solution found.' : 'Multiple solutions detected.';
    setStatus('success', label);
    renderSolution();
    dom.solutionSection.hidden = false;
    dom.solutionSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  } catch (err) {
    setStatus('error', err.message);

  } finally {
    dom.solveBtn.disabled    = false;
    dom.solveBtn.textContent = 'Solve Puzzle';
  }
});

// Effectiveness matrix collapsible
dom.matrixToggle.addEventListener('click', () => {
  const expanded = dom.matrixToggle.getAttribute('aria-expanded') === 'true';
  dom.matrixToggle.setAttribute('aria-expanded', String(!expanded));
  dom.matrixContent.hidden = expanded;
});

// ── Render: puzzle ────────────────────────────────────────────────────────────

/**
 * Renders the active types list, effectiveness matrix, and puzzle constraint grid
 * from state.puzzle.
 */
function renderPuzzle() {
  const { sel, eSub, inflicted, received, n } = state.puzzle;

  // Active type badges
  dom.typesDisplay.innerHTML = '';
  sel.forEach(type => {
    const badge = document.createElement('span');
    badge.className   = 'type-badge';
    badge.textContent = type;
    applyTypeStyle(badge, type);
    dom.typesDisplay.appendChild(badge);
  });

  // Effectiveness matrix table
  renderMatrix(sel, eSub);

  // Puzzle constraint grid (inflicted / received per cell)
  dom.puzzleGrid.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
  dom.puzzleGrid.innerHTML = '';

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const cell = document.createElement('div');
      cell.className = 'cell puzzle-cell';
      cell.innerHTML =
        `<span class="cell-label-i">I: ${formatNum(inflicted[i][j])}</span>` +
        `<span class="cell-label-r">R: ${formatNum(received[i][j])}</span>`;
      dom.puzzleGrid.appendChild(cell);
    }
  }
}

/**
 * Builds the effectiveness matrix <table> element.
 * @param {string[]}   sel  - Selected type names (row and column labels).
 * @param {number[][]} eSub - N×N effectiveness values.
 */
function renderMatrix(sel, eSub) {
  dom.effMatrix.innerHTML = '';

  // Header row (defender types along the top)
  const head   = dom.effMatrix.insertRow();
  const corner = head.insertCell();
  corner.textContent = 'ATK \\ DEF';
  corner.className   = 'matrix-corner';

  sel.forEach(type => {
    const th = head.insertCell();
    th.textContent = type;
    th.className   = 'matrix-header';
    applyTypeStyle(th, type);
  });

  // Data rows (attacker types down the left)
  eSub.forEach((row, i) => {
    const tr    = dom.effMatrix.insertRow();
    const label = tr.insertCell();
    label.textContent = sel[i];
    label.className   = 'matrix-row-label';
    applyTypeStyle(label, sel[i]);

    row.forEach(val => {
      const td = tr.insertCell();
      td.textContent = formatNum(val);
      td.className   = 'matrix-cell ' + (
        val === 2   ? 'eff-super'  :
        val === 0.5 ? 'eff-weak'   :
        val === 0   ? 'eff-immune' :
                      'eff-normal'
      );
    });
  });
}

// ── Render: solution ──────────────────────────────────────────────────────────

/**
 * Renders the solution grid and the constraint-verification result from state.solution.
 */
function renderSolution() {
  const { solution, verified } = state.solution;
  const n = state.puzzle.n;

  dom.solutionGrid.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
  dom.solutionGrid.innerHTML = '';

  solution.forEach(row => {
    row.forEach(type => {
      const cell = document.createElement('div');
      cell.className   = 'cell solution-cell';
      cell.textContent = type;
      applyTypeStyle(cell, type);
      dom.solutionGrid.appendChild(cell);
    });
  });

  dom.verifyResult.className   = 'verify-result ' + (verified ? 'verify-ok' : 'verify-fail');
  dom.verifyResult.textContent = verified
    ? `✓  All ${n * n * 2} constraints satisfied.`
    : '✗  Verification failed — solution does not match the puzzle constraints.';
}
