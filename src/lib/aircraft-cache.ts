import type { SerializedCartesian3 } from '../types/opensky'

const STORAGE_KEY = 'every-plane-but-bananas:aircraft-cache'

export type CachedAircraftData = {
  lastUpdatedAt: string
  apiTime?: number
  positions: SerializedCartesian3[]
}

function isSerializedCartesian3(value: unknown): value is SerializedCartesian3 {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    typeof record.x === 'number' &&
    typeof record.y === 'number' &&
    typeof record.z === 'number'
  )
}

function isCachedAircraftData(value: unknown): value is CachedAircraftData {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  if (typeof record.lastUpdatedAt !== 'string') {
    return false
  }
  if (Number.isNaN(Date.parse(record.lastUpdatedAt))) {
    return false
  }
  if (!Array.isArray(record.positions)) {
    return false
  }
  return record.positions.every(isSerializedCartesian3)
}

export function loadCachedAircraft(): CachedAircraftData | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }
    const parsed: unknown = JSON.parse(raw)
    if (!isCachedAircraftData(parsed)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function saveCachedAircraft(data: CachedAircraftData): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Quota exceeded or private browsing — ignore.
  }
}
