import * as core from '@actions/core'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs/promises'
import type { TargetTriple } from './types'
import { execCmd } from './exec'
import { mkdirp, fileExists, listFiles } from './fsutil'

export async function buildBinaries(opts: {
  workdir: string
  targets: TargetTriple[]
  version: string
}): Promise<{ outdir: string }> {
  const outdir = await fs.mkdtemp(path.join(os.tmpdir(), 'bunli-releaser-build-'))
  core.info(`Build outdir: ${outdir}`)

  await installDeps(opts.workdir)

  // Use Bunli's build command. We rely on Bunli to create per-target subdirs when multiple targets are passed.
  const targetsArg = opts.targets.join(',')
  core.info(`Running: bunx bunli build --targets ${targetsArg} --outdir ${outdir}`)

  const res = await execCmd(
    'bunx',
    ['bunli', 'build', '--targets', targetsArg, '--outdir', outdir],
    {
      cwd: opts.workdir,
      env: { ...process.env, BUNLI_RELEASE_VERSION: opts.version }
    }
  )
  if (res.exitCode !== 0) {
    throw new Error(`bunli build failed (exit ${res.exitCode}). stderr:\n${res.stderr}`)
  }

  return { outdir }
}

async function installDeps(workdir: string): Promise<void> {
  const lockb = path.join(workdir, 'bun.lockb')
  const lock = path.join(workdir, 'bun.lock')
  const hasLock = (await fileExists(lockb)) || (await fileExists(lock))

  const args = hasLock ? ['install', '--frozen-lockfile'] : ['install']
  core.info(`Running: bun ${args.join(' ')} (cwd=${workdir})`)
  const res = await execCmd('bun', args, { cwd: workdir })
  if (res.exitCode === 0) return

  // Some projects don't have a lockfile that supports frozen mode; retry without.
  if (hasLock && args.includes('--frozen-lockfile')) {
    core.info('bun install --frozen-lockfile failed; retrying without --frozen-lockfile')
    const retry = await execCmd('bun', ['install'], { cwd: workdir })
    if (retry.exitCode === 0) return
    throw new Error(`bun install failed (exit ${retry.exitCode}). stderr:\n${retry.stderr}`)
  }

  throw new Error(`bun install failed (exit ${res.exitCode}). stderr:\n${res.stderr}`)
}

export async function findBuiltExecutable(opts: {
  buildOutdir: string
  target: TargetTriple
  multiTarget: boolean
}): Promise<string> {
  const dir = opts.multiTarget ? path.join(opts.buildOutdir, opts.target) : opts.buildOutdir
  if (!(await fileExists(dir))) {
    throw new Error(`Expected build output dir not found for target ${opts.target}: ${dir}`)
  }

  const files = (await listFiles(dir)).filter((p) => !p.endsWith('.map'))
  if (files.length !== 1) {
    throw new Error(
      `Expected exactly 1 executable in ${dir} for target ${opts.target}, found ${files.length}: ${files
        .map((p) => path.basename(p))
        .join(', ')}`
    )
  }
  return files[0]
}

