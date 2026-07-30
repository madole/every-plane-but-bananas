import { createServerFn } from '@tanstack/react-start'
import { fetchAdsbFiPositions } from './adsbfi'
import { fetchAviationstackPositions } from './aviationstack'
import { readPrimarySource, resolveAircraftPositions } from './aircraft-source'
import type { AircraftPositionsResult } from '../types/aircraft'

/**
 * Server function the client polls for aircraft positions. Tries the preferred
 * provider (`AIRCRAFT_SOURCE`, default `aviationstack`) and falls back to the
 * other so the globe keeps showing planes when one upstream is blocked,
 * rate-limited, or returns nothing.
 */
export const fetchAircraftPositions = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AircraftPositionsResult> =>
    resolveAircraftPositions(readPrimarySource(), {
      aviationstack: fetchAviationstackPositions,
      adsbfi: fetchAdsbFiPositions,
    }),
)
