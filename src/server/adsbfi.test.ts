import { describe, expect, it } from 'vitest'
import { dedupeAircraft, mapAircraftToPositions } from './adsbfi'
import { cartesianFromDegrees } from '../lib/geodetic'
import type { AdsbFiAircraft } from '../types/adsbfi'

const FEET_TO_METERS = 0.3048

describe('mapAircraftToPositions', () => {
  it('maps aircraft using geometric altitude converted from feet to metres', () => {
    const aircraft: AdsbFiAircraft[] = [{ lat: 47, lon: 8, alt_geom: 36000 }]

    expect(mapAircraftToPositions(aircraft)).toEqual([
      cartesianFromDegrees(8, 47, 36000 * FEET_TO_METERS),
    ])
  })

  it('falls back to barometric altitude when geometric is missing', () => {
    const aircraft: AdsbFiAircraft[] = [{ lat: 47, lon: 8, alt_baro: 1000 }]

    expect(mapAircraftToPositions(aircraft)).toEqual([
      cartesianFromDegrees(8, 47, 1000 * FEET_TO_METERS),
    ])
  })

  it('treats grounded aircraft (alt_baro "ground") as sea level', () => {
    const aircraft: AdsbFiAircraft[] = [{ lat: 47, lon: 8, alt_baro: 'ground' }]

    expect(mapAircraftToPositions(aircraft)).toEqual([
      cartesianFromDegrees(8, 47, 0),
    ])
  })

  it('skips aircraft without a finite lat/lon', () => {
    const aircraft: AdsbFiAircraft[] = [
      { lat: 47, alt_geom: 100 },
      { lon: 8, alt_geom: 100 },
      { lat: 47, lon: 8, alt_geom: 100 },
    ]

    expect(mapAircraftToPositions(aircraft)).toHaveLength(1)
  })

  it('returns an empty array when there are no aircraft', () => {
    expect(mapAircraftToPositions([])).toEqual([])
  })
})

describe('dedupeAircraft', () => {
  it('removes aircraft that appear in multiple overlapping regions', () => {
    const groups: AdsbFiAircraft[][] = [
      [
        { hex: 'abc123', lat: 51, lon: 0 },
        { hex: 'def456', lat: 50, lon: 8 },
      ],
      [
        { hex: 'def456', lat: 50, lon: 8 },
        { hex: 'ghi789', lat: 48, lon: 2 },
      ],
    ]

    const merged = dedupeAircraft(groups)
    expect(merged).toHaveLength(3)
    expect(merged.map((aircraft) => aircraft.hex)).toEqual([
      'abc123',
      'def456',
      'ghi789',
    ])
  })

  it('keeps the first occurrence of a duplicated hex', () => {
    const groups: AdsbFiAircraft[][] = [
      [{ hex: 'abc123', lat: 10, lon: 10 }],
      [{ hex: 'abc123', lat: 99, lon: 99 }],
    ]

    expect(dedupeAircraft(groups)).toEqual([{ hex: 'abc123', lat: 10, lon: 10 }])
  })

  it('keeps all aircraft that have no hex', () => {
    const groups: AdsbFiAircraft[][] = [
      [{ lat: 1, lon: 1 }, { lat: 2, lon: 2 }],
      [{ hex: 'abc123', lat: 3, lon: 3 }],
    ]

    expect(dedupeAircraft(groups)).toHaveLength(3)
  })
})
