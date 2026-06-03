import { afterEach, describe, expect, it } from 'vitest'
import {
  loadCachedAircraft,
  saveCachedAircraft,
  type CachedAircraftData,
} from './aircraft-cache'

const STORAGE_KEY = 'every-plane-but-bananas:aircraft-cache'

const sampleCache: CachedAircraftData = {
  lastUpdatedAt: '2026-06-03T10:00:00.000Z',
  apiTime: 1780444802,
  positions: [{ x: 1, y: 2, z: 3 }],
}

describe('aircraft-cache', () => {
  afterEach(() => {
    window.localStorage.removeItem(STORAGE_KEY)
  })

  it('returns null when nothing is stored', () => {
    expect(loadCachedAircraft()).toBeNull()
  })

  it('round-trips cached aircraft data', () => {
    saveCachedAircraft(sampleCache)
    expect(loadCachedAircraft()).toEqual(sampleCache)
  })

  it('returns null for invalid stored JSON', () => {
    window.localStorage.setItem(STORAGE_KEY, '{"lastUpdatedAt":"bad"}')
    expect(loadCachedAircraft()).toBeNull()
  })
})
