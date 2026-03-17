# SuPoke — Architecture & Application Overview

SuPoke è un puzzle logico in stile Sudoku basato sulle meccaniche di efficacia dei tipi Pokémon.
Il giocatore deve disporre N tipi in una griglia N×N rispettando due regole: ogni tipo appare esattamente una volta per riga e per colonna (Latin square), e la somma dei danni inflitti/ricevuti da ogni cella corrisponde ai valori indicati nella griglia.

---

## Struttura dei file

```
supoke/
├── src/
│   ├── types.js        ← dati di base (tipi, matrice, utility)
│   ├── generator.js    ← generazione del puzzle
│   ├── solver.js       ← risoluzione e verifica
│   ├── display.js      ← output CLI
│   └── api.js          ← handler HTTP
├── public/
│   ├── index.html      ← struttura della pagina
│   ├── style.css       ← stile e layout
│   └── app.js          ← logica interattiva frontend
├── server.js           ← server HTTP Node.js
├── main.js             ← entry point CLI
└── package.json
```

---

## Grafo delle dipendenze

```
types.js
  ├──► generator.js ──┐
  ├──► solver.js    ──┼──► api.js ──► server.js
  ├──► display.js   ──┤
  └──────────────────► main.js  (CLI)
```

Nessuna dipendenza ciclica: `generator.js` e `solver.js` non si importano mai a vicenda.
L'orchestrazione (usare entrambi insieme) avviene solo in `main.js` e `api.js`.

---

## Moduli server-side

### `src/types.js` — fondamenta

Contiene tutti i dati di base condivisi dagli altri moduli.

**Esportazioni principali:**

| Simbolo | Tipo | Descrizione |
|---|---|---|
| `types` | `string[]` | I 18 tipi Pokémon nell'ordine usato come indice di colonna |
| `data` | `Object<string, number[]>` | Matrice di efficacia originale (valori: 0, 0.5, 1, 2) |
| `dataInt` | `Object<string, number[]>` | Matrice intera derivata (valori: 0, 1, 2, 4 — cioè `data × 2`) |
| `getEffectiveness(atk, def, integer?)` | `number` | Restituisce l'efficacia; usa `dataInt` per default (`integer=true`) |
| `getNeighbors(i, j, N)` | `[number,number][]` | Vicini Von Neumann validi della cella (i,j) in una griglia N×N |
| `shuffle(arr)` | `Array` | Fisher-Yates shuffle, non muta l'originale |
| `fmt(n)` | `string` | Formatta un numero: interi senza decimali, altri a 1 d.p. |

**Perché `dataInt`?**
La matrice intera elimina i valori floating-point (0.5), rendendo le somme dei vincoli numeri interi e semplificando i controlli di precisione nel solver. La matrice originale `data` è conservata come sorgente di verità.

---

### `src/generator.js` — generazione

Produce il descrittore del puzzle a partire da N.

**Pipeline:**

1. **`selectTypes(N)`** — sceglie N tipi casuali dal pool di 18 (Fisher-Yates).
2. **`generateLatinSquare(sel)`** — costruisce una griglia N×N valida tramite backtracking ricorsivo con ordine dei candidati randomizzato. Ogni tipo appare esattamente una volta per riga e per colonna.
3. **`buildSubmatrix(sel)`** — estrae la sottomatrice N×N di efficacia ristretta ai tipi selezionati. È usata solo per la visualizzazione (non dal solver).
4. **`computeConstraints(grid, N)`** — calcola i vincoli pubblici del puzzle:
   - `inflicted[i][j]` = somma di `getEffectiveness(grid[i][j], vicino)` per tutti i vicini
   - `received[i][j]`  = somma di `getEffectiveness(vicino, grid[i][j])` per tutti i vicini

Il descrittore restituito contiene `{ sel, eSub, inflicted, received }` — **mai la griglia soluzione**.

---

### `src/solver.js` — risoluzione

Opera esclusivamente sul descrittore pubblico (tipi + vincoli). Non importa `generator.js`.

**`makePruner(grid, inflicted, received, N)`** — factory privata che crea la funzione `canPlace(r,c)`.

La funzione di pruning implementa due controlli per ogni cella:

