import { useEffect, useRef, useState } from 'react'
import { Axis, Cartesian3, Matrix4, Model } from 'cesium'
import type { Viewer as CesiumViewer } from 'cesium'
import { createLogger } from '../lib/logger'
import {
  bucketPositions,
  buildInstancedBananaGltf,
  computeBoundingCenter,
  decodeDataUri,
  isGltfDocument,
} from '../lib/banana-instances'
import type { GltfDocument } from '../lib/banana-instances'
import type { SerializedCartesian3 } from '../types/opensky'

const log = createLogger('bananas:layer')

const BANANA_MODEL_URL = '/banana.gltf'
/** Native banana length along its +X axis (from the glTF POSITION accessor). */
const BANANA_NATIVE_LENGTH_M = 0.2302
/** Rendered banana length in metres — large enough to spot against the globe. */
const BANANA_RENDER_LENGTH_M = 60_000
const BANANA_SCALE = BANANA_RENDER_LENGTH_M / BANANA_NATIVE_LENGTH_M

type BananaAircraftLayerProps = {
  viewer: CesiumViewer | undefined
  positions: SerializedCartesian3[]
}

/**
 * Renders each aircraft as the banana glTF model, drawn with GPU instancing via
 * the `EXT_mesh_gpu_instancing` extension so thousands of bananas cost a single
 * draw call. The instanced model is rebuilt whenever the positions change.
 */
export function BananaAircraftLayer({
  viewer,
  positions,
}: BananaAircraftLayerProps) {
  const [baseGltf, setBaseGltf] = useState<GltfDocument | null>(null)
  const modelsRef = useRef<Model[]>([])
  const bufferUrlRef = useRef<string | null>(null)

  // Load the banana mesh + texture once. The (heavy) embedded buffer is moved to
  // a persistent Blob URL so each instanced rebuild only serializes the small
  // per-instance buffer instead of the multi-MB texture.
  useEffect(() => {
    let cancelled = false
    fetch(BANANA_MODEL_URL)
      .then((response) => response.json())
      .then((json: unknown) => {
        if (cancelled) {
          return
        }
        if (!isGltfDocument(json) || json.buffers.length === 0) {
          log.error('banana.gltf is not a valid glTF document')
          return
        }

        const [firstBuffer, ...restBuffers] = json.buffers
        const embedded = firstBuffer.uri ? decodeDataUri(firstBuffer.uri) : null
        if (!embedded) {
          log.error('banana.gltf buffer is not an embedded data URI')
          return
        }

        const bufferUrl = URL.createObjectURL(
          new Blob([embedded], { type: 'application/octet-stream' }),
        )
        bufferUrlRef.current = bufferUrl

        setBaseGltf({
          ...json,
          buffers: [
            { uri: bufferUrl, byteLength: firstBuffer.byteLength },
            ...restBuffers,
          ],
        })
        log.info('Loaded base banana glTF')
      })
      .catch((error: unknown) => {
        log.error('Failed to load banana.gltf', {
          message: error instanceof Error ? error.message : String(error),
        })
      })
    return () => {
      cancelled = true
      if (bufferUrlRef.current) {
        URL.revokeObjectURL(bufferUrlRef.current)
        bufferUrlRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!viewer || !baseGltf) {
      return
    }
    const scene = viewer.scene

    if (positions.length === 0) {
      for (const model of modelsRef.current) {
        scene.primitives.remove(model)
      }
      modelsRef.current = []
      scene.requestRender()
      return
    }

    const run = { cancelled: false }
    const isStale = () => run.cancelled || viewer.isDestroyed()
    const startedAt = performance.now()

    // One instanced model per regional cell so each bounding volume stays local
    // and Cesium's culling keeps the bananas visible at every zoom level.
    const buckets = bucketPositions(positions)
    const urls: string[] = []
    const loads = buckets.map((bucket) => {
      const origin = computeBoundingCenter(bucket)
      const gltf = buildInstancedBananaGltf(baseGltf, bucket, BANANA_SCALE, origin)
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(gltf)], { type: 'model/gltf+json' }),
      )
      urls.push(url)
      return Model.fromGltfAsync({
        url,
        // Position the bucket at its centroid so the bounding volume is local
        // (instance translations are stored relative to this origin).
        modelMatrix: Matrix4.fromTranslation(
          new Cartesian3(origin[0], origin[1], origin[2]),
        ),
        upAxis: Axis.Z,
        forwardAxis: Axis.X,
        scene,
        // Load across frames so the 30s rebuild never blocks the main thread;
        // textures load before `readyEvent` so swap-in is never untextured.
        asynchronous: true,
        incrementallyLoadTextures: false,
        // Belt-and-suspenders against Cesium dropping a bucket whose bounding
        // volume does not fully reflect the instance spread.
        cull: false,
      })
    })

    const whenReady = (model: Model): Promise<void> => {
      if (model.ready) {
        return Promise.resolve()
      }
      return new Promise((resolve) => {
        const removeListener = model.readyEvent.addEventListener(() => {
          removeListener()
          resolve()
        })
      })
    }

    const revokeUrls = () => urls.forEach((url) => URL.revokeObjectURL(url))

    Promise.allSettled(loads)
      .then(async (results) => {
        const models = results
          .filter(
            (result): result is PromiseFulfilledResult<Model> =>
              result.status === 'fulfilled',
          )
          .map((result) => result.value)

        const failures = results.length - models.length
        if (failures > 0) {
          log.warn('Some banana buckets failed to load', { failures })
        }

        if (isStale()) {
          for (const model of models) {
            model.destroy()
          }
          revokeUrls()
          return
        }

        for (const model of models) {
          scene.primitives.add(model)
        }
        await Promise.all(models.map(whenReady))

        if (isStale()) {
          for (const model of models) {
            scene.primitives.remove(model)
          }
          revokeUrls()
          return
        }

        const previous = modelsRef.current
        modelsRef.current = models
        for (const model of previous) {
          scene.primitives.remove(model)
        }
        revokeUrls()
        scene.requestRender()
        log.info('Instanced banana models ready', {
          buckets: models.length,
          count: positions.length,
          durationMs: Math.round(performance.now() - startedAt),
        })
      })
      .catch((error: unknown) => {
        revokeUrls()
        if (!run.cancelled) {
          log.error('Failed to build instanced banana models', {
            message: error instanceof Error ? error.message : String(error),
          })
        }
      })

    return () => {
      run.cancelled = true
    }
  }, [viewer, baseGltf, positions])

  useEffect(() => {
    return () => {
      if (viewer && !viewer.isDestroyed()) {
        for (const model of modelsRef.current) {
          viewer.scene.primitives.remove(model)
        }
      }
      modelsRef.current = []
    }
  }, [viewer])

  return null
}
