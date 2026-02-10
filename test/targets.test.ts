import { describe, expect, it } from 'vitest'
import { parseTargets, defaultTargets } from '../src/targets'

describe('parseTargets', () => {
  it('defaults to all', () => {
    expect(parseTargets(undefined)).toEqual(defaultTargets())
    expect(parseTargets('')).toEqual(defaultTargets())
    expect(parseTargets('all')).toEqual(defaultTargets())
  })

  it('parses explicit list', () => {
    expect(parseTargets('darwin-arm64, linux-x64')).toEqual(['darwin-arm64', 'linux-x64'])
  })

  it('rejects invalid target', () => {
    expect(() => parseTargets('darwin-amd64')).toThrow(/Invalid target/)
  })
})