```
lower bound: somma_parziale ≤ target
upper bound: target - somma_parziale ≤ vicini_liberi × 4
```

Il valore `× 4` è il moltiplicatore massimo di `dataInt` (corrisponde a `2×` nella scala originale).
Quando tutti i vicini sono riempiti, la somma deve corrispondere esattamente (tolleranza 1e-9).

**Esportazioni:**

| Funzione | Descrizione |
|---|---|
| `solvePuzzle(sel, inflicted, received, N)` | Backtracking con pruning; restituisce la prima griglia valida o `null` |
| `countSolutions(sel, inflicted, received, N)` | Conta le soluzioni fino a 2 (early-exit a 2 per efficienza) |
| `verifySolution(solution, inflicted, received, N)` | Ricalcola i vincoli dalla soluzione e li confronta con i target |

`countSolutions` restituisce 0 (irrisolvibile), 1 (unico — accettato), o 2 (ambiguo — rigenerato).

---

### `src/display.js` — output CLI

Funzioni di rendering per il terminale. Non modifica stato. Dipende solo da `types.js`.

| Funzione | Output |
|---|---|
| `printSection(title)` | Header con doppia riga orizzontale |
| `printSubmatrix(sel, eSub)` | Tabella allineata attaccante × difensore |
| `printBoxGrid(cells, N, cellWidth)` | Griglia ASCII con bordi |

---

### `src/api.js` — handler HTTP

Separa la logica di business HTTP dal routing in `server.js`.

**`generate(body)`** — gestisce `POST /api/generate`:
1. Valida `n` ∈ {3, 4, 5}
2. Loop fino a 100 tentativi: genera + conta soluzioni
3. Restituisce il descrittore solo quando `countSolutions === 1`
4. Lancia `ApiError(500)` se non trova un puzzle unico

**`solve(body)`** — gestisce `POST /api/solve`:
1. Risolve il puzzle con `solvePuzzle`
2. Conta le soluzioni con `countSolutions`
3. Verifica la soluzione con `verifySolution`
4. Restituisce `{ solution, solutionCount, unique, verified }`

**`ApiError`** — errore con campo `.status` per propagare codici HTTP strutturati.

---

### `server.js` — server HTTP

Server Node.js puro (zero dipendenze esterne). Porta default: `3000`, configurabile via `PORT`.

**Routing:**

| Metodo | Path | Azione |
|---|---|---|
| `POST` | `/api/generate` | Chiama `generate()`, risponde JSON |
| `POST` | `/api/solve` | Chiama `solve()`, risponde JSON |
| `GET` | `/*` | Serve file statici da `./public/` |
| `OPTIONS` | `/*` | Risponde 204 (CORS preflight) |

**Sicurezza static files:** il path viene risolto con `path.resolve` e verificato che inizi con `PUBLIC_DIR` prima di leggere il file (protezione da directory traversal).

---

### `main.js` — entry point CLI

Usato per eseguire il puzzle nel terminale (`node main.js`).

**`generateUniquePuzzle(N)`** vive qui (non nel generator) per evitare una dipendenza circolare: usare generator + solver insieme richiede di importarli entrambi, e solo `main.js` lo fa.

Pipeline per ogni N:
1. Genera puzzle → verifica unicità → ripete se necessario
2. Stampa tipi, sottomatrice, griglia dei vincoli
3. Risolve → stampa soluzione
4. Verifica → stampa conferma

---

## Frontend (`public/`)

### `index.html`

Struttura della pagina:
- **Controls card** — bottoni dimensione griglia (3×3, 4×4, 5×5) + "Generate Puzzle"
- **Status bar** — messaggi di caricamento/errore/successo
- **Puzzle area** (nascosta fino alla generazione):
  - Active Types — badge colorati dei tipi attivi
  - Effectiveness Matrix — tabella collassabile (attaccante × difensore)
  - Play section — `#play-grid` + `#type-picker`
  - Action row — Reset / Show Solution / Submit Solution
  - Validation result — feedback dopo Submit
  - Solution section — griglia soluzione rivelata da "Show Solution"

---

### `style.css`

Layout a colonna centrata (max-width 860px). CSS custom properties per colori e spaziatura.

**Classi principali:**

