import type { SerializedCartesian3 } from '../types/aircraft'

/** WGS84 semi-major axis squared (m²). */
const WGS84_RADII_SQUARED_X = 6378137.0 * 6378137.0
/** WGS84 semi-minor axis squared (m²). */
const WGS84_RADII_SQUARED_Z = 6356752.314245179 * 6356752.314245179

/**
 * Geodetic WGS84 → ECEF, matching Cesium's Cartesian3.fromDegrees / Ellipsoid.WGS84.
 * Used on the server where Cesium (browser/WebGL) must not load.
 */
export function cartesianFromDegrees(
  longitude: number,
  latitude: number,
  height: number,
): SerializedCartesian3 {
  const lonRadians = (longitude * Math.PI) / 180
  const latRadians = (latitude * Math.PI) / 180
  const cosLatitude = Math.cos(latRadians)
  const sinLatitude = Math.sin(latRadians)
  const cosLongitude = Math.cos(lonRadians)
  const sinLongitude = Math.sin(lonRadians)

  const n =
    WGS84_RADII_SQUARED_X /
    Math.sqrt(
      cosLatitude * cosLatitude * WGS84_RADII_SQUARED_X +
        sinLatitude * sinLatitude * WGS84_RADII_SQUARED_Z,
    )

  return {
    x: (n + height) * cosLatitude * cosLongitude,
    y: (n + height) * cosLatitude * sinLongitude,
    z: ((n * WGS84_RADII_SQUARED_Z) / WGS84_RADII_SQUARED_X + height) * sinLatitude,
  }
}
