import { describe, expect, it } from 'vitest'
import { parseTag } from '../src/tag'

describe('parseTag', () => {
  it('accepts v1.2.3 only', () => {
    expect(parseTag('v1.2.3')).toEqual({ tag: 'v1.2.3', version: '1.2.3' })
  })

  it('rejects missing v prefix', () => {
    expect(() => parseTag('1.2.3')).toThrow(/Unsupported tag format/)
  })

  it('rejects prerelease tags', () => {
    expect(() => parseTag('v1.2.3-rc.1')).toThrow(/Unsupported tag format/)
  })
})

