/**
 * SuPoke — Interactive frontend application.
 *
 * Handles the full user-facing puzzle experience: grid generation, cell
 * interaction, type picker, notes mode, keyboard navigation, local
 * validation, and solution reveal.
 *
 * No external libraries used. Loaded at the bottom of index.html so all
 * DOM elements are immediately available.
 */

// ── Type data (duplicated from server for local validation) ───────────────────

const ALL_TYPES = [
  'Normal','Fighting','Flying','Poison','Ground','Rock','Bug','Ghost','Steel',
  'Fire','Water','Grass','Electric','Psychic','Ice','Dragon','Dark','Fairy'
];

// Row = attacker, columns match ALL_TYPES order above.
// Kept as the ×2 integer-scaled mirror of dataInt in src/types.js.
// Values: 0→immune, 1→½×, 2→1×, 4→2×.
// EFF_DATA (real values) is derived below — never edit this manually.
const EFF_DATA_INT = {
  Normal:   [2,2,2,2,2,1,2,0,1,2,2,2,2,2,2,2,2,2],
  Fighting: [4,2,1,1,2,4,1,0,4,2,2,2,2,1,4,2,4,1],
  Flying:   [2,4,2,2,2,1,4,2,1,2,2,4,1,2,2,2,2,2],
  Poison:   [2,2,2,1,1,1,2,1,0,2,2,4,2,2,2,2,2,4],
  Ground:   [2,2,0,4,2,4,1,2,4,4,2,1,4,2,2,2,2,2],
  Rock:     [2,1,4,2,1,2,4,2,1,4,2,2,2,2,4,2,2,2],
  Bug:      [2,1,1,1,2,2,2,1,1,1,2,4,2,4,2,2,4,1],
  Ghost:    [0,2,2,2,2,2,2,4,2,2,2,2,2,4,2,2,1,0],
  Steel:    [2,2,2,2,2,4,2,2,1,1,1,2,1,2,4,2,2,4],
  Fire:     [2,2,2,2,2,1,4,2,4,1,1,4,2,2,4,1,2,2],
  Water:    [2,2,2,2,4,4,2,2,2,4,1,1,2,2,2,1,2,2],
  Grass:    [2,2,1,1,4,4,1,2,1,1,4,1,2,2,2,1,2,2],
  Electric: [2,2,4,2,0,2,2,2,2,2,4,1,1,2,2,1,2,2],
  Psychic:  [2,4,2,4,2,2,2,2,1,2,2,2,2,1,2,2,0,2],
  Ice:      [2,2,4,2,4,2,2,2,1,1,1,4,2,2,1,4,2,2],
  Dragon:   [2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,4,2,0],
  Dark:     [2,1,2,2,2,2,2,4,2,2,2,2,2,4,2,2,1,1],
  Fairy:    [2,4,2,1,2,2,2,2,1,1,2,2,2,2,2,4,4,2],
};

/**
 * Real effectiveness values (0, 0.5, 1, 2) derived programmatically by
 * halving every integer in EFF_DATA_INT. This is the canonical Pokémon
 * multiplier scale used for all frontend computation and display.
 */
const EFF_DATA = Object.fromEntries(
  Object.entries(EFF_DATA_INT).map(([type, row]) => [type, row.map(v => v / 2)])
);

function getEff(atk, def) {
  return EFF_DATA[atk][ALL_TYPES.indexOf(def)];
}

// 8-directional (Moore) adjacency — must stay in sync with DIRS in src/types.js.
function getNeighbors(i, j, N) {
  return [
    [-1,-1],[-1,0],[-1,1],
    [ 0,-1],       [ 0,1],
    [ 1,-1],[ 1,0],[ 1,1],
  ]
    .map(([di,dj]) => [i+di, j+dj])
    .filter(([ni,nj]) => ni >= 0 && ni < N && nj >= 0 && nj < N);
}

// ── Visual maps ───────────────────────────────────────────────────────────────

