import fs from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p)
    return true
  } catch {
    return false
  }
}

export async function mkdirp(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true })
}

export async function listFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  return entries.filter((e) => e.isFile()).map((e) => path.join(dir, e.name))
}

export async function sha256File(filePath: string): Promise<string> {
  const hash = crypto.createHash('sha256')
  await new Promise<void>((resolve, reject) => {
    const s = createReadStream(filePath)
    s.on('data', (chunk) => hash.update(chunk))
    s.on('error', reject)
    s.on('end', () => resolve())
  })
  return hash.digest('hex')
}

