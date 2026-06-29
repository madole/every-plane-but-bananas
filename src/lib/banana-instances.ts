import type { SerializedCartesian3 } from '../types/opensky'

/**
 * Builds a GPU-instanced banana glTF from aircraft positions using the
 * `EXT_mesh_gpu_instancing` extension, so thousands of banana models render in a
 * single draw call. The instanced model is rebuilt whenever positions change.
 *
 * Instance transforms are expressed directly in ECEF (world) space, so the model
 * must be loaded with `upAxis: Axis.Z`, `forwardAxis: Axis.X` and an identity
 * `modelMatrix` to disable Cesium's default glTF Y-up→Z-up correction.
 */

const FLOAT = 5126

type Vec3 = [number, number, number]
type Quat = [number, number, number, number]

export type GltfBuffer = { uri?: string; byteLength: number }
export type GltfBufferView = {
  buffer: number
  byteOffset?: number
  byteLength: number
  byteStride?: number
  target?: number
}
export type GltfAccessor = {
  bufferView?: number
  byteOffset?: number
  componentType: number
  count: number
  type: string
  min?: number[]
  max?: number[]
  normalized?: boolean
}
export type GltfNode = {
  mesh?: number
  extensions?: Record<string, unknown>
  [key: string]: unknown
}
export type GltfDocument = {
  buffers: GltfBuffer[]
  bufferViews: GltfBufferView[]
  accessors: GltfAccessor[]
  nodes: GltfNode[]
  extensionsUsed?: string[]
  [key: string]: unknown
}

export function isGltfDocument(value: unknown): value is GltfDocument {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    Array.isArray(record.buffers) &&
    Array.isArray(record.bufferViews) &&
    Array.isArray(record.accessors) &&
    Array.isArray(record.nodes)
  )
}

function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2])
  if (length === 0) {
    return [0, 0, 0]
  }
  return [v[0] / length, v[1] / length, v[2] / length]
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

/**
 * Quaternion orienting a Y-up, X-long banana so its up (+Y) aligns with the
 * local surface normal and its length (+X) lies along local north.
 */
export function enuRotationQuaternion(x: number, y: number, z: number): Quat {
  const up = normalize([x, y, z])
  if (up[0] === 0 && up[1] === 0 && up[2] === 0) {
    return [0, 0, 0, 1]
  }

  let east = cross([0, 0, 1], up)
  if (Math.hypot(east[0], east[1], east[2]) < 1e-6) {
    // At the poles the up vector is parallel to the Z axis; pick any tangent.
    east = [1, 0, 0]
  }
  east = normalize(east)
  const north = normalize(cross(up, east))

  // Columns map the mesh axes (X→north, Y→up, Z→east) into ECEF.
  const m00 = north[0]
  const m10 = north[1]
  const m20 = north[2]
  const m01 = up[0]
  const m11 = up[1]
  const m21 = up[2]
  const m02 = east[0]
  const m12 = east[1]
  const m22 = east[2]

  const trace = m00 + m11 + m22
  let qx: number
  let qy: number
  let qz: number
  let qw: number

  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2
    qw = 0.25 * s
    qx = (m21 - m12) / s
    qy = (m02 - m20) / s
    qz = (m10 - m01) / s
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2
    qw = (m21 - m12) / s
    qx = 0.25 * s
    qy = (m01 + m10) / s
    qz = (m02 + m20) / s
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2
    qw = (m02 - m20) / s
    qx = (m01 + m10) / s
    qy = 0.25 * s
    qz = (m12 + m21) / s
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2
    qw = (m10 - m01) / s
    qx = (m02 + m20) / s
    qy = (m12 + m21) / s
    qz = 0.25 * s
  }

  return [qx, qy, qz, qw]
}

