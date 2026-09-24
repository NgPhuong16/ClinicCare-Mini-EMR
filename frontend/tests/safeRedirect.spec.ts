import { describe, expect, it } from 'vitest'

import { isSafeRedirectPath } from '~/utils/safeRedirect'

describe('isSafeRedirectPath', () => {
  it('accepts an internal path', () => {
    expect(isSafeRedirectPath('/consultations?x=1')).toBe(true)
  })

  it('rejects a full external URL', () => {
    expect(isSafeRedirectPath('https://evil.com')).toBe(false)
  })

  it('rejects a protocol-relative URL', () => {
    expect(isSafeRedirectPath('//evil.com')).toBe(false)
  })

  it('rejects a path containing a backslash', () => {
    expect(isSafeRedirectPath('/\\evil.com')).toBe(false)
  })
})
