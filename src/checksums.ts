import fs from 'node:fs/promises'
import path from 'node:path'
import { sha256File } from './fsutil'

export async function writeChecksumsFile(opts: {
  outdir: string
  checksumFileName: string
  assetPaths: { fileName: string; path: string }[]
}): Promise<string> {
  const lines: string[] = []
  const sorted = [...opts.assetPaths].sort((a, b) => a.fileName.localeCompare(b.fileName))
  for (const a of sorted) {
    const sum = await sha256File(a.path)
    lines.push(`${sum}  ${a.fileName}`)
  }
  const content = lines.join('\n') + '\n'
  const p = path.join(opts.outdir, opts.checksumFileName)
  await fs.writeFile(p, content, 'utf8')
  return p
}

export function parseChecksumsTxt(content: string): Map<string, string> {
  // filename -> sha256
  const m = new Map<string, string>()
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const parts = trimmed.split(/\s+/)
    if (parts.length < 2) continue
    const sha = parts[0]
    const file = parts[parts.length - 1]
    m.set(file, sha)
  }
  return m
}

