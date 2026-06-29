import { createServerFn } from '@tanstack/react-start'
import { fetchAdsbFiPositions } from './adsbfi'
import { fetchOpenSkyPositions } from './opensky'
import { readPrimarySource, resolveAircraftPositions } from './aircraft-source'
import type { AircraftPositionsResult } from '../types/opensky'

/**
 * Server function the client polls for aircraft positions. Tries the preferred
 * provider (`AIRCRAFT_SOURCE`, default `opensky`) and falls back to the other so
 * the globe keeps showing planes when one upstream is blocked or rate-limited.
 */
export const fetchAircraftPositions = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AircraftPositionsResult> =>
    resolveAircraftPositions(readPrimarySource(), {
      opensky: fetchOpenSkyPositions,
      adsbfi: fetchAdsbFiPositions,
    }),
)
