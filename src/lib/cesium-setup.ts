import {
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

export function attachImageryFallback(viewer: CesiumViewer): () => void {
  const baseLayer = viewer.imageryLayers.get(0)
  if (!baseLayer) {
    return () => undefined
  }

  let switched = false

  const onError = (error: unknown) => {
    if (switched) {
      return
    }

    switched = true
    const message = error instanceof Error ? error.message : String(error)
    log.warn('Ion imagery failed; switching to OpenStreetMap fallback', {
      message,
    })

    viewer.imageryLayers.removeAll()
    viewer.imageryLayers.add(createFallbackBaseLayer())
    viewer.scene.requestRender()
  }

  baseLayer.imageryProvider.errorEvent.addEventListener(onError)

  return () => {
    baseLayer.imageryProvider.errorEvent.removeEventListener(onError)
  }
}
