export const AIRCRAFT_BASE_POLL_MS = 30 * 1000
export const AIRCRAFT_MAX_BACKOFF_MS = 5 * 60 * 1000
const BACKOFF_MULTIPLIER = 2

/**
 * Delay before the next aircraft poll after consecutive failures.
 * Uses exponential backoff with optional server Retry-After hint and light jitter.
 */
export function nextAircraftPollDelayMs(
  consecutiveFailures: number,
  retryAfterSeconds?: number,
): number {
  if (consecutiveFailures <= 0) {
    return AIRCRAFT_BASE_POLL_MS
  }

  const exponentialDelay =
    AIRCRAFT_BASE_POLL_MS * Math.pow(BACKOFF_MULTIPLIER, consecutiveFailures)
  const cappedDelay = Math.min(exponentialDelay, AIRCRAFT_MAX_BACKOFF_MS)

  const retryAfterMs =
    retryAfterSeconds !== undefined && Number.isFinite(retryAfterSeconds)
      ? retryAfterSeconds * 1000
      : 0
  const baseDelay = Math.max(cappedDelay, retryAfterMs)

  const jitter = baseDelay * 0.1 * (Math.random() * 2 - 1)
  return Math.round(Math.min(baseDelay + jitter, AIRCRAFT_MAX_BACKOFF_MS))
}
