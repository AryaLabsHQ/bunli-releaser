import fs from 'node:fs/promises'
import path from 'node:path'
import type { ProjectMeta } from './types'
import { normalizeArtifactBaseName } from './naming'

type PackageJson = {
  name?: string
  description?: string
  homepage?: string
  repository?: string | { type?: string; url?: string }
  bin?: string | Record<string, string>
}

export async function readProjectMeta(workdir: string, artifactNameInput?: string): Promise<ProjectMeta> {
  const pkgPath = path.join(workdir, 'package.json')
  const raw = await fs.readFile(pkgPath, 'utf8')
  const pkg = JSON.parse(raw) as PackageJson

  const pkgName = (pkg.name || '').trim()
  const defaultBinary = deriveBinaryName(pkg)
  const binary = normalizeArtifactBaseName(artifactNameInput || defaultBinary || pkgName || 'cli')

  const repository =
    typeof pkg.repository === 'string'
      ? pkg.repository
      : typeof pkg.repository?.url === 'string'
        ? pkg.repository.url
        : undefined

  return {
    name: pkgName || binary,
    description: pkg.description,
    homepage: pkg.homepage,
    repository,
    binary
  }
}

function deriveBinaryName(pkg: PackageJson): string | undefined {
  if (!pkg.bin) return undefined
  if (typeof pkg.bin === 'string') return pkg.name
  const keys = Object.keys(pkg.bin)
  if (keys.length === 1) return keys[0]
  return pkg.name
}