export function decodeBase64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/** Extract the bytes from a `data:...;base64,<payload>` URI. */
export function decodeDataUri(uri: string): Uint8Array<ArrayBuffer> | null {
  const marker = ';base64,'
  const index = uri.indexOf(marker)
  if (!uri.startsWith('data:') || index === -1) {
    return null
  }
  return decodeBase64ToBytes(uri.slice(index + marker.length))
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

export type InstanceBuffer = {
  base64: string
  byteLength: number
  count: number
  translation: { byteOffset: number; byteLength: number; min: Vec3; max: Vec3 }
  rotation: { byteOffset: number; byteLength: number }
  scale: { byteOffset: number; byteLength: number }
}

/**
 * Pack per-instance TRANSLATION (VEC3), ROTATION (VEC4 quaternion) and SCALE
 * (VEC3) into a single tightly-packed little-endian float buffer.
 */
export function packBananaInstances(
  positions: SerializedCartesian3[],
  scale: number,
): InstanceBuffer {
  const count = positions.length
  const translationBytes = count * 3 * 4
  const rotationBytes = count * 4 * 4
  const scaleBytes = count * 3 * 4

  const translationOffset = 0
  const rotationOffset = translationBytes
  const scaleOffset = translationBytes + rotationBytes
  const byteLength = translationBytes + rotationBytes + scaleBytes

  const buffer = new ArrayBuffer(byteLength)
  const translations = new Float32Array(buffer, translationOffset, count * 3)
  const rotations = new Float32Array(buffer, rotationOffset, count * 4)
  const scales = new Float32Array(buffer, scaleOffset, count * 3)

  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]

  for (let i = 0; i < count; i += 1) {
    const { x, y, z } = positions[i]
    translations[i * 3 + 0] = x
    translations[i * 3 + 1] = y
    translations[i * 3 + 2] = z

    min[0] = Math.min(min[0], x)
    min[1] = Math.min(min[1], y)
    min[2] = Math.min(min[2], z)
    max[0] = Math.max(max[0], x)
    max[1] = Math.max(max[1], y)
    max[2] = Math.max(max[2], z)

    const [qx, qy, qz, qw] = enuRotationQuaternion(x, y, z)
    rotations[i * 4 + 0] = qx
    rotations[i * 4 + 1] = qy
    rotations[i * 4 + 2] = qz
    rotations[i * 4 + 3] = qw

    scales[i * 3 + 0] = scale
    scales[i * 3 + 1] = scale
    scales[i * 3 + 2] = scale
  }

  return {
    base64: uint8ToBase64(new Uint8Array(buffer)),
    byteLength,
    count,
    translation: {
      byteOffset: translationOffset,
      byteLength: translationBytes,
      min: count > 0 ? min : [0, 0, 0],
      max: count > 0 ? max : [0, 0, 0],
    },
    rotation: { byteOffset: rotationOffset, byteLength: rotationBytes },
    scale: { byteOffset: scaleOffset, byteLength: scaleBytes },
  }
}

function findMeshNodeIndex(nodes: GltfNode[]): number {
  const index = nodes.findIndex((node) => typeof node.mesh === 'number')
  return index === -1 ? 0 : index
}

/**
 * Returns a shallow clone of `base` with `EXT_mesh_gpu_instancing` added to the
 * mesh node, plus the buffer/bufferViews/accessors describing the instances.
 */
export function buildInstancedBananaGltf(
  base: GltfDocument,
  positions: SerializedCartesian3[],
  scale: number,
): GltfDocument {
  const instances = packBananaInstances(positions, scale)

  const bufferIndex = base.buffers.length
  const bufferViewBase = base.bufferViews.length
  const accessorBase = base.accessors.length

  const instanceBuffer: GltfBuffer = {
    uri: `data:application/octet-stream;base64,${instances.base64}`,
    byteLength: instances.byteLength,
  }

  const bufferViews: GltfBufferView[] = [
    {
      buffer: bufferIndex,
      byteOffset: instances.translation.byteOffset,
      byteLength: instances.translation.byteLength,
    },
    {
      buffer: bufferIndex,
      byteOffset: instances.rotation.byteOffset,
      byteLength: instances.rotation.byteLength,
    },
    {
      buffer: bufferIndex,
      byteOffset: instances.scale.byteOffset,
      byteLength: instances.scale.byteLength,
    },
  ]

  const accessors: GltfAccessor[] = [
    {
      bufferView: bufferViewBase + 0,
      componentType: FLOAT,
      count: instances.count,
      type: 'VEC3',
      min: instances.translation.min,
      max: instances.translation.max,
    },
    {
      bufferView: bufferViewBase + 1,
      componentType: FLOAT,
      count: instances.count,
      type: 'VEC4',
    },
    {
      bufferView: bufferViewBase + 2,
      componentType: FLOAT,
      count: instances.count,
      type: 'VEC3',
    },
  ]

  const meshNodeIndex = findMeshNodeIndex(base.nodes)
  const nodes = base.nodes.map((node, index) => {
    if (index !== meshNodeIndex) {
      return node
    }
    return {
      ...node,
      extensions: {
        ...node.extensions,
        EXT_mesh_gpu_instancing: {
          attributes: {
            TRANSLATION: accessorBase + 0,
            ROTATION: accessorBase + 1,
            SCALE: accessorBase + 2,
          },
        },
      },
    }
  })

  const extensionsUsed = base.extensionsUsed ? [...base.extensionsUsed] : []
  if (!extensionsUsed.includes('EXT_mesh_gpu_instancing')) {
    extensionsUsed.push('EXT_mesh_gpu_instancing')
  }

  return {
    ...base,
    buffers: [...base.buffers, instanceBuffer],
    bufferViews: [...base.bufferViews, ...bufferViews],
    accessors: [...base.accessors, ...accessors],
    nodes,
    extensionsUsed,
  }
}
