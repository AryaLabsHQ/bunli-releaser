import fs from 'node:fs/promises'
import path from 'node:path'
import yaml from 'js-yaml'
import { fileExists } from './fsutil'

export type BunliReleaserConfig = {
  project?: {
    binary?: string
  }
  build?: {
    targets?: string[]
  }
  homebrew?: {
    tap?: string
    formula?: string
    pr?: boolean
    commitMessage?: string
  }
}

export async function loadOptionalConfig(workdir: string): Promise<BunliReleaserConfig | undefined> {
  const p = path.join(workdir, '.bunli-releaser.yml')
  if (!(await fileExists(p))) return undefined
  const raw = await fs.readFile(p, 'utf8')
  const parsed = yaml.load(raw)
  if (!parsed || typeof parsed !== 'object') return undefined
  return parsed as BunliReleaserConfig
}