/**
 * 3-char uppercase abbreviations for note chips.
 * Kept distinct from each other and from the ▲/▼ constraint labels
 * to avoid confusion on small mobile screens.
 */
const TYPE_ABBR = {
  Normal:'NRM', Fighting:'FGT', Flying:'FLY', Poison:'PSN', Ground:'GRD',
  Rock:'ROK', Bug:'BUG', Ghost:'GHO', Steel:'STL', Fire:'FIR',
  Water:'WAT', Grass:'GRS', Electric:'ELC', Psychic:'PSY', Ice:'ICE',
  Dragon:'DRG', Dark:'DRK', Fairy:'FAI',
};

const TYPE_COLORS = {
  Normal:   { bg:'#A8A878', text:'#fff' },
  Fighting: { bg:'#C03028', text:'#fff' },
  Flying:   { bg:'#A890F0', text:'#fff' },
  Poison:   { bg:'#A040A0', text:'#fff' },
  Ground:   { bg:'#E0C068', text:'#333' },
  Rock:     { bg:'#B8A038', text:'#fff' },
  Bug:      { bg:'#A8B820', text:'#fff' },
  Ghost:    { bg:'#705898', text:'#fff' },
  Steel:    { bg:'#B8B8D0', text:'#333' },
  Fire:     { bg:'#F08030', text:'#fff' },
  Water:    { bg:'#6890F0', text:'#fff' },
  Grass:    { bg:'#78C850', text:'#fff' },
  Electric: { bg:'#F8D030', text:'#333' },
  Psychic:  { bg:'#F85888', text:'#fff' },
  Ice:      { bg:'#98D8D8', text:'#333' },
  Dragon:   { bg:'#7038F8', text:'#fff' },
  Dark:     { bg:'#705848', text:'#fff' },
  Fairy:    { bg:'#EE99AC', text:'#333' },
};

function typeColor(type) {
  return TYPE_COLORS[type] ?? { bg:'#888', text:'#fff' };
}

function applyTypeStyle(el, type) {
  const { bg, text } = typeColor(type);
  el.style.backgroundColor = bg;
  el.style.color = text;
}

/**
 * Formats a real effectiveness value or constraint sum for display.
 * Whole numbers render without a decimal; halves use the ½ glyph.
 *   0   → "0"
 *   0.5 → "½"
 *   1   → "1"
 *   1.5 → "1½"
 *   2   → "2"
 * All expected values in this game are multiples of 0.5, so this covers
 * every case without needing a general decimal formatter.
 */
function formatHalfNumber(n) {
  if (n % 1 === 0) return String(n);           // integer: no decimal needed
  const whole = Math.floor(n);
  return whole === 0 ? '½' : `${whole}½`;      // e.g. 0.5→"½", 1.5→"1½"
}

// ── Server data normalisation ─────────────────────────────────────────────────

/**
 * Converts server puzzle data from ×2 integer scaling to real effectiveness
 * values (0, 0.5, 1, 2). The server uses integer scaling internally
 * (src/types.js dataInt) to avoid floating-point drift in the solver; we
 * divide by 2 exactly once at the API boundary so the rest of the frontend
 * always works with canonical Pokémon multipliers.
 *
 * Mutates the puzzle object in place and returns it for chaining.
 * @param {object} puzzle - Raw response from POST /api/generate.
 * @returns {object} The same puzzle with eSub, inflicted, received halved.
 */
function normalizePuzzle(puzzle) {
  // Keep a copy of the raw ×2 integer arrays BEFORE dividing.
  // These are sent as-is to /api/solve so the server solver always
  // receives values in the same scale it uses internally.
  puzzle._rawInflicted = puzzle.inflicted.map(row => [...row]);
  puzzle._rawReceived  = puzzle.received.map(row => [...row]);

  // Convert to real values (0, 0.5, 1, 2) for display and local validation.
  puzzle.eSub      = puzzle.eSub.map(row => row.map(v => v / 2));
  puzzle.inflicted = puzzle.inflicted.map(row => row.map(v => v / 2));
  puzzle.received  = puzzle.received.map(row => row.map(v => v / 2));
  return puzzle;
}

