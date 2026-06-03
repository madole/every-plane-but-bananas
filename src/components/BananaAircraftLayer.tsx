import { useEffect, useRef } from 'react'
import {
  BillboardCollection,
  Cartesian3,
  type Viewer as CesiumViewer,
} from 'cesium'
import { createLogger } from '../lib/logger'
import type { SerializedCartesian3 } from '../types/opensky'

const log = createLogger('bananas:layer')

const BANANA_IMAGE = '/banana-billboard.svg'
const BANANA_PIXEL_SIZE = 24

type BananaAircraftLayerProps = {
  viewer: CesiumViewer | undefined
  positions: SerializedCartesian3[]
}

/**
 * Renders aircraft as billboards (one shared texture, one primitive collection).
 * Much faster than ~8000 Entity + ModelGraphics instances. Cesium 1.142 does not
 * expose a public dynamic GLTF instancing API yet (ModelInstanceCollection was removed).
 */
export function BananaAircraftLayer({
  viewer,
  positions,
}: BananaAircraftLayerProps) {
  const collectionRef = useRef<BillboardCollection | null>(null)

  useEffect(() => {
    if (!viewer) {
      return
    }

    const collection = new BillboardCollection()
    viewer.scene.primitives.add(collection)
    collectionRef.current = collection
    log.info('BillboardCollection attached')

    return () => {
      viewer.scene.primitives.remove(collection)
      collection.destroy()
      collectionRef.current = null
      log.info('BillboardCollection removed')
    }
  }, [viewer])

  useEffect(() => {
    const collection = collectionRef.current
    if (!collection || !viewer) {
      return
    }

    const startedAt = performance.now()
    collection.removeAll()

    for (const position of positions) {
      collection.add({
        position: new Cartesian3(position.x, position.y, position.z),
        image: BANANA_IMAGE,
        width: BANANA_PIXEL_SIZE,
        height: BANANA_PIXEL_SIZE,
      })
    }

    log.info('Billboards updated', {
      count: positions.length,
      durationMs: Math.round(performance.now() - startedAt),
      image: BANANA_IMAGE,
      pixelSize: BANANA_PIXEL_SIZE,
    })

    viewer.scene.requestRender()
  }, [positions, viewer])

  return null
}
