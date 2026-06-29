import { describe, expect, it, vi } from 'vitest'
import { resolveAircraftPositions } from './aircraft-source'
import type { AircraftPositionsResult } from '../types/opensky'

function result(
  partial: Partial<AircraftPositionsResult>,
): AircraftPositionsResult {
  return { positions: [], ...partial }
}

describe('resolveAircraftPositions', () => {
  it('returns the primary result and skips the fallback when primary has data', async () => {
    const opensky = vi.fn(() =>
      Promise.resolve(
        result({ positions: [{ x: 1, y: 2, z: 3 }], source: 'opensky' }),
      ),
    )
    const adsbfi = vi.fn(() => Promise.resolve(result({})))

    const resolved = await resolveAircraftPositions('opensky', {
      opensky,
      adsbfi,
    })

    expect(resolved.source).toBe('opensky')
    expect(adsbfi).not.toHaveBeenCalled()
  })

  it('falls back to the other source when the primary errors', async () => {
    const opensky = vi.fn(() =>
      Promise.resolve(result({ error: 'ECONNRESET', source: 'opensky' })),
    )
    const adsbfi = vi.fn(() =>
      Promise.resolve(
        result({ positions: [{ x: 4, y: 5, z: 6 }], source: 'adsbfi' }),
      ),
    )

    const resolved = await resolveAircraftPositions('opensky', {
      opensky,
      adsbfi,
    })

    expect(resolved.source).toBe('adsbfi')
    expect(resolved.positions).toHaveLength(1)
    expect(adsbfi).toHaveBeenCalledOnce()
  })

  it('falls back when the primary returns no data without an error', async () => {
    const opensky = vi.fn(() => Promise.resolve(result({ source: 'opensky' })))
    const adsbfi = vi.fn(() =>
      Promise.resolve(
        result({ positions: [{ x: 7, y: 8, z: 9 }], source: 'adsbfi' }),
      ),
    )

    const resolved = await resolveAircraftPositions('opensky', {
      opensky,
      adsbfi,
    })

    expect(resolved.source).toBe('adsbfi')
  })

  it('honors the requested primary source', async () => {
    const opensky = vi.fn(() => Promise.resolve(result({})))
    const adsbfi = vi.fn(() =>
      Promise.resolve(
        result({ positions: [{ x: 1, y: 1, z: 1 }], source: 'adsbfi' }),
      ),
    )

    const resolved = await resolveAircraftPositions('adsbfi', {
      opensky,
      adsbfi,
    })

    expect(resolved.source).toBe('adsbfi')
    expect(opensky).not.toHaveBeenCalled()
  })

  it('keeps the primary error when both sources fail', async () => {
    const opensky = vi.fn(() =>
      Promise.resolve(
        result({
          error: 'OpenSky request failed: 429',
          retryAfterSeconds: 120,
          source: 'opensky',
        }),
      ),
    )
    const adsbfi = vi.fn(() =>
      Promise.resolve(result({ error: 'adsb.fi down', source: 'adsbfi' })),
    )

    const resolved = await resolveAircraftPositions('opensky', {
      opensky,
      adsbfi,
    })

    expect(resolved.source).toBe('opensky')
    expect(resolved.retryAfterSeconds).toBe(120)
  })
})
