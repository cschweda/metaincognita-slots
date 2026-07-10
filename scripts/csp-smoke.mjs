#!/usr/bin/env node
// Boot the GENERATED site under the REAL production headers and prove it
// lives. The failure class this guards is a silent one: a CSP hash that
// doesn't match the built inline scripts white-screens the app at Nuxt boot
// (it has happened twice). Static hash checks can't see runtime-injected
// scripts — only a real browser boot can. Run after `pnpm generate`:
//
//   pnpm smoke:csp
//
// Uses the system Chrome via puppeteer-core (no bundled browser). If no
// Chrome is found: SKIP (exit 0) locally, FAIL when CSP_SMOKE_REQUIRE=1
// (CI sets it — silence must never look like success there).
import { spawn, execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const PORT = Number(process.env.CSP_SMOKE_PORT ?? 8791)
const BASE = `http://127.0.0.1:${PORT}`
const REQUIRE = process.env.CSP_SMOKE_REQUIRE === '1'

// Each check: a page and the text whose appearance proves the layer works.
// '/' proves Nuxt booted at all (the white-screen signature is this timing out);
// '/learn/myths' proves the rtp.worker loaded and answered under worker-src;
// '/sim-lab' proves the live exact-math panel (worker or fallback) rendered.
const CHECKS = [
  { path: '/', mustShow: 'SLOTS SIMULATOR', timeoutMs: 20_000 },
  { path: '/learn/myths', mustShow: '1 in 13,824', timeoutMs: 30_000 },
  { path: '/sim-lab', mustShow: 'The math, before you spin', timeoutMs: 20_000, alsoShow: '$' }
]

const VIOLATION = /Refused to|Content Security Policy/i

function findChrome() {
  if (process.env.CSP_SMOKE_CHROME) return process.env.CSP_SMOKE_CHROME
  for (const bin of ['google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium']) {
    try {
      const p = execFileSync('which', [bin], { encoding: 'utf8' }).trim()
      if (p) return p
    } catch { /* not on PATH — keep looking */ }
  }
  const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  if (existsSync(mac)) return mac
  return null
}

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    let tries = 0
    const poll = async () => {
      if (child.exitCode !== null) return reject(new Error(`smoke server exited early (code ${child.exitCode})`))
      try {
        const res = await fetch(BASE, { method: 'HEAD' })
        if (res.ok) return resolve(undefined)
      } catch { /* not up yet */ }
      if (++tries > 60) return reject(new Error('smoke server never came up'))
      setTimeout(poll, 500)
    }
    poll()
  })
}

const chrome = findChrome()
if (!chrome) {
  if (REQUIRE) {
    console.error('csp-smoke: FAIL — CSP_SMOKE_REQUIRE=1 but no Chrome found (set CSP_SMOKE_CHROME)')
    process.exit(1)
  }
  console.warn('csp-smoke: SKIP — no Chrome found; the production CSP was NOT verified in a browser')
  process.exit(0)
}

const server = spawn('node', ['scripts/smoke-serve.mjs'], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'ignore', 'inherit']
})

let browser = null
let failed = false
try {
  await waitForServer(server)
  browser = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    args: process.env.CI ? ['--no-sandbox', '--disable-dev-shm-usage'] : []
  })

  for (const check of CHECKS) {
    const page = await browser.newPage()
    const problems = []
    page.on('console', (msg) => {
      if (VIOLATION.test(msg.text())) problems.push(`console: ${msg.text()}`)
    })
    page.on('pageerror', (err) => {
      problems.push(`pageerror: ${err.message}`)
    })

    let textOk = false
    try {
      await page.goto(BASE + check.path, { waitUntil: 'domcontentloaded', timeout: check.timeoutMs })
      await page.waitForFunction(
        (needle, extra) => document.body.innerText.includes(needle)
          && (extra === null || document.body.innerText.includes(extra)),
        { timeout: check.timeoutMs },
        check.mustShow,
        check.alsoShow ?? null
      )
      textOk = true
    } catch { /* fall through to the report below */ }

    if (!textOk) {
      failed = true
      console.error(`csp-smoke: FAIL ${check.path} — "${check.mustShow}" never appeared (the white-screen signature)`)
    }
    if (problems.length > 0) {
      failed = true
      console.error(`csp-smoke: FAIL ${check.path} — CSP violations / page errors:`)
      for (const p of problems) console.error(`  ${p}`)
    }
    if (textOk && problems.length === 0) {
      console.log(`csp-smoke: ok ${check.path} — "${check.mustShow}" rendered, zero violations`)
    }
    await page.close()
  }
} catch (err) {
  failed = true
  console.error(`csp-smoke: FAIL — ${err instanceof Error ? err.message : String(err)}`)
} finally {
  if (browser) await browser.close()
  server.kill()
}

if (failed) process.exit(1)
console.log('csp-smoke: PASS — the generated site boots and runs clean under the production CSP')