// ── Application state ─────────────────────────────────────────────────────────

const state = {
  n:               3,
  puzzle:          null,   // Response from POST /api/generate
  userGrid:        null,   // string|null[][]  — player's answers
  notes:           null,   // Set<string>[][]  — pencil marks per cell
  selected:        null,   // { r, c } or null
  notesMode:       false,
  wrongCells:      [],     // [{ r, c }] from last failed validation
};

function initGameState() {
  const n = state.puzzle.n;
  state.userGrid   = Array.from({length:n}, () => Array(n).fill(null));
  state.notes      = Array.from({length:n}, () => Array.from({length:n}, () => new Set()));
  state.selected   = null;
  state.notesMode  = false;
  state.wrongCells = [];
}

// ── DOM references ────────────────────────────────────────────────────────────

const dom = {
  generateBtn:      document.getElementById('generate-btn'),
  status:           document.getElementById('status'),
  puzzleArea:       document.getElementById('puzzle-area'),
  typesDisplay:     document.getElementById('types-display'),
  matrixToggle:     document.getElementById('matrix-toggle'),
  matrixContent:    document.getElementById('matrix-content'),
  effMatrix:        document.getElementById('eff-matrix'),
  playGrid:         document.getElementById('play-grid'),
  typePicker:       document.getElementById('type-picker'),
  pickerTypes:      document.getElementById('picker-types'),
  pickerLabel:      document.getElementById('picker-label'),
  notesToggle:      document.getElementById('notes-toggle'),
  clearBtn:         document.getElementById('clear-btn'),
  resetBtn:         document.getElementById('reset-btn'),
  showSolutionBtn:  document.getElementById('show-solution-btn'),
  submitBtn:        document.getElementById('submit-btn'),
  progress:         document.getElementById('progress'),
  validationResult: document.getElementById('validation-result'),
  solutionSection:  document.getElementById('solution-section'),
  solutionGrid:     document.getElementById('solution-grid'),
  verifyResult:     document.getElementById('verify-result'),
};

// ── Status bar ────────────────────────────────────────────────────────────────

function setStatus(kind, message = '') {
  dom.status.className = 'status-bar' + (kind ? ` status-${kind}` : '');
  dom.status.innerHTML = kind === 'loading'
    ? `<span class="spinner" aria-hidden="true"></span>${message}`
    : message;
}

// ── Cell selection ────────────────────────────────────────────────────────────

function selectCell(r, c) {
  state.selected = { r, c };
  state.wrongCells = [];
  dom.validationResult.hidden = true;
  renderAllCells();
  showPicker();
  updateClearBtn();
}

function deselectCell() {
  state.selected = null;
  renderAllCells();
  hidePicker();
}

// ── Type assignment ───────────────────────────────────────────────────────────

function assignType(type) {
  const { r, c } = state.selected;
  if (state.notesMode) {
    const noteSet = state.notes[r][c];
    if (noteSet.has(type)) noteSet.delete(type);
    else noteSet.add(type);
    renderCell(r, c);
    renderPicker();
    return;
  }
  // Normal mode — assign and clear notes for this cell
  state.userGrid[r][c] = type;
  state.notes[r][c].clear();
  renderCell(r, c);
  updateProgress();
  updateSubmitButton();

  // Auto-advance to next empty cell
  const next = nextEmptyCell(r, c);
  if (next) {
    selectCell(next.r, next.c);
  } else {
    renderPicker();
    updateClearBtn();
  }
}

function clearSelectedCell() {
  if (!state.selected) return;
  const { r, c } = state.selected;
  state.userGrid[r][c] = null;
  state.notes[r][c].clear();
  renderCell(r, c);
  renderPicker();
  updateProgress();
  updateSubmitButton();
  updateClearBtn();
}

// ── Notes mode ────────────────────────────────────────────────────────────────

function toggleNotesMode() {
  state.notesMode = !state.notesMode;
  dom.notesToggle.classList.toggle('active', state.notesMode);
  if (state.selected) renderPicker();
}

