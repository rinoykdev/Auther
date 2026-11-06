#!/usr/bin/env node
/**
 * Scan the production bundle for secrets.
 *
 * The PUBLISHABLE key appearing in dist/ is expected and correct — it is
 * designed to ship in browser JavaScript. This script looks for the things that
 * must never be there: the secret / service-role key, and raw .env content.
 *
 * Runs in CI after every build (.github/workflows/ci.yml).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DIST = 'dist'

const FORBIDDEN = [
  { name: 'Supabase secret key', re: /sb_secret_[A-Za-z0-9_-]{8,}/ },
  { name: 'service_role reference', re: /service_role/ },
  { name: 'JWT (possible legacy service-role key)', re: /eyJ[A-Za-z0-9_-]{40,}/ },
]

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) yield* walk(path)
    else yield path
  }
}

let failures = 0
let scanned = 0

for (const file of walk(DIST)) {
  if (!/\.(js|css|html|json|map|txt)$/.test(file)) continue
  scanned += 1
  const content = readFileSync(file, 'utf8')
  for (const { name, re } of FORBIDDEN) {
    const match = content.match(re)
    if (match) {
      // Report the finding WITHOUT printing the value — CI logs are not a
      // place to republish a leaked secret.
      console.error(
        `FAIL ${file}: ${name} found (${match[0].length} chars, starts "${match[0].slice(0, 6)}...")`,
      )
      failures += 1
    }
  }
}

if (failures > 0) {
  console.error(
    `\n${failures} finding(s). Rotate any exposed key immediately — removing it from the build is not sufficient.`,
  )
  process.exit(1)
}

console.log(`OK: scanned ${scanned} file(s) in ${DIST}/, no secrets found`)
