import * as core from '@actions/core'
import fs from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import tar from 'tar'
import yazl from 'yazl'
import type { NormalizedTarget } from './types'
import { archiveFileName } from './naming'
import { mkdirp } from './fsutil'

export type PackagedAsset = {
  target: NormalizedTarget
  archivePath: string
  archiveFileName: string
}

export async function packageTargetBinary(opts: {
  target: NormalizedTarget
  version: string
  binaryBaseName: string
  builtExecutablePath: string
  outdir: string
}): Promise<PackagedAsset> {
  await mkdirp(opts.outdir)

  const archiveFileNameStr = archiveFileName({
    name: opts.binaryBaseName,
    version: opts.version,
    os: opts.target.os,
    arch: opts.target.arch
  })

  const archivePath = path.join(opts.outdir, archiveFileNameStr)
  const staged = await stageBinary({
    target: opts.target,
    binaryBaseName: opts.binaryBaseName,
    builtExecutablePath: opts.builtExecutablePath
  })

  if (opts.target.isWindows) {
    await createZip({
      archivePath,
      stagedBinaryPath: staged.stagedBinaryPath,
      binaryFileName: staged.binaryFileName
    })
  } else {
    await createTarGz({
      archivePath,
      stageDir: staged.stageDir,
      binaryFileName: staged.binaryFileName
    })
  }

  core.info(`Packaged ${opts.target.target}: ${archiveFileNameStr}`)

  return {
    target: opts.target,
    archivePath,
    archiveFileName: archiveFileNameStr
  }
}

async function stageBinary(opts: {
  target: NormalizedTarget
  binaryBaseName: string
  builtExecutablePath: string
}): Promise<{ stageDir: string; stagedBinaryPath: string; binaryFileName: string }> {
  const stageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bunli-releaser-stage-'))
  const binaryFileName = opts.target.isWindows ? `${opts.binaryBaseName}.exe` : opts.binaryBaseName
  const stagedBinaryPath = path.join(stageDir, binaryFileName)
  await fs.copyFile(opts.builtExecutablePath, stagedBinaryPath)
  if (!opts.target.isWindows) {
    await fs.chmod(stagedBinaryPath, 0o755)
  }
  return { stageDir, stagedBinaryPath, binaryFileName }
}

async function createTarGz(opts: {
  archivePath: string
  stageDir: string
  binaryFileName: string
}): Promise<void> {
  await tar.c(
    {
      gzip: true,
      cwd: opts.stageDir,
      file: opts.archivePath,
      portable: true
    },
    [opts.binaryFileName]
  )
}

async function createZip(opts: {
  archivePath: string
  stagedBinaryPath: string
  binaryFileName: string
}): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const zip = new yazl.ZipFile()
    // Ensure unix perms are reasonable when unpacked on unix (windows doesn't care much).
    zip.addFile(opts.stagedBinaryPath, opts.binaryFileName, { mode: 0o755 })
    zip.end()
    zip.outputStream
      .pipe(createWriteStream(opts.archivePath))
      .on('error', reject)
      .on('close', resolve)
  })
}

