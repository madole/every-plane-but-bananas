import { useEffect, useRef, useState } from 'react'
import { Axis, Matrix4, Model } from 'cesium'
import type { Viewer as CesiumViewer } from 'cesium'
import { createLogger } from '../lib/logger'
import {
  buildInstancedBananaGltf,
  decodeDataUri,
  isGltfDocument,
} from '../lib/banana-instances'
import type { GltfDocument } from '../lib/banana-instances'
import type { SerializedCartesian3 } from '../types/opensky'

const log = createLogger('bananas:layer')

const BANANA_MODEL_URL = '/banana.gltf'
/** Native banana length along its +X axis (from the glTF POSITION accessor). */
const BANANA_NATIVE_LENGTH_M = 0.2292
/** Rendered banana length in metres — large enough to spot against the globe. */
const BANANA_RENDER_LENGTH_M = 150_000
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
  const modelRef = useRef<Model | null>(null)
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

    if (positions.length === 0) {
      if (modelRef.current) {
        viewer.scene.primitives.remove(modelRef.current)
        modelRef.current = null
        viewer.scene.requestRender()
      }
      return
    }

    let cancelled = false
    const startedAt = performance.now()
    const gltf = buildInstancedBananaGltf(baseGltf, positions, BANANA_SCALE)
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(gltf)], { type: 'model/gltf+json' }),
    )

    Model.fromGltfAsync({
      url,
      modelMatrix: Matrix4.IDENTITY,
      upAxis: Axis.Z,
      forwardAxis: Axis.X,
      scene: viewer.scene,
      asynchronous: false,
      incrementallyLoadTextures: false,
    })
      .then((model) => {
        if (cancelled || viewer.isDestroyed()) {
          URL.revokeObjectURL(url)
          return
        }

        viewer.scene.primitives.add(model)

        const swapInModel = () => {
          if (modelRef.current && modelRef.current !== model) {
            viewer.scene.primitives.remove(modelRef.current)
          }
          modelRef.current = model
          viewer.scene.requestRender()
          URL.revokeObjectURL(url)
          log.info('Instanced banana model ready', {
            count: positions.length,
            durationMs: Math.round(performance.now() - startedAt),
          })
        }

        if (model.ready) {
          swapInModel()
          return
        }
        const removeListener = model.readyEvent.addEventListener(() => {
          removeListener()
          if (cancelled || viewer.isDestroyed()) {
            viewer.scene.primitives.remove(model)
            URL.revokeObjectURL(url)
            return
          }
          swapInModel()
        })
      })
      .catch((error: unknown) => {
        URL.revokeObjectURL(url)
        if (!cancelled) {
          log.error('Failed to build instanced banana model', {
            message: error instanceof Error ? error.message : String(error),
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [viewer, baseGltf, positions])

  useEffect(() => {
    return () => {
      if (viewer && !viewer.isDestroyed() && modelRef.current) {
        viewer.scene.primitives.remove(modelRef.current)
      }
      modelRef.current = null
    }
  }, [viewer])

  return null
}
