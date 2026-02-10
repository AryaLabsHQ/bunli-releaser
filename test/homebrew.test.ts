import { describe, expect, it } from 'vitest'
import { deriveFormulaName, formulaClassName, renderFormula } from '../src/homebrew/formula'

describe('homebrew formula helpers', () => {
  it('derives formula name from binary', () => {
    expect(deriveFormulaName('MyCLI')).toBe('mycli')
    expect(deriveFormulaName('my_cli')).toBe('my-cli')
  })

  it('generates class name', () => {
    expect(formulaClassName('mycli')).toBe('Mycli')
    expect(formulaClassName('my-cli')).toBe('MyCli')
  })

  it('renders formula with urls and sha256', () => {
    const rb = renderFormula({
      className: 'MyCli',
      formulaName: 'mycli',
      desc: 'Example',
      homepage: 'https://example.com',
      version: '1.2.3',
      binary: 'mycli',
      urls: {
        darwinArm64: { url: 'u1', sha256: 's1' },
        darwinX64: { url: 'u2', sha256: 's2' },
        linuxArm64: { url: 'u3', sha256: 's3' },
        linuxX64: { url: 'u4', sha256: 's4' }
      }
    })
    expect(rb).toMatch(/class MyCli < Formula/)
    expect(rb).toMatch(/url "u1"/)
    expect(rb).toMatch(/sha256 "s4"/)
    expect(rb).toMatch(/bin\.install "mycli"/)
    expect(rb).toMatch(/"--version"/)
  })
})

