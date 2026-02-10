import type { Arch, Os, TargetTriple } from './types'

export function normalizeArtifactBaseName(name: string): string {
  const trimmed = (name || '').trim()
  if (!trimmed) throw new Error('artifact-name is empty')

  // Prefer typical CLI naming: keep alnum, dash, underscore; replace spaces with dash.
  return trimmed
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
}

export function archiveFileName(opts: {
  name: string
  version: string
  os: Os
  arch: Arch
}): string {
  const base = `${opts.name}-${opts.version}-${opts.os}-${opts.arch}`
  return opts.os === 'windows' ? `${base}.zip` : `${base}.tar.gz`
}

export function splitTarget(t: TargetTriple): { os: Os; arch: Arch } {
  const [os, arch] = t.split('-') as [Os, Arch]
  return { os, arch }
}