// ── Keyboard navigation ───────────────────────────────────────────────────────

function navigateCell(dr, dc) {
  const N = state.puzzle.n;
  const { r, c } = state.selected ?? { r: 0, c: -1 };
  const nr = Math.max(0, Math.min(N - 1, r + dr));
  const nc = Math.max(0, Math.min(N - 1, c + dc));
  selectCell(nr, nc);
}

/** Returns the next cell with no assigned type after (r, c) in row-major order. */
function nextEmptyCell(r, c) {
  const N = state.puzzle.n;
  let pos = r * N + c + 1;
  while (pos < N * N) {
    const nr = Math.floor(pos / N), nc = pos % N;
    if (state.userGrid[nr][nc] === null) return { r: nr, c: nc };
    pos++;
  }
  return null;
}

// ── Progress & submit state ───────────────────────────────────────────────────

function isGridComplete() {
  return state.userGrid.every(row => row.every(v => v !== null));
}

function updateProgress() {
  const N = state.puzzle.n;
  const filled = state.userGrid.flat().filter(v => v !== null).length;
  const total  = N * N;
  dom.progress.textContent = `${filled} / ${total}`;
  dom.progress.classList.toggle('complete', filled === total);
}

function updateSubmitButton() {
  dom.submitBtn.disabled = !isGridComplete();
}

function updateClearBtn() {
  if (!state.selected) { dom.clearBtn.disabled = true; return; }
  const { r, c } = state.selected;
  dom.clearBtn.disabled =
    state.userGrid[r][c] === null && state.notes[r][c].size === 0;
}

// ── Local validation ──────────────────────────────────────────────────────────

/**
 * Validates the completed user grid against the Latin-square and
 * constraint-sum rules without hitting the server.
 * @returns {{ valid: boolean, wrongCells: {r:number,c:number}[], message: string }}
 */
function validateUserGrid() {
  const { sel, inflicted, received, n } = state.puzzle;
  const grid   = state.userGrid;
  const wrong  = new Set();

  // Latin square: each type appears exactly once per row and column
  for (let i = 0; i < n; i++) {
    const rowSeen = new Map(), colSeen = new Map();
    for (let j = 0; j < n; j++) {
      const rv = grid[i][j], cv = grid[j][i];
      if (rowSeen.has(rv)) { wrong.add(`${i},${rowSeen.get(rv)}`); wrong.add(`${i},${j}`); }
      else rowSeen.set(rv, j);
      if (colSeen.has(cv)) { wrong.add(`${colSeen.get(cv)},${i}`); wrong.add(`${j},${i}`); }
      else colSeen.set(cv, j);
    }
  }

  // Constraint sums
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let inf = 0, rec = 0;
      for (const [ni, nj] of getNeighbors(i, j, n)) {
        inf += getEff(grid[i][j], grid[ni][nj]);
        rec += getEff(grid[ni][nj], grid[i][j]);
      }
      if (Math.abs(inf - inflicted[i][j]) > 1e-9 || Math.abs(rec - received[i][j]) > 1e-9) {
        wrong.add(`${i},${j}`);
      }
    }
  }

  const wrongCells = [...wrong].map(k => {
    const [r,c] = k.split(',').map(Number);
    return { r, c };
  });

  const valid = wrongCells.length === 0;
  const message = valid
    ? `Correct! All ${n*n} cells placed and all constraints satisfied.`
    : `${wrongCells.length} cell${wrongCells.length > 1 ? 's' : ''} violated the rules — highlighted in red.`;

  return { valid, wrongCells, message };
}

// ── Render: full puzzle ───────────────────────────────────────────────────────

function renderPuzzle() {
  const { sel, eSub } = state.puzzle;

  // Type badges
  dom.typesDisplay.innerHTML = '';
  for (const type of sel) {
    const badge = document.createElement('span');
    badge.className   = 'type-badge';
    badge.textContent = type;
    applyTypeStyle(badge, type);
    dom.typesDisplay.appendChild(badge);
  }

  renderMatrix(sel, eSub);
  renderPlayGrid();
  updateProgress();
  updateSubmitButton();
  hidePicker();

  dom.validationResult.hidden = true;
  dom.solutionSection.hidden  = true;
}

