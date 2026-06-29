import { cartesianFromDegrees } from '../lib/geodetic'
import { createLogger } from '../lib/logger'
import { isAdsbFiResponse } from '../types/adsbfi'
import type { AdsbFiAircraft } from '../types/adsbfi'
import type {
  AircraftPositionsResult,
  SerializedCartesian3,
} from '../types/opensky'

const log = createLogger('adsbfi:server')

const FEET_TO_METERS = 0.3048
/** readsb-compatible APIs cap the search radius at 250 nautical miles. */
const MAX_DISTANCE_NM = 250
const DEFAULT_DIST_NM = 250
const REQUEST_TIMEOUT_MS = 8000

type GeoPoint = { lat: number; lon: number }

/**
 * adsb.fi is radius-based (max 250 nm), so a single query is regional. To
 * approximate global coverage we fan out across busy ADS-B regions and merge
 * the results, de-duplicating aircraft that appear in overlapping bubbles.
 * Coverage follows the community receiver network (dense over land, sparse over
 * open ocean), so these centers target populated airspace worldwide.
 */
const GLOBAL_QUERY_CENTERS: GeoPoint[] = [
  // North America
  { lat: 47, lon: -122 },
  { lat: 40, lon: -74 },
  { lat: 34, lon: -118 },
  { lat: 41, lon: -88 },
  { lat: 33, lon: -97 },
  { lat: 28, lon: -81 },
  { lat: 45, lon: -75 },
  { lat: 19, lon: -99 },
  // South America
  { lat: -23, lon: -46 },
  { lat: -34, lon: -58 },
  { lat: 4, lon: -74 },
  // Europe
  { lat: 51, lon: 0 },
  { lat: 50, lon: 8 },
  { lat: 41, lon: 12 },
  { lat: 40, lon: -3 },
  { lat: 59, lon: 18 },
  { lat: 55, lon: 37 },
  // Africa & Middle East
  { lat: 30, lon: 31 },
  { lat: 25, lon: 55 },
  { lat: -26, lon: 28 },
  // Asia
  { lat: 28, lon: 77 },
  { lat: 19, lon: 72 },
  { lat: 13, lon: 100 },
  { lat: 1, lon: 103 },
  { lat: 22, lon: 114 },
  { lat: 31, lon: 121 },
  { lat: 39, lon: 116 },
  { lat: 35, lon: 139 },
  { lat: 37, lon: 126 },
  // Oceania
  { lat: -33, lon: 151 },
  { lat: -37, lon: 144 },
]

type CenterFetchResult = {
  aircraft: AdsbFiAircraft[]
  now?: number
  error?: string
}

function readNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined) {
    return fallback
  }
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

function readDistanceNm(): number {
  return Math.min(readNumberEnv('ADSBFI_DIST', DEFAULT_DIST_NM), MAX_DISTANCE_NM)
}

/**
 * When both ADSBFI_LAT and ADSBFI_LON are set, query that single region;
 * otherwise fan out across the global centers for near-global coverage.
 */
function readQueryCenters(): GeoPoint[] {
  const rawLat = process.env.ADSBFI_LAT
  const rawLon = process.env.ADSBFI_LON
  if (rawLat !== undefined && rawLon !== undefined) {
    const lat = Number.parseFloat(rawLat)
    const lon = Number.parseFloat(rawLon)
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return [{ lat, lon }]
    }
  }
  return GLOBAL_QUERY_CENTERS
}

function buildRequestUrl(center: GeoPoint, distanceNm: number): string {
  return `https://opendata.adsb.fi/api/v2/lat/${center.lat}/lon/${center.lon}/dist/${distanceNm}`
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

/** Merge aircraft from overlapping regional queries, de-duplicating by ICAO hex. */
export function dedupeAircraft(groups: AdsbFiAircraft[][]): AdsbFiAircraft[] {
  const byHex = new Map<string, AdsbFiAircraft>()
  const withoutHex: AdsbFiAircraft[] = []
  for (const group of groups) {
    for (const aircraft of group) {
      if (typeof aircraft.hex === 'string' && aircraft.hex.length > 0) {
        if (!byHex.has(aircraft.hex)) {
          byHex.set(aircraft.hex, aircraft)
        }
      } else {
        withoutHex.push(aircraft)
      }
    }
  }
  return [...byHex.values(), ...withoutHex]
}

/** Normalize adsb.fi aircraft records into the shared Cartesian position format. */
export function mapAircraftToPositions(
  aircraft: AdsbFiAircraft[],
): SerializedCartesian3[] {
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

async function fetchCenter(
  center: GeoPoint,
  distanceNm: number,
): Promise<CenterFetchResult> {
  const url = buildRequestUrl(center, distanceNm)
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    if (!response.ok) {
      return { aircraft: [], error: `adsb.fi request failed: ${response.status}` }
    }

    const data: unknown = await response.json()
    if (!isAdsbFiResponse(data)) {
      return { aircraft: [], error: 'adsb.fi returned an unexpected payload' }
    }

    return { aircraft: data.aircraft ?? data.ac ?? [], now: data.now }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'adsb.fi request failed'
    return { aircraft: [], error: message }
  }
}

export async function fetchAdsbFiPositions(): Promise<AircraftPositionsResult> {
  const centers = readQueryCenters()
  const distanceNm = readDistanceNm()
  const startedAt = performance.now()
  log.info('Fetching adsb.fi aircraft', {
    centerCount: centers.length,
    distanceNm,
  })

  const results = await Promise.all(
    centers.map((center) => fetchCenter(center, distanceNm)),
  )
  const fetchDurationMs = Math.round(performance.now() - startedAt)
  const successes = results.filter((result) => result.error === undefined)

  if (successes.length === 0) {
    const message = results[0]?.error ?? 'adsb.fi request failed'
    log.warn('adsb.fi unavailable; returning empty aircraft set', {
      message,
      centerCount: centers.length,
      durationMs: fetchDurationMs,
    })
    return { positions: [], error: message, source: 'adsbfi' }
  }

  const merged = dedupeAircraft(successes.map((result) => result.aircraft))
  const positions = mapAircraftToPositions(merged)
  const apiTime = successes.find((result) => typeof result.now === 'number')?.now

  log.info('Mapped adsb.fi aircraft to Cartesian positions', {
    centerCount: centers.length,
    successfulCenters: successes.length,
    mergedAircraft: merged.length,
    positionCount: positions.length,
    apiTime,
    fetchDurationMs,
  })

  return { apiTime, positions, source: 'adsbfi' }
}
