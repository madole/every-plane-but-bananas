import { afterEach, describe, expect, it, vi } from 'vitest'
import { cartesianFromDegrees } from '../lib/geodetic'
import {
  fetchAviationstackPositions,
  mapFlightsToPositions,
} from './aviationstack'
import type { AviationstackFlight } from '../types/aviationstack'

describe('mapFlightsToPositions', () => {
  it('maps live latitude/longitude/altitude (metres) to Cartesian positions', () => {
    const flights: AviationstackFlight[] = [
      {
        flight_status: 'active',
        live: {
          latitude: 47,
          longitude: 8,
          altitude: 10_000,
          is_ground: false,
        },
      },
    ]

    expect(mapFlightsToPositions(flights)).toEqual([
      cartesianFromDegrees(8, 47, 10_000),
    ])
  })

  it('treats null altitude as sea level', () => {
    const flights: AviationstackFlight[] = [
      {
        live: { latitude: 47, longitude: 8, altitude: null },
      },
    ]

    expect(mapFlightsToPositions(flights)).toEqual([
      cartesianFromDegrees(8, 47, 0),
    ])
  })

  it('skips flights without live geolocation', () => {
    const flights: AviationstackFlight[] = [
      { live: null },
      {
        live: {
          latitude: 40,
          longitude: -74,
          altitude: 5000,
          is_ground: false,
        },
      },
    ]

    expect(mapFlightsToPositions(flights)).toHaveLength(1)
  })

  it('skips grounded aircraft', () => {
    const flights: AviationstackFlight[] = [
      {
        live: {
          latitude: 47,
          longitude: 8,
          altitude: 0,
          is_ground: true,
        },
      },
    ]

    expect(mapFlightsToPositions(flights)).toEqual([])
  })
})

describe('fetchAviationstackPositions', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('returns an error when AVIATIONSTACK_ACCESS_KEY is missing', async () => {
    vi.stubEnv('AVIATIONSTACK_ACCESS_KEY', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchAviationstackPositions()

    expect(result.error).toMatch(/AVIATIONSTACK_ACCESS_KEY/i)
    expect(result.source).toBe('aviationstack')
    expect(result.positions).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps a successful flights response into positions', async () => {
    vi.stubEnv('AVIATIONSTACK_ACCESS_KEY', 'test-key')
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              pagination: { limit: 100, offset: 0, count: 1, total: 1 },
              data: [
                {
                  flight_status: 'active',
                  live: {
                    latitude: 47,
                    longitude: 8,
                    altitude: 9000,
                    is_ground: false,
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
      ),
    )

    const result = await fetchAviationstackPositions()

    expect(result.error).toBeUndefined()
    expect(result.source).toBe('aviationstack')
    expect(result.positions).toEqual([cartesianFromDegrees(8, 47, 9000)])
  })

  it('surfaces Aviationstack JSON error payloads', async () => {
    vi.stubEnv('AVIATIONSTACK_ACCESS_KEY', 'bad-key')
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: 'invalid_access_key',
                message: 'You have not supplied a valid API Access Key.',
              },
            }),
            { status: 401, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
      ),
    )

    const result = await fetchAviationstackPositions()

    expect(result.statusCode).toBe(401)
    expect(result.source).toBe('aviationstack')
    expect(result.error).toMatch(/valid API Access Key/i)
    expect(result.positions).toEqual([])
  })
})