// ── Render: play grid ─────────────────────────────────────────────────────────

function renderPlayGrid() {
  const { n, inflicted, received } = state.puzzle;
  dom.playGrid.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
  dom.playGrid.innerHTML = '';

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const cell = document.createElement('div');
      cell.className = 'play-cell';
      cell.dataset.r = r;
      cell.dataset.c = c;
      // Top row: attack number left, notes fill the remaining space right.
      // Bottom row: defense number aligned to the right corner.
      // Both numbers are in-flow, so notes can never overlap the attack value.
      cell.innerHTML =
        `<div class="cell-top-row">` +
          `<span class="c-i" title="Inflicted (damage dealt out)">${formatHalfNumber(inflicted[r][c])}</span>` +
          `<div class="cell-notes"></div>` +
        `</div>` +
        `<div class="cell-value"></div>` +
        `<div class="cell-bottom-row">` +
          `<span class="c-r" title="Received (damage taken in)">${formatHalfNumber(received[r][c])}</span>` +
        `</div>`;
      cell.addEventListener('click', () => {
        if (state.selected?.r === r && state.selected?.c === c) deselectCell();
        else selectCell(r, c);
      });
      dom.playGrid.appendChild(cell);
    }
  }
}

function renderAllCells() {
  const { n } = state.puzzle;
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      renderCell(r, c);
}

/**
 * Re-renders a single play cell's contents and CSS state classes.
 */
function renderCell(r, c) {
  const cell = dom.playGrid.querySelector(`[data-r="${r}"][data-c="${c}"]`);
  if (!cell) return;

  const type     = state.userGrid[r][c];
  const noteSet  = state.notes[r][c];
  const isSel    = state.selected?.r === r && state.selected?.c === c;
  const isWrong  = state.wrongCells.some(w => w.r === r && w.c === c);

  // Notes area
  const notesEl = cell.querySelector('.cell-notes');
  notesEl.innerHTML = '';
  for (const t of noteSet) {
    const chip = document.createElement('span');
    chip.className   = 'note-chip';
    chip.textContent = TYPE_ABBR[t] ?? t.slice(0, 2);
    applyTypeStyle(chip, t);
    notesEl.appendChild(chip);
  }

  // Main value
  const valueEl = cell.querySelector('.cell-value');
  valueEl.innerHTML = '';
  if (type) {
    const badge = document.createElement('span');
    badge.className   = 'cell-type-name';
    badge.textContent = type;
    applyTypeStyle(badge, type);
    valueEl.appendChild(badge);
  } else {
    const ph = document.createElement('span');
    ph.className   = 'cell-placeholder';
    ph.textContent = '?';
    valueEl.appendChild(ph);
  }

  // CSS state
  cell.classList.toggle('selected', isSel);
  cell.classList.toggle('wrong',    isWrong && !isSel);
}

// ── Render: type picker ───────────────────────────────────────────────────────

function showPicker() {
  const { r, c } = state.selected;
  dom.pickerLabel.textContent = `Row ${r + 1}, Col ${c + 1}`;
  renderPicker();
  dom.typePicker.hidden = false;
}

function hidePicker() {
  dom.typePicker.hidden = true;
}

function renderPicker() {
  if (!state.selected) return;
  const { r, c }  = state.selected;
  const sel        = state.puzzle.sel;
  const assigned   = state.userGrid[r][c];
  const noteSet    = state.notes[r][c];

  dom.pickerTypes.innerHTML = '';
  for (const type of sel) {
    const btn = document.createElement('button');
    btn.type      = 'button';  // prevent accidental form submission
    btn.className = 'picker-type-btn';
    btn.textContent = type;
    applyTypeStyle(btn, type);

    if (state.notesMode) {
      if (noteSet.has(type)) btn.classList.add('is-noted');
    } else {
      if (assigned === type) btn.classList.add('is-assigned');
    }

    btn.addEventListener('click', e => {
      e.stopPropagation();
      assignType(type);
    });
    dom.pickerTypes.appendChild(btn);
  }
}

