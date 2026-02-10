import { describe, expect, it } from 'vitest'
import { archiveFileName, normalizeArtifactBaseName } from '../src/naming'

describe('naming', () => {
  it('normalizes artifact base name', () => {
    expect(normalizeArtifactBaseName('my cli')).toBe('my-cli')
    expect(normalizeArtifactBaseName('My@CLI!')).toBe('My-CLI-')
  })

  it('produces stable archive naming', () => {
    expect(archiveFileName({ name: 'mycli', version: '1.2.3', os: 'darwin', arch: 'arm64' })).toBe(
      'mycli-1.2.3-darwin-arm64.tar.gz'
    )
    expect(archiveFileName({ name: 'mycli', version: '1.2.3', os: 'windows', arch: 'x64' })).toBe(
      'mycli-1.2.3-windows-x64.zip'
    )
  })
})

