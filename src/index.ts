import * as core from '@actions/core'
import * as github from '@actions/github'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs/promises'
import { ensureBun } from './bun'
import { loadOptionalConfig } from './config'
import { parseTag } from './tag'
import { parseTargets, normalizeTarget } from './targets'
import { readProjectMeta } from './project'
import { buildBinaries, findBuiltExecutable } from './build'
import { mkdirp } from './fsutil'
import { packageTargetBinary } from './packaging'
import { writeChecksumsFile } from './checksums'
import { upsertReleaseAndUpload } from './githubRelease'
import { updateHomebrewTap } from './homebrew/tap'
import type { TargetTriple } from './types'

async function run(): Promise<void> {
  const githubToken = core.getInput('github-token', { required: true })
  const bunVersion = core.getInput('bun-version') || '1.3.8'
  const workdirInput = core.getInput('workdir') || '.'
  const targetsInput = core.getInput('targets') || 'all'
  const artifactNameInput = core.getInput('artifact-name') || undefined

  const brewTap = core.getInput('brew-tap', { required: true })
  const brewToken = core.getInput('brew-token', { required: true })
  const brewFormulaPath = core.getInput('brew-formula-path') || undefined
  const brewPr = (core.getInput('brew-pr') || 'false').toLowerCase() === 'true'
  const brewCommitMessage = core.getInput('brew-commit-message') || undefined

  const repoRoot = process.env.GITHUB_WORKSPACE || process.cwd()
  const workdir = path.resolve(repoRoot, workdirInput)

  const config = await loadOptionalConfig(workdir)
  const tagName = resolveTagName()
  const parsed = parseTag(tagName)

  core.setOutput('version', parsed.version)
  core.setOutput('tag', parsed.tag)

  await ensureBun(bunVersion)

  const cfgTargets = config?.build?.targets?.join(',')
  const targets = parseTargets(targetsInput || cfgTargets || 'all')

  const projectMeta = await readProjectMeta(workdir, artifactNameInput || config?.project?.binary)
  core.info(`Binary name: ${projectMeta.binary}`)

  const build = await buildBinaries({ workdir, targets, version: parsed.version })

  const outdir = await fs.mkdtemp(path.join(os.tmpdir(), 'bunli-releaser-out-'))
  await mkdirp(outdir)

  const multiTarget = targets.length > 1
  const packaged = []
  for (const t of targets) {
    const nt = normalizeTarget(t)
    const exe = await findBuiltExecutable({ buildOutdir: build.outdir, target: t, multiTarget })
    packaged.push(
      await packageTargetBinary({
        target: nt,
        version: parsed.version,
        binaryBaseName: projectMeta.binary,
        builtExecutablePath: exe,
        outdir
      })
    )
  }

  const checksumPath = await writeChecksumsFile({
    outdir,
    checksumFileName: 'checksums.txt',
    assetPaths: packaged.map((p) => ({ fileName: p.archiveFileName, path: p.archivePath }))
  })

  const owner = github.context.repo.owner
  const repo = github.context.repo.repo
  const octokit = github.getOctokit(githubToken) as any

  const assets = [
    ...packaged.map((p) => ({
      filePath: p.archivePath,
      fileName: p.archiveFileName,
      contentType: p.target.isWindows ? 'application/zip' : 'application/gzip'
    })),
    { filePath: checksumPath, fileName: 'checksums.txt', contentType: 'text/plain' }
  ]

  const release = await upsertReleaseAndUpload({
    octokit,
    owner,
    repo,
    tag: parsed.tag,
    releaseName: `${projectMeta.binary} ${parsed.version}`,
    assets
  })
  core.setOutput('release-url', release.releaseUrl)

  const hb = await updateHomebrewTap({
    brewTap,
    brewToken,
    brewFormulaPath,
    brewCommitMessage,
    brewPr,
    version: parsed.version,
    projectRepo: { owner, repo },
    projectMeta,
    checksumsTxtPath: checksumPath
  })

  if (brewPr && hb && 'pr' in hb) {
    const brewOctokit = github.getOctokit(brewToken) as any
    await brewOctokit.rest.pulls.create({
      owner: hb.pr.owner,
      repo: hb.pr.repo,
      title: hb.pr.title,
      head: `${hb.pr.owner}:${hb.pr.headBranch}`,
      base: hb.pr.baseBranch,
      body: hb.pr.body
    })
    core.info(
      `Opened Homebrew tap PR: ${hb.pr.owner}/${hb.pr.repo} (${hb.pr.headBranch} -> ${hb.pr.baseBranch})`
    )
  }
}

function resolveTagName(): string {
  // Prefer GITHUB_REF_NAME when available; otherwise fall back to refs/tags/<tag> parsing.
  const refName = (process.env.GITHUB_REF_NAME || '').trim()
  if (refName) return refName

  const ref = (process.env.GITHUB_REF || '').trim()
  const m = /^refs\/tags\/(.+)$/.exec(ref)
  if (m?.[1]) return m[1]
  throw new Error(
    `Could not resolve tag name from environment. GITHUB_REF_NAME="${process.env.GITHUB_REF_NAME}", GITHUB_REF="${process.env.GITHUB_REF}".`
  )
}

run().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err)
  core.setFailed(msg)
})