// ── Render: effectiveness matrix ──────────────────────────────────────────────

function renderMatrix(sel, eSub) {
  dom.effMatrix.innerHTML = '';

  const head   = dom.effMatrix.insertRow();
  const corner = head.insertCell();
  corner.textContent = 'ATK \\ DEF';
  corner.className   = 'matrix-corner';

  for (const type of sel) {
    const th = head.insertCell();
    th.textContent = type;
    th.className   = 'matrix-header';
    applyTypeStyle(th, type);
  }

  eSub.forEach((row, i) => {
    const tr    = dom.effMatrix.insertRow();
    const label = tr.insertCell();
    label.textContent = sel[i];
    label.className   = 'matrix-row-label';
    applyTypeStyle(label, sel[i]);

    row.forEach(val => {
      const td = tr.insertCell();
      // eSub values are now real floats (0, 0.5, 1, 2) after normalizePuzzle.
      // Strict equality is safe: each value is an exact IEEE-754 float
      // produced by dividing a small integer by 2.
      td.textContent = formatHalfNumber(val);
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

function renderSolution(solution) {
  const { n } = state.puzzle;
  dom.solutionGrid.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
  dom.solutionGrid.innerHTML = '';

  for (const row of solution) {
    for (const type of row) {
      const cell = document.createElement('div');
      cell.className   = 'cell solution-cell';
      cell.textContent = type;
      applyTypeStyle(cell, type);
      dom.solutionGrid.appendChild(cell);
    }
  }
}

// ── Reset ─────────────────────────────────────────────────────────────────────

function resetGame() {
  initGameState();
  renderPlayGrid();
  hidePicker();
  updateProgress();
  updateSubmitButton();
  dom.validationResult.hidden = true;
  dom.solutionSection.hidden  = true;
  setStatus('');
}

// ── Event handlers ────────────────────────────────────────────────────────────

// Grid-size buttons
document.querySelectorAll('.size-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.n = parseInt(btn.dataset.n, 10);
    state.puzzle = null;
    dom.puzzleArea.hidden = true;
    setStatus('');
  });
});

// Generate
dom.generateBtn.addEventListener('click', async () => {
  dom.generateBtn.disabled    = true;
  dom.generateBtn.textContent = 'Generating…';
  dom.puzzleArea.hidden       = true;
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
    // Normalise: convert server's ×2 integer-scaled values to real floats
    state.puzzle = normalizePuzzle(await res.json());
    const a = state.puzzle.attempts;
    setStatus('success', `Unique puzzle generated in ${a} attempt${a === 1 ? '' : 's'}.`);
    initGameState();
    renderPuzzle();
    dom.puzzleArea.hidden = false;
  } catch (err) {
    setStatus('error', err.message);
  } finally {
    dom.generateBtn.disabled    = false;
    dom.generateBtn.textContent = 'Generate Puzzle';
  }
});

// Reset — require confirmation to prevent accidental progress loss
dom.resetBtn.addEventListener('click', () => {
  if (!confirm('Reset the board? Your progress will be lost.')) return;
  resetGame();
});

// Submit
dom.submitBtn.addEventListener('click', () => {
  const result = validateUserGrid();
  state.wrongCells = result.wrongCells;
  renderAllCells();

  dom.validationResult.hidden    = false;
  dom.validationResult.className = 'validation-result ' +
    (result.valid ? 'validation-success' : 'validation-error');
  dom.validationResult.textContent = result.message;

  if (!result.valid)
    dom.validationResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

// Show Solution — calls POST /api/solve
dom.showSolutionBtn.addEventListener('click', async () => {
  if (!state.puzzle) return;
  dom.showSolutionBtn.disabled    = true;
  dom.showSolutionBtn.textContent = 'Solving…';
  setStatus('loading', 'Solving puzzle…');

  try {
    const { sel, n, _rawInflicted: inflicted, _rawReceived: received } = state.puzzle;
    // Send the original ×2 integer-scaled arrays (saved by normalizePuzzle).
    // The server solver uses getEffectiveness(integer=true) so its sums are
    // in the same scale — no conversion needed here.
    const res = await fetch('/api/solve', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ sel, inflicted, received, n }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `Server error ${res.status}`);
    }
    const data = await res.json();
    const label = data.unique ? 'Unique solution found.' : 'Multiple solutions detected.';
    setStatus('success', label);
    renderSolution(data.solution);

    dom.verifyResult.className   = 'verify-result ' + (data.verified ? 'verify-ok' : 'verify-fail');
    dom.verifyResult.textContent = data.verified
      ? `✓  All constraints satisfied.`
      : '✗  Verification failed.';
    dom.solutionSection.hidden = false;
    dom.solutionSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    setStatus('error', err.message);
  } finally {
    dom.showSolutionBtn.disabled    = false;
    dom.showSolutionBtn.textContent = 'Show Solution';
  }
});

// Notes toggle
dom.notesToggle.addEventListener('click', toggleNotesMode);

// Clear cell
dom.clearBtn.addEventListener('click', clearSelectedCell);

// Effectiveness matrix collapsible
dom.matrixToggle.addEventListener('click', () => {
  const expanded = dom.matrixToggle.getAttribute('aria-expanded') === 'true';
  dom.matrixToggle.setAttribute('aria-expanded', String(!expanded));
  dom.matrixContent.hidden = expanded;
  dom.matrixToggle.querySelector('.chevron').style.transform =
    expanded ? '' : 'rotate(90deg)';
});

// ── Keyboard navigation ───────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (!state.puzzle) return;

  // Escape — deselect
  if (e.key === 'Escape') { deselectCell(); return; }

  // Arrow keys — navigate (or select [0,0] if nothing selected)
  const arrows = { ArrowUp:[-1,0], ArrowDown:[1,0], ArrowLeft:[0,-1], ArrowRight:[0,1] };
  if (arrows[e.key]) {
    e.preventDefault();
    if (!state.selected) { selectCell(0, 0); return; }
    const [dr, dc] = arrows[e.key];
    navigateCell(dr, dc);
    return;
  }

  if (!state.selected) return;

  // N — toggle notes mode
  if (e.key === 'n' || e.key === 'N') { toggleNotesMode(); return; }

  // Delete / Backspace — clear cell
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    clearSelectedCell();
    return;
  }
});

