export type OpenSkyState = (number | string | null)[]

export type OpenSkyResponse = {
  time?: number
  states: OpenSkyState[] | null
}

/** JSON-serializable Cartesian3 for RPC from server to client. */
export type SerializedCartesian3 = {
  x: number
  y: number
  z: number
}

export type AircraftPositionsResult = {
  apiTime?: number
  positions: SerializedCartesian3[]
  /** Set when OpenSky could not be reached; globe should still render. */
  error?: string
  /** HTTP status when OpenSky returned a non-2xx response. */
  statusCode?: number
  /** Retry-After header value in seconds, when provided by OpenSky. */
  retryAfterSeconds?: number
}
