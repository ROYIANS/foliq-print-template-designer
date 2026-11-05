import { describe, expect, it } from 'vitest'
import { parseRuntimeConfig } from './runtimeConfig'

describe('runtime config', () => {
  it('accepts only the public deployment fields', () => {
    expect(parseRuntimeConfig({ demoMode: true, demoResetTime: '00:00 UTC' })).toEqual({
      demoMode: true,
      demoResetTime: '00:00 UTC',
    })
  })

  it('rejects malformed deployment state', () => {
    expect(() => parseRuntimeConfig({ demoMode: 'true', demoResetTime: '00:00 UTC' })).toThrow(
      'missing required fields',
    )
  })
})
