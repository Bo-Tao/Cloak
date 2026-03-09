import { describe, it, expect } from 'vitest'
import { getConfigDefaults, isValidFontSize } from '../services/config-store'

describe('ConfigStore', () => {
  it('returns correct defaults', () => {
    const d = getConfigDefaults()
    expect(d.theme).toBe('system')
    expect(d.fontSize).toBe(14)
    expect(d.globalAutoAccept).toBe(false)
    expect(d.sidebarCollapsed).toBe(false)
    expect(d.window).toEqual({ width: 1200, height: 800 })
  })

  it('validates fontSize range 12-20', () => {
    expect(isValidFontSize(12)).toBe(true)
    expect(isValidFontSize(20)).toBe(true)
    expect(isValidFontSize(11)).toBe(false)
    expect(isValidFontSize(21)).toBe(false)
  })
})
