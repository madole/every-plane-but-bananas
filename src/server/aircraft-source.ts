import { createLogger } from '../lib/logger'
import type {
  AircraftPositionsResult,
  AircraftSource,
} from '../types/opensky'

const log = createLogger('aircraft:server')

export type AircraftFetchers = {
  opensky: () => Promise<AircraftPositionsResult>
  adsbfi: () => Promise<AircraftPositionsResult>
}

function isAircraftSource(value: string | undefined): value is AircraftSource {
  return value === 'opensky' || value === 'adsbfi'
}

/** Preferred upstream provider; the other is used as a fallback. */
export function readPrimarySource(): AircraftSource {
  const raw = process.env.AIRCRAFT_SOURCE
  return isAircraftSource(raw) ? raw : 'opensky'
}

function hasUsableData(result: AircraftPositionsResult): boolean {
  return !result.error && result.positions.length > 0
}

/**
 * Fetch from the primary provider, falling back to the other when the primary
 * errors or returns nothing. Keeps the primary error (with any Retry-After) when
 * both providers fail so the client's polling backoff still applies.
 */
export async function resolveAircraftPositions(
  primary: AircraftSource,
  fetchers: AircraftFetchers,
): Promise<AircraftPositionsResult> {
  const fallback: AircraftSource = primary === 'opensky' ? 'adsbfi' : 'opensky'

  const primaryResult = await fetchers[primary]()
  if (hasUsableData(primaryResult)) {
    return primaryResult
  }

  log.info('Primary aircraft source unavailable; trying fallback', {
    primary,
    fallback,
    primaryError: primaryResult.error,
    primaryCount: primaryResult.positions.length,
  })

  const fallbackResult = await fetchers[fallback]()
  if (!fallbackResult.error) {
    return fallbackResult
  }

  return primaryResult.error ? primaryResult : fallbackResult
}
