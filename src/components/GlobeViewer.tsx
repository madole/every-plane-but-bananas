import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Viewer } from 'resium'
import type { CesiumComponentRef } from 'resium'
import { Viewer as CesiumViewer } from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { AircraftStatusOverlay } from './AircraftStatusOverlay'
import { BananaAircraftLayer } from './BananaAircraftLayer'
import { loadCachedAircraft, saveCachedAircraft } from '../lib/aircraft-cache'
import {
  configureCesiumIon,
  attachImageryFallback,
  createFallbackBaseLayer,
  createTerrainProvider,
} from '../lib/cesium-setup'
import {
  nextOpenSkyPollDelayMs,
  OPENSKY_BASE_POLL_MS,
} from '../lib/exponential-backoff'
import { createLogger } from '../lib/logger'
import { fetchOpenSkyStates } from '../server/opensky'
import type { SerializedCartesian3 } from '../types/opensky'

const log = createLogger('globe:client')

const hasIonToken = configureCesiumIon()
const REFRESH_TIME = OPENSKY_BASE_POLL_MS

function createViewerTerrainProvider() {
  return createTerrainProvider()
}

function createViewerFallbackBaseLayer() {
  return hasIonToken ? undefined : createFallbackBaseLayer()
}

function readInitialCache() {
  const cached = loadCachedAircraft()
  if (!cached) {
    return {
      positions: [] as SerializedCartesian3[],
      lastUpdatedAt: null as Date | null,
      isUsingCache: false,
    }
  }

  return {
    positions: cached.positions,
    lastUpdatedAt: new Date(cached.lastUpdatedAt),
    isUsingCache: true,
  }
}

function useAirTrafficData(visible: boolean) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const consecutiveFailuresRef = useRef(0)
  const pollingActiveRef = useRef(false)
  const initialCache = useRef(readInitialCache())
  const [positions, setPositions] = useState<SerializedCartesian3[]>(
    () => initialCache.current.positions,
  )
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(
    () => initialCache.current.lastUpdatedAt,
  )
  const [isUsingCache, setIsUsingCache] = useState(
    () => initialCache.current.isUsingCache,
  )

  const scheduleNextPoll = (delayMs: number) => {
    if (!pollingActiveRef.current) {
      return
    }

    timeoutRef.current = setTimeout(() => {
      void pollRef.current()
    }, delayMs)
  }

  const pollRef = useRef<() => Promise<void>>(async () => {})

  pollRef.current = async () => {
    if (!pollingActiveRef.current) {
      return
    }

    const startedAt = performance.now()
    log.info('Requesting aircraft data via server function')

    try {
      const response = await fetchOpenSkyStates()

      if (response.error) {
        consecutiveFailuresRef.current += 1
        const nextPollMs = nextOpenSkyPollDelayMs(
          consecutiveFailuresRef.current,
          response.retryAfterSeconds,
        )

        log.warn('Aircraft data unavailable; keeping globe and last positions', {
          error: response.error,
          statusCode: response.statusCode,
          consecutiveFailures: consecutiveFailuresRef.current,
          nextPollMs,
          durationMs: Math.round(performance.now() - startedAt),
        })

        scheduleNextPoll(nextPollMs)
        return
      }

      consecutiveFailuresRef.current = 0
      const updatedAt = new Date()
      setPositions(response.positions)
      setLastUpdatedAt(updatedAt)
      setIsUsingCache(false)

      saveCachedAircraft({
        lastUpdatedAt: updatedAt.toISOString(),
        apiTime: response.apiTime,
        positions: response.positions,
      })

      log.info('Received aircraft positions', {
        positionCount: response.positions.length,
        durationMs: Math.round(performance.now() - startedAt),
        apiTime: response.apiTime,
        lastUpdatedAt: updatedAt.toISOString(),
        nextPollMs: REFRESH_TIME,
      })

      scheduleNextPoll(REFRESH_TIME)
    } catch (error: unknown) {
      consecutiveFailuresRef.current += 1
      const nextPollMs = nextOpenSkyPollDelayMs(consecutiveFailuresRef.current)
      const message = error instanceof Error ? error.message : String(error)

      log.warn('Aircraft fetch rejected unexpectedly; globe unchanged', {
        message,
        consecutiveFailures: consecutiveFailuresRef.current,
        nextPollMs,
        durationMs: Math.round(performance.now() - startedAt),
      })

      scheduleNextPoll(nextPollMs)
    }
  }

  useEffect(() => {
    if (initialCache.current.isUsingCache) {
      log.info('Restored aircraft positions from localStorage', {
        positionCount: initialCache.current.positions.length,
        lastUpdatedAt: initialCache.current.lastUpdatedAt?.toISOString(),
      })
    }
  }, [])

  useEffect(() => {
    if (visible) {
      pollingActiveRef.current = true
      log.info('Starting aircraft polling with exponential backoff', {
        baseIntervalMs: REFRESH_TIME,
      })
      void pollRef.current()
    } else {
      pollingActiveRef.current = false
      if (timeoutRef.current !== undefined) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = undefined
        log.info('Stopped aircraft polling (hidden)')
      }
    }

    return () => {
      pollingActiveRef.current = false
      if (timeoutRef.current !== undefined) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = undefined
        log.info('Stopped aircraft polling (unmount)')
      }
    }
  }, [visible])

  return { positions, lastUpdatedAt, isUsingCache }
}

