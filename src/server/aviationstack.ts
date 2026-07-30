import { cartesianFromDegrees } from '../lib/geodetic'
import { createLogger } from '../lib/logger'
import {
  isAviationstackFlightsResponse,
  isAviationstackLive,
} from '../types/aviationstack'
import type {
  AviationstackFlight,
  AviationstackFlightsResponse,
} from '../types/aviationstack'
import type {
  AircraftPositionsResult,
  SerializedCartesian3,
} from '../types/aircraft'

const log = createLogger('aviationstack:server')

const DEFAULT_BASE_URL = 'https://api.aviationstack.com/v1/flights'
/** Aviationstack caps `limit` at 100 per request. */
const MAX_LIMIT = 100
const DEFAULT_LIMIT = 100
const REQUEST_TIMEOUT_MS = 8000

const EMPTY_RESULT: AircraftPositionsResult = { positions: [] }

function failureResult(
  message: string,
  options?: { statusCode?: number; retryAfterSeconds?: number },
): AircraftPositionsResult {
  return {
    ...EMPTY_RESULT,
    error: message,
    source: 'aviationstack',
    ...options,
  }
}

function readAccessKey(): string | undefined {
  const key = process.env.AVIATIONSTACK_ACCESS_KEY?.trim()
  return key && key.length > 0 ? key : undefined
}

function readLimit(): number {
  const raw = process.env.AVIATIONSTACK_LIMIT
  if (raw === undefined) {
    return DEFAULT_LIMIT
  }
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT
  }
  return Math.min(parsed, MAX_LIMIT)
}

function readBaseUrl(): string {
  const raw = process.env.AVIATIONSTACK_BASE_URL?.trim()
  return raw && raw.length > 0 ? raw : DEFAULT_BASE_URL
}

function buildRequestUrl(accessKey: string, limit: number): string {
  const url = new URL(readBaseUrl())
  url.searchParams.set('access_key', accessKey)
  url.searchParams.set('flight_status', 'active')
  url.searchParams.set('limit', String(limit))
  return url.toString()
}

function parseRetryAfterSeconds(header: string | null): number | undefined {
  if (!header) {
    return undefined
  }

  const seconds = Number.parseInt(header, 10)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds
  }

  const retryAt = Date.parse(header)
  if (Number.isNaN(retryAt)) {
    return undefined
  }

  return Math.max(0, Math.ceil((retryAt - Date.now()) / 1000))
}

function errorMessageFromPayload(
  data: AviationstackFlightsResponse,
  status: number,
): string {
  const message = data.error?.message?.trim()
  if (message && message.length > 0) {
    return message
  }
  const code = data.error?.code?.trim()
  if (code && code.length > 0) {
    return `Aviationstack request failed: ${code}`
  }
  return `Aviationstack request failed: ${status}`
}

/**
 * Normalize Aviationstack flight records into the shared Cartesian position
 * format. Only flights with live airborne geolocation are included.
 */
export function mapFlightsToPositions(
  flights: AviationstackFlight[],
): SerializedCartesian3[] {
  const positions: SerializedCartesian3[] = []
  for (const flight of flights) {
    const { live } = flight
    if (!isAviationstackLive(live) || live.is_ground === true) {
      continue
    }
    positions.push(
      cartesianFromDegrees(live.longitude, live.latitude, live.altitude ?? 0),
    )
  }
  return positions
}

export async function fetchAviationstackPositions(): Promise<AircraftPositionsResult> {
  const accessKey = readAccessKey()
  if (!accessKey) {
    return failureResult(
      'AVIATIONSTACK_ACCESS_KEY is not set; cannot fetch aircraft positions',
    )
  }

  const limit = readLimit()
  const url = buildRequestUrl(accessKey, limit)
  const startedAt = performance.now()
  log.info('Fetching Aviationstack flights', {
    limit,
    baseUrl: readBaseUrl(),
  })

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    const fetchDurationMs = Math.round(performance.now() - startedAt)
    const retryAfterSeconds = parseRetryAfterSeconds(
      response.headers.get('Retry-After'),
    )

    const payload: unknown = await response.json()
    if (!isAviationstackFlightsResponse(payload)) {
      return failureResult('Aviationstack returned an unexpected payload', {
        statusCode: response.status,
        retryAfterSeconds,
      })
    }

    if (!response.ok || payload.error) {
      const message = errorMessageFromPayload(payload, response.status)
      log.warn(message, {
        status: response.status,
        fetchDurationMs,
        retryAfterSeconds,
        errorCode: payload.error?.code,
      })
      return failureResult(message, {
        statusCode: response.status,
        retryAfterSeconds,
      })
    }

    const flights = payload.data ?? []
    const mapStartedAt = performance.now()
    const positions = mapFlightsToPositions(flights)
    const mapDurationMs = Math.round(performance.now() - mapStartedAt)
    const totalDurationMs = Math.round(performance.now() - startedAt)

    log.info('Mapped Aviationstack flights to Cartesian positions', {
      flightCount: flights.length,
      positionCount: positions.length,
      paginationTotal: payload.pagination?.total,
      fetchDurationMs,
      mapDurationMs,
      totalDurationMs,
    })

    return {
      positions,
      source: 'aviationstack',
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Aviationstack request failed'
    log.warn('Aviationstack unavailable; returning empty aircraft set', {
      message,
      durationMs: Math.round(performance.now() - startedAt),
    })
    return failureResult(message)
  }
}
