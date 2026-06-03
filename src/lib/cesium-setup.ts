import {
  createWorldImageryAsync,
  EllipsoidTerrainProvider,
  ImageryLayer,
  Ion,
  OpenStreetMapImageryProvider,
  createWorldTerrainAsync,
  type TerrainProvider,
  type Viewer as CesiumViewer,
} from 'cesium'
import { createLogger } from './logger'

const log = createLogger('cesium:setup')

export function configureCesiumIon(): boolean {
  const token = import.meta.env.VITE_CESIUM_ION_TOKEN
  if (!token) {
    log.warn(
      'VITE_CESIUM_ION_TOKEN is missing; using OpenStreetMap imagery and flat terrain',
    )
    return false
  }

  Ion.defaultAccessToken = token
  return true
}

export async function createTerrainProvider(): Promise<TerrainProvider> {
  if (!Ion.defaultAccessToken) {
    return new EllipsoidTerrainProvider()
  }

  try {
    const terrain = await createWorldTerrainAsync({
      requestVertexNormals: true,
    })
    log.info('World terrain ready')
    return terrain
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    log.warn('World terrain unavailable; using ellipsoid fallback', { message })
    return new EllipsoidTerrainProvider()
  }
}

export function createFallbackBaseLayer(): ImageryLayer {
  return new ImageryLayer(
    new OpenStreetMapImageryProvider({
      url: 'https://tile.openstreetmap.org/',
    }),
  )
}

async function createIonImageryLayer(): Promise<ImageryLayer> {
  const provider = await createWorldImageryAsync()
  return new ImageryLayer(provider)
}

function setGlobeImagery(viewer: CesiumViewer, layer: ImageryLayer) {
  viewer.imageryLayers.removeAll()
  viewer.imageryLayers.add(layer)
  viewer.scene.requestRender()
}

/**
 * Start with OSM (set on Viewer), upgrade to Ion world imagery when configured.
 * Avoids default Viewer imagery whose provider may lack errorEvent in Cesium 1.142.
 */
export async function applyGlobeImagery(viewer: CesiumViewer): Promise<void> {
  if (!Ion.defaultAccessToken) {
    return
  }

  try {
    const ionLayer = await createIonImageryLayer()
    setGlobeImagery(viewer, ionLayer)
    log.info('Applied Ion world imagery')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    log.warn('Ion imagery unavailable; keeping OpenStreetMap fallback', {
      message,
    })
  }
}
