import { describe, expect, it } from 'vitest'
import { planUploads } from '../src/githubRelease'

describe('planUploads', () => {
  const mk = (name: string) => ({
    filePath: `/tmp/${name}`,
    fileName: name,
    contentType: 'application/gzip'
  })

  it('throws in fail mode when an asset already exists', () => {
    const assets = [mk('a.tar.gz'), mk('b.tar.gz')]
    const existing = new Set(['b.tar.gz'])

    expect(() => planUploads(assets, existing, 'fail', 'v1.2.3')).toThrow(/already exists/)
  })

  it('skips existing assets in skip mode', () => {
    const assets = [mk('a.tar.gz'), mk('b.tar.gz')]
    const existing = new Set(['b.tar.gz'])

    const p = planUploads(assets, existing, 'skip', 'v1.2.3')
    expect(p.toUpload.map((a) => a.fileName)).toEqual(['a.tar.gz'])
    expect(p.skipped.map((a) => a.fileName)).toEqual(['b.tar.gz'])
  })
})
