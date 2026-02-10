import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import path from 'node:path'
import fs from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import { execCmd } from './exec'
import { fileExists, listFiles, mkdirp } from './fsutil'

function normalizeBunVersion(v: string): { kind: 'latest' } | { kind: 'pinned'; version: string } {
  const trimmed = (v || '').trim()
  if (!trimmed || trimmed === 'latest') return { kind: 'latest' }
  return { kind: 'pinned', version: trimmed.startsWith('v') ? trimmed.slice(1) : trimmed }
}

export async function ensureBun(versionInput: string): Promise<void> {
  const desired = normalizeBunVersion(versionInput)

  const existing = await execCmd('bun', ['--version'], { silent: true, ignoreReturnCode: true })
  if (existing.exitCode === 0) {
    core.info(`bun already available: ${existing.stdout.trim()}`)
    return
  }

  // v1 default strategy is Ubuntu runner; install Bun for linux-x64.
  const url =
    desired.kind === 'latest'
      ? 'https://github.com/oven-sh/bun/releases/latest/download/bun-linux-x64.zip'
      : `https://github.com/oven-sh/bun/releases/download/bun-v${desired.version}/bun-linux-x64.zip`

  core.info(`Downloading bun (${desired.kind === 'latest' ? 'latest' : desired.version})...`)
  const zipPath = await tc.downloadTool(url)
  const extracted = await tc.extractZip(zipPath)

  // Find bun binary in extracted payload.
  const bunPath = await findBunBinary(extracted)
  core.addPath(path.dirname(bunPath))

  const check = await execCmd('bun', ['--version'], { silent: true, ignoreReturnCode: true })
  if (check.exitCode !== 0) {
    throw new Error(`Failed to install bun from ${url}`)
  }
  core.info(`bun installed: ${check.stdout.trim()}`)
}

async function findBunBinary(root: string): Promise<string> {
  // Common layouts:
  // - <root>/bun-linux-x64/bun
  // - <root>/bun (rare)
  const direct = path.join(root, 'bun')
  if (await fileExists(direct)) return direct

  // Depth-first search, shallow-ish.
  const q: string[] = [root]
  while (q.length) {
    const dir = q.pop()!
    let entries: Dirent[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) q.push(p)
      if (e.isFile() && e.name === 'bun') return p
    }
  }

  // Last resort: show root files to aid debugging.
  try {
    await mkdirp(root)
    const files = await listFiles(root)
    core.debug(`Files in bun extract root: ${files.join(', ')}`)
  } catch {
    // ignore
  }
  throw new Error(`Could not find bun binary in extracted archive: ${root}`)
}
