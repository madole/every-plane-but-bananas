import { cartesianFromDegrees } from '../lib/geodetic'
import { createLogger } from '../lib/logger'
import { isAdsbFiResponse } from '../types/adsbfi'
import type { AdsbFiAircraft, AdsbFiResponse } from '../types/adsbfi'
import type {
  AircraftPositionsResult,
  SerializedCartesian3,
} from '../types/opensky'

const log = createLogger('adsbfi:server')

const FEET_TO_METERS = 0.3048
/** readsb-compatible APIs cap the search radius at 250 nautical miles. */
const MAX_DISTANCE_NM = 250
const DEFAULT_LAT = 50
const DEFAULT_LON = 8
const DEFAULT_DIST_NM = 250
const REQUEST_TIMEOUT_MS = 8000

function readNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined) {
    return fallback
  }
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

function buildRequestUrl(): string {
  const lat = readNumberEnv('ADSBFI_LAT', DEFAULT_LAT)
  const lon = readNumberEnv('ADSBFI_LON', DEFAULT_LON)
  const dist = Math.min(
    readNumberEnv('ADSBFI_DIST', DEFAULT_DIST_NM),
    MAX_DISTANCE_NM,
  )
  return `https://opendata.adsb.fi/api/v2/lat/${lat}/lon/${lon}/dist/${dist}`
}

function altitudeMeters(aircraft: AdsbFiAircraft): number {
  const { alt_geom: geometric, alt_baro: barometric } = aircraft
  if (typeof geometric === 'number' && Number.isFinite(geometric)) {
    return geometric * FEET_TO_METERS
  }
  // `alt_baro` is the string "ground" for grounded aircraft; treat as sea level.
  if (typeof barometric === 'number' && Number.isFinite(barometric)) {
    return barometric * FEET_TO_METERS
  }
  return 0
}

/** Normalize an adsb.fi payload into the shared Cartesian position format. */
export function mapAdsbFiToPositions(
  response: AdsbFiResponse,
): SerializedCartesian3[] {
  const aircraft = response.aircraft ?? response.ac ?? []
  const positions: SerializedCartesian3[] = []
  for (const entry of aircraft) {
    const { lat, lon } = entry
    if (typeof lat !== 'number' || !Number.isFinite(lat)) {
      continue
    }
    if (typeof lon !== 'number' || !Number.isFinite(lon)) {
      continue
    }
    positions.push(cartesianFromDegrees(lon, lat, altitudeMeters(entry)))
  }
  return positions
}

export async function fetchAdsbFiPositions(): Promise<AircraftPositionsResult> {
  const url = buildRequestUrl()
  const startedAt = performance.now()
  log.info('Fetching adsb.fi aircraft', { url })

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    const fetchDurationMs = Math.round(performance.now() - startedAt)

    if (!response.ok) {
      const message = `adsb.fi request failed: ${response.status}`
      log.warn(message, {
        status: response.status,
        statusText: response.statusText,
        fetchDurationMs,
      })
      return {
        positions: [],
        error: message,
        statusCode: response.status,
        source: 'adsbfi',
      }
    }

    const data: unknown = await response.json()
    if (!isAdsbFiResponse(data)) {
      const message = 'adsb.fi returned an unexpected payload'
      log.warn(message, { fetchDurationMs })
      return { positions: [], error: message, source: 'adsbfi' }
    }

    const positions = mapAdsbFiToPositions(data)
    log.info('Mapped adsb.fi aircraft to Cartesian positions', {
      positionCount: positions.length,
      apiTime: data.now,
      fetchDurationMs,
    })

    return { apiTime: data.now, positions, source: 'adsbfi' }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'adsb.fi request failed'
    log.warn('adsb.fi unavailable; returning empty aircraft set', {
      message,
      durationMs: Math.round(performance.now() - startedAt),
    })
    return { positions: [], error: message, source: 'adsbfi' }
  }
}