function configureViewer(
  ref: RefObject<CesiumComponentRef<CesiumViewer> | null>,
  container: HTMLDivElement | null,
) {
  const viewer = ref.current?.cesiumElement
  if (!viewer) {
    return
  }

  viewer.scene.globe.enableLighting = true
  viewer.scene.globe.depthTestAgainstTerrain = true
  viewer.forceResize()

  viewer.scene.renderError.addEventListener((_scene, error) => {
    log.error('Cesium render error', {
      message: error instanceof Error ? error.message : String(error),
    })
  })

  log.info('Cesium viewer configured', {
    hasIonToken,
    enableLighting: viewer.scene.globe.enableLighting,
  })

  const cleanupImageryFallback = hasIonToken
    ? attachImageryFallback(viewer)
    : () => undefined

  if (!container || typeof ResizeObserver === 'undefined') {
    return cleanupImageryFallback
  }

  const resizeObserver = new ResizeObserver(() => {
    viewer.forceResize()
    viewer.scene.requestRender()
  })
  resizeObserver.observe(container)

  return () => {
    resizeObserver.disconnect()
    cleanupImageryFallback()
  }
}

export function GlobeViewer() {
  const ref = useRef<CesiumComponentRef<CesiumViewer>>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { positions, lastUpdatedAt, isUsingCache } = useAirTrafficData(true)
  const [viewer, setViewer] = useState<CesiumViewer | undefined>(undefined)
  const terrainProvider = useMemo(() => createViewerTerrainProvider(), [])
  const fallbackBaseLayer = useMemo(() => createViewerFallbackBaseLayer(), [])
  const globeWarning = useMemo(
    () =>
      hasIonToken
        ? undefined
        : 'Add VITE_CESIUM_ION_TOKEN for Cesium World Terrain and satellite imagery.',
    [],
  )

  useEffect(() => {
    let frame = 0
    let cleanupResize: (() => void) | undefined

    const waitForViewer = () => {
      const cesiumViewer = ref.current?.cesiumElement
      if (cesiumViewer) {
        cleanupResize = configureViewer(ref, containerRef.current)
        setViewer(cesiumViewer)
        return
      }
      frame = requestAnimationFrame(waitForViewer)
    }
    waitForViewer()
    return () => {
      cancelAnimationFrame(frame)
      cleanupResize?.()
    }
  }, [])

  return (
    <div ref={containerRef} className="globe-viewer">
      <Viewer
        ref={ref}
        full
        animation={false}
        timeline={false}
        baseLayerPicker={false}
        geocoder={false}
        homeButton={false}
        navigationHelpButton={false}
        sceneModePicker={false}
        terrainProvider={terrainProvider}
        baseLayer={fallbackBaseLayer}
      >
        <BananaAircraftLayer viewer={viewer} positions={positions} />
      </Viewer>
      <AircraftStatusOverlay
        aircraftCount={positions.length}
        lastUpdatedAt={lastUpdatedAt}
        isUsingCache={isUsingCache}
        globeWarning={globeWarning}
      />
    </div>
  )
}
