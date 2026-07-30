import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  nextAircraftPollDelayMs,
  AIRCRAFT_BASE_POLL_MS,
  AIRCRAFT_MAX_BACKOFF_MS,
} from './exponential-backoff'

describe('nextAircraftPollDelayMs', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the base interval when there are no failures', () => {
    expect(nextAircraftPollDelayMs(0)).toBe(AIRCRAFT_BASE_POLL_MS)
  })

  it('doubles the delay per consecutive failure up to the max', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    expect(nextAircraftPollDelayMs(1)).toBe(AIRCRAFT_BASE_POLL_MS * 2)
    expect(nextAircraftPollDelayMs(2)).toBe(AIRCRAFT_BASE_POLL_MS * 4)
    expect(nextAircraftPollDelayMs(3)).toBe(AIRCRAFT_BASE_POLL_MS * 8)
    expect(nextAircraftPollDelayMs(10)).toBe(AIRCRAFT_MAX_BACKOFF_MS)
  })

  it('honors a Retry-After hint when it exceeds the exponential delay', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    expect(nextAircraftPollDelayMs(1, 120)).toBe(120_000)
  })
})
