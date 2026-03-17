/**
 * Vercel Serverless Function — POST /api/solve
 *
 * Delegates to the existing solve() handler in src/api.js.
 * Vercel automatically parses JSON request bodies and exposes them as req.body.
 *
 * Serverless adaptation notes:
 *   - No persistent server process; each invocation is stateless.
 *   - res.status().json() is Vercel's built-in response helper.
 *   - CORS headers are set via vercel.json headers config (see project root).
 */

import { solve, ApiError } from '../src/api.js';

/**
 * @param {import('@vercel/node').VercelRequest}  req
 * @param {import('@vercel/node').VercelResponse} res
 */
export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = solve(req.body);
    res.status(200).json(result);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    res.status(status).json({ error: err.message });
  }
}