// ── Click outside grid — deselect ────────────────────────────────────────────

document.addEventListener('click', e => {
  if (!state.selected) return;
  if (dom.playGrid.contains(e.target)) return;
  if (dom.typePicker.contains(e.target)) return;
  deselectCell();
});

// ── Theme toggle ──────────────────────────────────────────────────────────────

const themeBtn = document.getElementById('theme-toggle');

/** Applies `dark` (boolean) to <body> and keeps the button icon in sync. */
function applyTheme(dark) {
  document.body.classList.toggle('dark', dark);
  themeBtn.textContent  = dark ? '☀️' : '🌙';
  themeBtn.title        = dark ? 'Switch to light mode' : 'Switch to dark mode';
  themeBtn.setAttribute('aria-label', themeBtn.title);
}

// Initialise: stored preference → system preference → light
const storedTheme  = localStorage.getItem('theme');
const systemDark   = window.matchMedia('(prefers-color-scheme: dark)').matches;
applyTheme(storedTheme === 'dark' || (storedTheme === null && systemDark));

themeBtn.addEventListener('click', () => {
  const dark = !document.body.classList.contains('dark');
  applyTheme(dark);
  localStorage.setItem('theme', dark ? 'dark' : 'light');
});

// Keep in sync if the user changes their OS theme while the page is open
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
  if (localStorage.getItem('theme') === null) applyTheme(e.matches);
});