| Classe | Descrizione |
|---|---|
| `.play-cell` | Cella interattiva della griglia di gioco |
| `.play-cell.selected` | Cella selezionata (bordo primario + sfondo chiaro) |
| `.play-cell.wrong` | Cella con errore (rosso) dopo Submit |
| `.cell-notes` | Area delle annotazioni (pencil marks) |
| `.note-chip` | Singola annotazione colorata (abbreviazione 2 caratteri) |
| `.cell-value` | Tipo assegnato o placeholder `?` |
| `.cell-constraints` | Vincoli I/R in basso nella cella |
| `.c-i` / `.c-r` | Valore inflicted (blu) / received (rosso) |
| `.type-picker` | Pannello di selezione del tipo |
| `.picker-type-btn.is-assigned` | Tipo già assegnato alla cella |
| `.picker-type-btn.is-noted` | Tipo presente nelle note della cella |
| `.progress-pill` | Contatore celle completate (diventa verde al completamento) |
| `.validation-success` / `.validation-error` | Feedback della validazione |

---

### `app.js`

Tutta la logica interattiva lato client. Nessuna libreria esterna.

**Stato centrale (`state`):**

```js
{
  n,           // dimensione griglia corrente
  puzzle,      // risposta da POST /api/generate
  userGrid,    // string|null[][] — risposte del giocatore
  notes,       // Set<string>[][] — annotazioni per cella
  selected,    // { r, c } | null
  notesMode,   // boolean
  wrongCells,  // [{ r, c }] dall'ultima validazione fallita
}
```

**Flusso principale:**

```
[Generate Puzzle]
      │
      ▼
POST /api/generate → { sel, eSub, inflicted, received, attempts }
      │
      ▼
initGameState() → renderPuzzle() → renderPlayGrid()
      │
      ▼
[Clic su cella] → selectCell(r,c) → showPicker()
      │
      ▼
[Clic su tipo] → assignType(type) → renderCell() → nextEmptyCell()
      │
      ▼
[Submit] → validateUserGrid() → highlight wrongCells
      │
      ▼
[Show Solution] → POST /api/solve → renderSolution()
```

**Validazione locale (senza round-trip API):**

`validateUserGrid()` verifica due regole direttamente nel browser:
1. **Latin square** — ogni tipo compare esattamente una volta per riga e per colonna
2. **Vincoli di somma** — per ogni cella, ricalcola `inflicted` e `received` dal grid del giocatore e li confronta con i target ricevuti dall'API

Usa `EFF_DATA` (copia locale di `dataInt`, valori interi) e `getEff()` locale, mantenendosi allineata con la scala usata dal server.

**Navigazione da tastiera:**

| Tasto | Azione |
|---|---|
| `↑ ↓ ← →` | Naviga tra le celle |
| `N` | Attiva/disattiva modalità note |
| `Del` / `Backspace` | Svuota la cella selezionata |
| `Esc` | Deseleziona |

---

## Avvio

```bash
# Server web (modalità interattiva)
node server.js          # → http://localhost:3000

# CLI (genera e risolve N=3,4,5 nel terminale)
node main.js
```

---

## API Reference

### `POST /api/generate`

**Request:**
```json
{ "n": 3 }
```

**Response 200:**
```json
{
  "n": 3,
  "sel": ["Fire", "Water", "Grass"],
  "eSub": [[2,1,4],[4,1,1],[1,4,1]],
  "inflicted": [[3,5,4],[4,3,5],[5,4,3]],
  "received":  [[3,4,5],[5,3,4],[4,5,3]],
  "attempts": 2
}
```

**Errori:** `400` se `n` non è 3, 4 o 5 — `500` se non trova un puzzle unico in 100 tentativi.

---

### `POST /api/solve`

**Request:**
```json
{
  "n": 3,
  "sel": ["Fire", "Water", "Grass"],
  "inflicted": [[3,5,4],[4,3,5],[5,4,3]],
  "received":  [[3,4,5],[5,3,4],[4,5,3]]
}
```

**Response 200:**
```json
{
  "solution": [["Fire","Water","Grass"],["Grass","Fire","Water"],["Water","Grass","Fire"]],
  "solutionCount": 1,
  "unique": true,
  "verified": true
}
```
