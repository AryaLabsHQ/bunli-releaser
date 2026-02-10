import type { NormalizedTarget, TargetTriple } from './types'

const DEFAULT_ALL: TargetTriple[] = [
  'darwin-arm64',
  'darwin-x64',
  'linux-arm64',
  'linux-x64',
  'windows-x64'
]

export function defaultTargets(): TargetTriple[] {
  return [...DEFAULT_ALL]
}

export function parseTargets(input: string | undefined): TargetTriple[] {
  const raw = (input ?? '').trim()
  if (!raw || raw === 'all') return defaultTargets()

  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (parts.length === 0) return defaultTargets()

  // v1 supports `all` and explicit list; accepting `native` is a convenience.
  if (parts.includes('all')) return defaultTargets()
  if (parts.includes('native')) {
    const os = mapNodePlatformToOs(process.platform)
    const arch = mapNodeArchToArch(process.arch)
    return [`${os}-${arch}` as TargetTriple]
  }

  const targets: TargetTriple[] = []
  for (const p of parts) {
    if (!isTargetTriple(p)) {
      throw new Error(
        `Invalid target "${p}". Expected one of: ${DEFAULT_ALL.join(', ')} (or "all").`
      )
    }
    targets.push(p)
  }

  return targets
}

export function normalizeTarget(t: TargetTriple): NormalizedTarget {
  const [os, arch] = t.split('-') as [NormalizedTarget['os'], NormalizedTarget['arch']]
  return { target: t, os, arch, isWindows: os === 'windows' }
}

function isTargetTriple(s: string): s is TargetTriple {
  return (DEFAULT_ALL as string[]).includes(s)
}

function mapNodePlatformToOs(p: string): 'darwin' | 'linux' | 'windows' {
  if (p === 'darwin') return 'darwin'
  if (p === 'linux') return 'linux'
  if (p === 'win32') return 'windows'
  throw new Error(`Unsupported native platform for v1: ${p}`)
}

function mapNodeArchToArch(a: string): 'arm64' | 'x64' {
  if (a === 'arm64') return 'arm64'
  if (a === 'x64') return 'x64'
  throw new Error(`Unsupported native arch for v1: ${a}`)
}

