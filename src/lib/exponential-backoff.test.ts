import { describe, expect, it, vi } from 'vitest'
import {
  nextOpenSkyPollDelayMs,
  OPENSKY_BASE_POLL_MS,
  OPENSKY_MAX_BACKOFF_MS,
} from './exponential-backoff'

describe('nextOpenSkyPollDelayMs', () => {
  it('returns the base interval when there are no failures', () => {
    expect(nextOpenSkyPollDelayMs(0)).toBe(OPENSKY_BASE_POLL_MS)
  })

  it('doubles delay on each consecutive failure up to the cap', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    expect(nextOpenSkyPollDelayMs(1)).toBe(OPENSKY_BASE_POLL_MS * 2)
    expect(nextOpenSkyPollDelayMs(2)).toBe(OPENSKY_BASE_POLL_MS * 4)
    expect(nextOpenSkyPollDelayMs(3)).toBe(OPENSKY_BASE_POLL_MS * 8)
    expect(nextOpenSkyPollDelayMs(10)).toBe(OPENSKY_MAX_BACKOFF_MS)

    vi.restoreAllMocks()
  })

  it('honors Retry-After when it exceeds exponential delay', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    expect(nextOpenSkyPollDelayMs(1, 120)).toBe(120_000)

    vi.restoreAllMocks()
  })
})
