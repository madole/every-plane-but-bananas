import { describe, expect, it } from 'vitest'
import { mapAdsbFiToPositions } from './adsbfi'
import { cartesianFromDegrees } from '../lib/geodetic'
import type { AdsbFiResponse } from '../types/adsbfi'

const FEET_TO_METERS = 0.3048

describe('mapAdsbFiToPositions', () => {
  it('maps aircraft using geometric altitude converted from feet to metres', () => {
    const response: AdsbFiResponse = {
      aircraft: [{ lat: 47, lon: 8, alt_geom: 36000 }],
    }

    expect(mapAdsbFiToPositions(response)).toEqual([
      cartesianFromDegrees(8, 47, 36000 * FEET_TO_METERS),
    ])
  })

  it('falls back to barometric altitude when geometric is missing', () => {
    const response: AdsbFiResponse = {
      aircraft: [{ lat: 47, lon: 8, alt_baro: 1000 }],
    }

    expect(mapAdsbFiToPositions(response)).toEqual([
      cartesianFromDegrees(8, 47, 1000 * FEET_TO_METERS),
    ])
  })

  it('treats grounded aircraft (alt_baro "ground") as sea level', () => {
    const response: AdsbFiResponse = {
      aircraft: [{ lat: 47, lon: 8, alt_baro: 'ground' }],
    }

    expect(mapAdsbFiToPositions(response)).toEqual([
      cartesianFromDegrees(8, 47, 0),
    ])
  })

  it('skips aircraft without a finite lat/lon', () => {
    const response: AdsbFiResponse = {
      aircraft: [
        { lat: 47, alt_geom: 100 },
        { lon: 8, alt_geom: 100 },
        { lat: 47, lon: 8, alt_geom: 100 },
      ],
    }

    expect(mapAdsbFiToPositions(response)).toHaveLength(1)
  })

  it('supports the readsb-compatible `ac` key', () => {
    const response: AdsbFiResponse = {
      ac: [{ lat: 47, lon: 8, alt_geom: 0 }],
    }

    expect(mapAdsbFiToPositions(response)).toEqual([
      cartesianFromDegrees(8, 47, 0),
    ])
  })

  it('returns an empty array when there are no aircraft', () => {
    expect(mapAdsbFiToPositions({})).toEqual([])
  })
})
