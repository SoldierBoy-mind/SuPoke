/**
 * @module api
 *
 * HTTP API request handlers for SuPoke.
 * Each exported function maps to one API endpoint. Handlers are pure
 * business-logic functions: they receive a parsed request body, call into
 * the generator and solver modules, and return a plain object that the
 * server will serialise as JSON.
 *
 * Keeping handlers here — rather than inline in server.js — separates HTTP
 * concerns (routing, body parsing, response writing) from game-logic concerns
 * (generation, solving, uniqueness).
 *
 * Dependency graph position:
 *   generator.js ──┐
 *   solver.js    ──┼──► api.js ──► server.js
 */

import {
  selectTypes,
  generateLatinSquare,
  buildSubmatrix,
  computeConstraints,
} from './generator.js';

import { solvePuzzle, countSolutions, verifySolution } from './solver.js';

// ── Custom error ──────────────────────────────────────────────────────────────

/**
 * An error that carries an HTTP status code so the server can forward it
 * directly to the client without exposing internal stack traces.
 */
export class ApiError extends Error {
  /**
   * @param {number} status  - HTTP status code (e.g. 400, 500).
   * @param {string} message - Human-readable error description.
   */
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum number of generation attempts before giving up. */
const MAX_GENERATION_ATTEMPTS = 100;

/** Valid grid sizes accepted by the API. */
const VALID_SIZES = new Set([3, 4, 5]);

// ── Handlers ──────────────────────────────────────────────────────────────────

/**
 * Handles POST /api/generate.
 *
 * Generates a random puzzle of size N that is guaranteed to have exactly one
 * valid solution. Retries up to MAX_GENERATION_ATTEMPTS times if a candidate
 * turns out to be ambiguous or unsolvable.
 *
 * @param {{ n: number }} body - Parsed request body.
 * @returns {{ n: number, sel: string[], eSub: number[][], inflicted: number[][],
 *             received: number[][], attempts: number }}
 *   A fully validated puzzle descriptor ready for the client to display.
 * @throws {ApiError} 400 if `n` is not 3, 4, or 5.
 * @throws {ApiError} 500 if a unique puzzle cannot be found within the attempt limit.
 */
export function generate(body) {
  const n = body?.n;

  if (!Number.isInteger(n) || !VALID_SIZES.has(n)) {
    throw new ApiError(400, 'n must be an integer: 3, 4, or 5.');
  }

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
    const sel          = selectTypes(n);
    const solutionGrid = generateLatinSquare(sel);
    const eSub         = buildSubmatrix(sel);
    const { inflicted, received } = computeConstraints(solutionGrid, n);

    const count = countSolutions(sel, inflicted, received, n);

    if (count === 1) {
      // Return the descriptor without the solution — the client must solve it.
      return { n, sel, eSub, inflicted, received, attempts: attempt };
    }
  }

  throw new ApiError(
    500,
    `Could not generate a unique puzzle for N=${n} after ${MAX_GENERATION_ATTEMPTS} attempts.`
  );
}

/**
 * Handles POST /api/solve.
 *
 * Receives a puzzle descriptor (types + constraint arrays), finds a solution
 * via backtracking, counts solutions to confirm uniqueness, and independently
 * verifies the solution against the original constraints.
 *
 * @param {{ sel: string[], inflicted: number[][], received: number[][], n: number }} body
 *   Parsed request body.
 * @returns {{ solution: (string[][]|null), solutionCount: number,
 *             unique: boolean, verified: boolean }}
 * @throws {ApiError} 400 if any required field is missing or has the wrong type.
 */
export function solve(body) {
  const { sel, inflicted, received, n } = body ?? {};

  if (!Array.isArray(sel) || !Array.isArray(inflicted) ||
      !Array.isArray(received) || !Number.isInteger(n)) {
    throw new ApiError(400, 'Request body must include: sel (array), inflicted (array), received (array), n (integer).');
  }

  const solution      = solvePuzzle(sel, inflicted, received, n);
  const solutionCount = countSolutions(sel, inflicted, received, n);
  const verified      = solution ? verifySolution(solution, inflicted, received, n) : false;

  return {
    solution,
    solutionCount,
    unique:   solutionCount === 1,
    verified,
  };
}
