import * as core from '@actions/core'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs/promises'
import type { ProjectMeta } from '../types'
import { execCmd } from '../exec'
import { mkdirp } from '../fsutil'
import {
  defaultFormulaDesc,
  defaultHomepage,
  deriveFormulaName,
  formulaClassName,
  renderFormula
} from './formula'
import { parseChecksumsTxt } from '../checksums'

export async function updateHomebrewTap(opts: {
  brewTap: string
  brewToken: string
  brewFormulaPath?: string
  brewCommitMessage?: string
  brewPr: boolean
  version: string
  projectRepo: { owner: string; repo: string }
  projectMeta: ProjectMeta
  checksumsTxtPath: string
}): Promise<
  | void
  | {
      pr: {
        owner: string
        repo: string
        headBranch: string
        baseBranch: string
        title: string
        body: string
      }
    }
> {
  const [tapOwner, tapRepo] = splitOwnerRepo(opts.brewTap)
  const tapDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bunli-releaser-tap-'))

  const remoteUrl = `https://x-access-token:${opts.brewToken}@github.com/${tapOwner}/${tapRepo}.git`
  core.info(`Cloning Homebrew tap: ${opts.brewTap}`)
  const clone = await execCmd('git', ['clone', remoteUrl, tapDir], { silent: true })
  if (clone.exitCode !== 0) throw new Error(`Failed to clone tap repo. stderr:\n${clone.stderr}`)

  const defaultBranch = await getDefaultBranch(tapDir)
  core.info(`Tap default branch: ${defaultBranch}`)

  if (opts.brewPr) {
    const branch = `bunli-releaser/${opts.projectMeta.binary}-v${opts.version}`
    const co = await execCmd('git', ['checkout', '-b', branch], { cwd: tapDir })
    if (co.exitCode !== 0) throw new Error(`Failed to create tap branch. stderr:\n${co.stderr}`)
  }

  const formulaName = deriveFormulaName(opts.projectMeta.binary)
  const formulaPath = opts.brewFormulaPath || `Formula/${formulaName}.rb`
  const absFormulaPath = path.join(tapDir, formulaPath)
  await mkdirp(path.dirname(absFormulaPath))

  const checksumsRaw = await fs.readFile(opts.checksumsTxtPath, 'utf8')
  const checksums = parseChecksumsTxt(checksumsRaw)

  const assetBaseUrl = `https://github.com/${opts.projectRepo.owner}/${opts.projectRepo.repo}/releases/download/v${opts.version}`
  const mk = (asset: string) => `${assetBaseUrl}/${asset}`

  const darwinArm = `${opts.projectMeta.binary}-${opts.version}-darwin-arm64.tar.gz`
  const darwinX64 = `${opts.projectMeta.binary}-${opts.version}-darwin-x64.tar.gz`
  const linuxArm = `${opts.projectMeta.binary}-${opts.version}-linux-arm64.tar.gz`
  const linuxX64 = `${opts.projectMeta.binary}-${opts.version}-linux-x64.tar.gz`

  const required = [darwinArm, darwinX64, linuxArm, linuxX64]
  for (const f of required) {
    if (!checksums.has(f)) {
      throw new Error(`checksums.txt missing sha256 for required Homebrew asset: ${f}`)
    }
  }

  const homepageFallback = `https://github.com/${opts.projectRepo.owner}/${opts.projectRepo.repo}`

  const rb = renderFormula({
    className: formulaClassName(formulaName),
    formulaName,
    desc: defaultFormulaDesc(opts.projectMeta),
    homepage: defaultHomepage(opts.projectMeta, homepageFallback),
    version: opts.version,
    binary: opts.projectMeta.binary,
    urls: {
      darwinArm64: { url: mk(darwinArm), sha256: checksums.get(darwinArm)! },
      darwinX64: { url: mk(darwinX64), sha256: checksums.get(darwinX64)! },
      linuxArm64: { url: mk(linuxArm), sha256: checksums.get(linuxArm)! },
      linuxX64: { url: mk(linuxX64), sha256: checksums.get(linuxX64)! }
    }
  })

  await fs.writeFile(absFormulaPath, rb, 'utf8')
  core.info(`Updated formula: ${formulaPath}`)

  // Commit
  await execCmd('git', ['config', 'user.name', 'bunli-releaser[bot]'], { cwd: tapDir, silent: true })
  await execCmd('git', ['config', 'user.email', 'bunli-releaser[bot]@users.noreply.github.com'], {
    cwd: tapDir,
    silent: true
  })

  const add = await execCmd('git', ['add', formulaPath], { cwd: tapDir })
  if (add.exitCode !== 0) throw new Error(`git add failed. stderr:\n${add.stderr}`)

  const msg =
    (opts.brewCommitMessage || '').trim() || `chore: update ${opts.projectMeta.binary} to ${opts.version}`
  const commit = await execCmd('git', ['commit', '-m', msg], { cwd: tapDir, ignoreReturnCode: true })
  if (commit.exitCode !== 0) {
    // If no changes, avoid failing the whole release.
    const status = await execCmd('git', ['status', '--porcelain=v1'], { cwd: tapDir, silent: true })
    if ((status.stdout || '').trim() === '') {
      core.info('No Homebrew tap changes to commit.')
      return
    }
    throw new Error(`git commit failed. stderr:\n${commit.stderr}`)
  }

  if (!opts.brewPr) {
    const push = await execCmd('git', ['push', 'origin', defaultBranch], { cwd: tapDir, silent: true })
    if (push.exitCode !== 0) throw new Error(`git push failed. stderr:\n${push.stderr}`)
    core.info(`Pushed formula update to ${opts.brewTap}@${defaultBranch}`)
    return
  }

  // PR mode: push branch; PR creation is handled in index.ts (needs an Octokit instance).
  const branchName = await currentBranch(tapDir)
  const push = await execCmd('git', ['push', '-u', 'origin', branchName], { cwd: tapDir, silent: true })
  if (push.exitCode !== 0) throw new Error(`git push failed. stderr:\n${push.stderr}`)
  return {
    pr: {
      owner: tapOwner,
      repo: tapRepo,
      headBranch: branchName,
      baseBranch: defaultBranch,
      title: `chore: update ${opts.projectMeta.binary} to ${opts.version}`,
      body: `Automated update by bunli-releaser for ${opts.projectRepo.owner}/${opts.projectRepo.repo} tag v${opts.version}.`
    }
  }
}

function splitOwnerRepo(s: string): [string, string] {
  const trimmed = (s || '').trim()
  const parts = trimmed.split('/')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid brew-tap: "${s}". Expected "owner/repo".`)
  }
  return [parts[0], parts[1]]
}

async function getDefaultBranch(dir: string): Promise<string> {
  const r = await execCmd('git', ['remote', 'show', 'origin'], { cwd: dir, silent: true })
  const m = /HEAD branch:\s*(.+)\s*/.exec(r.stdout || '')
  return (m?.[1] || 'main').trim()
}

async function currentBranch(dir: string): Promise<string> {
  const r = await execCmd('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: dir, silent: true })
  const b = (r.stdout || '').trim()
  if (!b) throw new Error('Failed to determine current branch for tap repo')
  return b
}
