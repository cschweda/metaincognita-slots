#!/usr/bin/env node
// Post-build script: computes sha256 hashes of all inline <script> blocks in
// dist/**/*.html and writes dist/_headers with a hardened CSP that hash-pins
// them (no 'unsafe-inline').  Nuxt/Nitro already writes dist/_headers for
// cache directives; we APPEND our /* block after those entries so they coexist.

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { glob } from 'node:fs/promises'
import path from 'node:path'

const DIST = new URL('../dist/', import.meta.url).pathname

// ---------------------------------------------------------------------------
// 1. Collect all inline <script> text content from dist/**/*.html
// ---------------------------------------------------------------------------
const htmlFiles = []
for await (const f of glob('**/*.html', { cwd: DIST })) {
  htmlFiles.push(path.join(DIST, f))
}

if (htmlFiles.length === 0) {
  console.error('ERROR: No HTML files found in dist/. Run nuxt generate first.')
  process.exit(1)
}

// Regex: match <script> tags that have NO src attribute (inline scripts only).
// Captures the text between > and </script>.
const INLINE_SCRIPT_RE = /<script(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi

const seen = new Set() // deduplicate by hash
const hashes = [] // ordered list of unique sha256-<base64> strings

let totalInlineCount = 0
let inlineEventHandlers = 0

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8')

  // Check for inline event handlers (onclick=, onload=, etc.)
  const evtMatches = html.match(/\son\w+\s*=/gi) || []
  inlineEventHandlers += evtMatches.length

  let m
  INLINE_SCRIPT_RE.lastIndex = 0
  while ((m = INLINE_SCRIPT_RE.exec(html)) !== null) {
    const text = m[1]
    // Skip empty blocks and JSON data blocks (type="application/json")
    // — JSON data blocks are not executable scripts; the browser doesn't run
    //   them so they don't need to appear in script-src.
    // We detect them by looking at the opening tag captured in m[0].
    if (!text.trim()) continue
    if (m[0].includes('application/json')) continue

    totalInlineCount++

    const hash = 'sha256-' + createHash('sha256').update(text, 'utf8').digest('base64')
    if (!seen.has(hash)) {
      seen.add(hash)
      hashes.push({ hash, preview: text.slice(0, 60).replace(/\n/g, '↵') })
    }
  }
}

// Inline scripts injected at RUNTIME by framework client code. These are NOT in
// the static HTML above, so the scan can't see them — yet a strict CSP still
// blocks them, so we pin them here by content. @nuxt/ui injects this one on
// hydration to remove its FOUC color placeholder ([data-nuxt-ui-colors]); the
// string is buildId-independent, so its hash is stable across builds. If a
// dependency upgrade changes an injected script, the production CSP smoke will
// surface a new blocked-inline-script error — re-capture and update this list.
const RUNTIME_INJECTED = [
  `document.head.removeChild(document.querySelector('[data-nuxt-ui-colors]'))`
]
for (const text of RUNTIME_INJECTED) {
  const hash = 'sha256-' + createHash('sha256').update(text, 'utf8').digest('base64')
  if (!seen.has(hash)) {
    seen.add(hash)
    hashes.push({ hash, preview: text.slice(0, 60).replace(/\n/g, '↵') + ' [runtime-injected]' })
  }
}

if (hashes.length === 0) {
  console.warn('WARNING: No inline scripts found — removing unsafe-inline without pins is unsafe.')
  process.exit(1)
}

console.log(`\nFound ${totalInlineCount} inline script block(s) across ${htmlFiles.length} HTML file(s).`)
console.log(`${hashes.length} distinct hash(es) to pin:\n`)
for (const { hash, preview } of hashes) {
  console.log(`  ${hash}`)
  console.log(`    preview: ${preview}…\n`)
}

if (inlineEventHandlers > 0) {
  console.warn(`WARNING: ${inlineEventHandlers} inline event handler attribute(s) found (onclick= etc.).`)
  console.warn(`  These are NOT covered by script-src hashes; they require 'unsafe-hashes'.`)
}

// ---------------------------------------------------------------------------
// 2. Build the CSP string
//    Directives come from netlify.toml (minus script-src — we own that now):
//      default-src 'self'
//      style-src 'self' 'unsafe-inline'   (Vue injects styles at runtime)
//      img-src 'self' data:
//      font-src 'self' data:
//      connect-src 'self'
//      frame-ancestors 'none'
//      base-uri 'self'
//      form-action 'self'
//      object-src 'none'            ← hardening addition
//      script-src 'self' + hashes  ← no unsafe-inline
//      worker-src 'self'           ← Sim Lab Monte-Carlo module worker
// ---------------------------------------------------------------------------
const quotedHashes = hashes.map(h => `'${h.hash}'`)
const scriptSrc = [`'self'`, ...quotedHashes].join(' ')

const csp = [
  `default-src 'self'`,
  `script-src ${scriptSrc}`,
  // The Sim Lab Monte-Carlo runs in a Vite module worker bundled to a
  // same-origin file under /_nuxt, so 'self' covers it (made explicit here).
  `worker-src 'self'`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data:`,
  `font-src 'self' data:`,
  `connect-src 'self'`,
  `object-src 'none'`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`
].join('; ')

// ---------------------------------------------------------------------------
// 3. Build the complete _headers content.
//    Nuxt/Nitro generates cache headers in dist/_headers for /_nuxt/* etc.
//    We read those and append our /* security block after them.
//    IMPORTANT: Netlify processes _headers top-to-bottom; the first match
//    for a path wins for each header.  Nuxt's cache entries are specific paths
//    (/_nuxt/*, /_fonts/*, …) so they won't conflict with our /* block.
// ---------------------------------------------------------------------------
const headersFile = path.join(DIST, '_headers')
const existingContent = existsSync(headersFile)
  ? readFileSync(headersFile, 'utf8').trimEnd()
  : ''

// Security headers block (CSP is owned here; netlify.toml CSP is removed to
// avoid conflicts — see netlify.toml comment).
const securityBlock = `
# Security headers — generated by scripts/csp-hashes.mjs at build time.
# CSP uses per-build sha256 hashes instead of 'unsafe-inline'.
# netlify.toml provides X-Frame-Options, X-Content-Type-Options, etc. for /*
# but does NOT set Content-Security-Policy (that's owned here).
/*
  Content-Security-Policy: ${csp}
`

const finalContent = existingContent
  ? existingContent + '\n' + securityBlock
  : securityBlock.trimStart()

writeFileSync(headersFile, finalContent, 'utf8')
console.log(`dist/_headers written with ${hashes.length} pinned hash(es).`)
console.log(`\nFinal script-src:\n  script-src ${scriptSrc}\n`)
