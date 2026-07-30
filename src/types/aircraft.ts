/** JSON-serializable Cartesian3 for RPC from server to client. */
export type SerializedCartesian3 = {
  x: number
  y: number
  z: number
}

/** Upstream aircraft data providers, in order of preference. */
export type AircraftSource = 'aviationstack' | 'adsbfi'

export type AircraftPositionsResult = {
  apiTime?: number
  positions: SerializedCartesian3[]
  /** Set when the upstream could not be reached; globe should still render. */
  error?: string
  /** HTTP status when the upstream returned a non-2xx response. */
  statusCode?: number
  /** Retry-After header value in seconds, when provided by the upstream. */
  retryAfterSeconds?: number
  /** Which provider produced this result (set on both success and failure). */
  source?: AircraftSource
}
