import { Cartesian3 } from 'cesium'
import { createServerFn } from '@tanstack/react-start'
import { createLogger } from '../lib/logger'
import type {
  AircraftPositionsResult,
  OpenSkyResponse,
  OpenSkyState,
  SerializedCartesian3,
} from '../types/opensky'

const log = createLogger('opensky:server')

const OPEN_SKY_STATES_URL = 'https://opensky-network.org/api/states/all'

const DATA_INDEX = {
  LONGITUDE: 5,
  LATITUDE: 6,
  GEO_ALTITUDE: 13,
} as const

const EMPTY_RESULT: AircraftPositionsResult = { positions: [] }

function stateToCartesian(state: OpenSkyState): SerializedCartesian3 {
  const cartesian = Cartesian3.fromDegrees(
    (state[DATA_INDEX.LONGITUDE] as number | null) ?? 0,
    (state[DATA_INDEX.LATITUDE] as number | null) ?? 0,
    (state[DATA_INDEX.GEO_ALTITUDE] as number | null) ?? 0,
  )
  return { x: cartesian.x, y: cartesian.y, z: cartesian.z }
}

function mapStatesToCartesians(states: OpenSkyState[]): SerializedCartesian3[] {
  return states.map(stateToCartesian)
}

function failureResult(
  message: string,
  options?: { statusCode?: number; retryAfterSeconds?: number },
): AircraftPositionsResult {
  return { ...EMPTY_RESULT, error: message, ...options }
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

export const fetchOpenSkyStates = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AircraftPositionsResult> => {
    const startedAt = performance.now()
    log.info('Fetching OpenSky states', { url: OPEN_SKY_STATES_URL })

    try {
      const response = await fetch(OPEN_SKY_STATES_URL, {
        headers: { Accept: 'application/json' },
      })

      const fetchDurationMs = Math.round(performance.now() - startedAt)

      if (!response.ok) {
        const retryAfterSeconds = parseRetryAfterSeconds(
          response.headers.get('Retry-After'),
        )
        const message = `OpenSky request failed: ${response.status}`
        log.warn(message, {
          status: response.status,
          statusText: response.statusText,
          fetchDurationMs,
          retryAfterSeconds,
        })
        return failureResult(message, {
          statusCode: response.status,
          retryAfterSeconds,
        })
      }

      const data = (await response.json()) as OpenSkyResponse
      const states = data.states ?? []

      const mapStartedAt = performance.now()
      const positions = mapStatesToCartesians(states)
      const mapDurationMs = Math.round(performance.now() - mapStartedAt)
      const totalDurationMs = Math.round(performance.now() - startedAt)

      log.info('Mapped aircraft to Cartesian positions', {
        aircraftCount: states.length,
        positionCount: positions.length,
        apiTime: data.time,
        fetchDurationMs,
        mapDurationMs,
        totalDurationMs,
      })

      return {
        apiTime: data.time,
        positions,
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'OpenSky request failed'
      log.warn('OpenSky unavailable; returning empty aircraft set', {
        message,
        durationMs: Math.round(performance.now() - startedAt),
      })
      return failureResult(message)
    }
  },
)
