/** Subset of the adsb.fi (readsb-compatible) aircraft record we consume. */
export type AdsbFiAircraft = {
  /** 24-bit ICAO address; used to de-duplicate overlapping regional queries. */
  hex?: string
  lat?: number
  lon?: number
  /** Geometric (WGS84) altitude in feet. */
  alt_geom?: number
  /** Barometric altitude in feet, or the string "ground". */
  alt_baro?: number | string
}

export type AdsbFiResponse = {
  /** Server timestamp in epoch seconds. */
  now?: number
  /** adsb.fi uses `aircraft`; some readsb-compatible APIs use `ac`. */
  aircraft?: AdsbFiAircraft[]
  ac?: AdsbFiAircraft[]
}

export function isAdsbFiResponse(value: unknown): value is AdsbFiResponse {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  const list = record.aircraft ?? record.ac
  return list === undefined || Array.isArray(list)
}
