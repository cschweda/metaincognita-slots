#!/usr/bin/env node
// Serve dist/ EXACTLY as Netlify would: static files plus every header from
// the generated dist/_headers (first matching rule wins per header), real 404s
// via dist/404.html. `pnpm dev`/`pnpm preview` do NOT apply _headers, which
// once hid two production CSP bugs — smoke-test the CSP here before deploying:
//
//   pnpm generate && pnpm smoke   →  http://localhost:8788
//
// No dependencies, no config. PORT env overrides the port.

import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const DIST = new URL('../dist/', import.meta.url).pathname
const PORT = Number(process.env.PORT ?? 8788)

if (!existsSync(path.join(DIST, 'index.html'))) {
  console.error('ERROR: dist/index.html not found. Run `pnpm generate` first.')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Parse dist/_headers (Netlify format): unindented `/path` lines open a rule,
// indented `Header: value` lines belong to the last opened rule.
// ---------------------------------------------------------------------------
/** @type {{ pattern: RegExp, headers: [string, string][] }[]} */
const rules = []
const headersFile = path.join(DIST, '_headers')
if (existsSync(headersFile)) {
  let current = null
  for (const raw of readFileSync(headersFile, 'utf8').split('\n')) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue
    if (!/^\s/.test(raw)) {
      // `/*` and trailing `/*` splats are all this project uses.
      const escaped = raw.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
      current = { pattern: new RegExp(`^${escaped}$`), headers: [] }
      rules.push(current)
      continue
    }
    const idx = raw.indexOf(':')
    if (current !== null && idx > 0) {
      current.headers.push([raw.slice(0, idx).trim(), raw.slice(idx + 1).trim()])
    }
  }
}

/** First matching rule wins per header name, like Netlify. */
function headersFor(urlPath) {
  const out = new Map()
  for (const rule of rules) {
    if (!rule.pattern.test(urlPath)) continue
    for (const [name, value] of rule.headers) {
      const key = name.toLowerCase()
      if (!out.has(key)) out.set(key, [name, value])
    }
  }
  return [...out.values()]
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.map': 'application/json',
  '.wasm': 'application/wasm'
}

function resolveFile(urlPath) {
  const clean = path.posix.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.\/?)+/, '')
  let file = path.join(DIST, clean)
  if (!file.startsWith(DIST)) return null // traversal guard
  if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html')
  if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`
  return existsSync(file) && statSync(file).isFile() ? file : null
}

createServer((req, res) => {
  const urlPath = new URL(req.url ?? '/', 'http://localhost').pathname
  const file = resolveFile(urlPath)
  const notFound = path.join(DIST, '404.html')
  const target = file ?? (existsSync(notFound) ? notFound : null)

  for (const [name, value] of headersFor(urlPath)) res.setHeader(name, value)

  if (target === null) {
    res.statusCode = 404
    res.end('404')
    return
  }
  res.statusCode = file === null ? 404 : 200
  res.setHeader('Content-Type', TYPES[path.extname(target)] ?? 'application/octet-stream')
  res.end(readFileSync(target))
}).listen(PORT, () => {
  console.log(`Smoke server (Netlify _headers applied): http://localhost:${PORT}`)
  console.log(`${rules.length} header rule(s) loaded from dist/_headers — Ctrl+C to stop.`)
})
