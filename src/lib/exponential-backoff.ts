export const OPENSKY_BASE_POLL_MS = 30 * 1000
export const OPENSKY_MAX_BACKOFF_MS = 5 * 60 * 1000
const BACKOFF_MULTIPLIER = 2

/**
 * Delay before the next OpenSky poll after consecutive failures.
 * Uses exponential backoff with optional server Retry-After hint and light jitter.
 */
export function nextOpenSkyPollDelayMs(
  consecutiveFailures: number,
  retryAfterSeconds?: number,
): number {
  if (consecutiveFailures <= 0) {
    return OPENSKY_BASE_POLL_MS
  }

  const exponentialDelay =
    OPENSKY_BASE_POLL_MS * Math.pow(BACKOFF_MULTIPLIER, consecutiveFailures)
  const cappedDelay = Math.min(exponentialDelay, OPENSKY_MAX_BACKOFF_MS)

  const retryAfterMs =
    retryAfterSeconds !== undefined && Number.isFinite(retryAfterSeconds)
      ? retryAfterSeconds * 1000
      : 0
  const baseDelay = Math.max(cappedDelay, retryAfterMs)

  const jitter = baseDelay * 0.1 * (Math.random() * 2 - 1)
  return Math.round(Math.min(baseDelay + jitter, OPENSKY_MAX_BACKOFF_MS))
}
