/**
 * SuPoke — HTTP server.
 *
 * Responsibilities:
 *   - Serve static files from ./public/
 *   - Route POST /api/generate and POST /api/solve to the API handlers
 *   - Parse JSON request bodies and serialise JSON responses
 *   - Return structured error responses
 *
 * Intentionally uses only Node.js built-in modules (http, fs, path, url)
 * so the project has zero runtime dependencies.
 */

import http            from 'http';
import fs              from 'fs';
import path            from 'path';
import { fileURLToPath } from 'url';

import { generate, solve, ApiError } from './src/api.js';

// ── Configuration ─────────────────────────────────────────────────────────────

const PORT       = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, 'public');

/** Maps file extensions to MIME types for static-file responses. */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.ico':  'image/x-icon',
};

// ── HTTP helpers ──────────────────────────────────────────────────────────────

/**
 * Reads the request body and parses it as JSON.
 * Resolves with an empty object on parse failure so handlers can validate
 * and return a proper 400 instead of crashing.
 * @param {http.IncomingMessage} req
 * @returns {Promise<object>}
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end',  ()    => {
      try { resolve(JSON.parse(raw)); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

/**
 * Writes a JSON response.
 * @param {http.ServerResponse} res
 * @param {number}              status - HTTP status code.
 * @param {object}              body   - Value to serialise.
 */
function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type':   'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

/**
 * Serves a file from the public directory.
 * Prevents directory-traversal attacks by resolving the path and confirming
 * it starts with PUBLIC_DIR before reading.
 * @param {http.ServerResponse} res
 * @param {string}              urlPath - URL path component (e.g. '/style.css').
 */
function serveStatic(res, urlPath) {
  const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, '');
  const filePath = path.resolve(PUBLIC_DIR, relative);

  // Reject any path that escapes the public directory.
  if (!filePath.startsWith(PUBLIC_DIR + path.sep) && filePath !== PUBLIC_DIR) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const mime = MIME[path.extname(filePath)] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

// ── Request handler ───────────────────────────────────────────────────────────

/**
 * Main request dispatcher.
 * API routes are matched first; everything else is treated as a static-file request.
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse}  res
 */
async function handleRequest(req, res) {
  const { method, url } = req;

  // Shared CORS headers — safe for local development.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ── API routes ────────────────────────────────────────────────────────────

  if (method === 'POST' && url === '/api/generate') {
    try {
      const body   = await readBody(req);
      const result = generate(body);
      sendJson(res, 200, result);
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 500;
      sendJson(res, status, { error: err.message });
    }
    return;
  }

  if (method === 'POST' && url === '/api/solve') {
    try {
      const body   = await readBody(req);
      const result = solve(body);
      sendJson(res, 200, result);
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 500;
      sendJson(res, status, { error: err.message });
    }
    return;
  }

  // ── Static files ──────────────────────────────────────────────────────────

  if (method === 'GET') {
    serveStatic(res, url);
    return;
  }

  res.writeHead(405, { 'Content-Type': 'text/plain' });
  res.end('Method not allowed');
}

// ── Start server ──────────────────────────────────────────────────────────────

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`SuPoke server running → http://localhost:${PORT}`);
});
