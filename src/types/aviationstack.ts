/** Live geolocation subset from Aviationstack's `/v1/flights` response. */
export type AviationstackLive = {
  latitude: number
  longitude: number
  /** Altitude in metres (WGS84). */
  altitude?: number | null
  is_ground?: boolean | null
  updated?: string | null
}

export type AviationstackFlight = {
  flight_status?: string | null
  live: AviationstackLive | null
}

export type AviationstackPagination = {
  limit?: number
  offset?: number
  count?: number
  total?: number
}

export type AviationstackError = {
  code?: string
  message?: string
}

export type AviationstackFlightsResponse = {
  pagination?: AviationstackPagination
  data?: AviationstackFlight[]
  error?: AviationstackError
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function isAviationstackLive(value: unknown): value is AviationstackLive {
  if (!isRecord(value)) {
    return false
  }
  if (!isFiniteNumber(value.latitude) || !isFiniteNumber(value.longitude)) {
    return false
  }
  if (
    value.altitude !== undefined &&
    value.altitude !== null &&
    !isFiniteNumber(value.altitude)
  ) {
    return false
  }
  return true
}

export function isAviationstackFlight(
  value: unknown,
): value is AviationstackFlight {
  if (!isRecord(value)) {
    return false
  }
  return value.live === null || isAviationstackLive(value.live)
}

export function isAviationstackFlightsResponse(
  value: unknown,
): value is AviationstackFlightsResponse {
  if (!isRecord(value)) {
    return false
  }
  if (value.data !== undefined && !Array.isArray(value.data)) {
    return false
  }
  if (value.error !== undefined && !isRecord(value.error)) {
    return false
  }
  return true
}
