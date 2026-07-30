import { describe, expect, it } from 'vitest'
import {
  bucketPositions,
  buildInstancedBananaGltf,
  computeBoundingCenter,
  decodeDataUri,
  enuRotationQuaternion,
  packBananaInstances,
} from './banana-instances'
import type { GltfDocument } from './banana-instances'
import { cartesianFromDegrees } from './geodetic'

type Vec3 = [number, number, number]
type Quat = [number, number, number, number]

function rotateVectorByQuaternion(q: Quat, v: Vec3): Vec3 {
  const [x, y, z, w] = q
  // t = 2 * cross(q.xyz, v)
  const tx = 2 * (y * v[2] - z * v[1])
  const ty = 2 * (z * v[0] - x * v[2])
  const tz = 2 * (x * v[1] - y * v[0])
  // v' = v + w * t + cross(q.xyz, t)
  return [
    v[0] + w * tx + (y * tz - z * ty),
    v[1] + w * ty + (z * tx - x * tz),
    v[2] + w * tz + (x * ty - y * tx),
  ]
}

function decodeFloats(base64: string): Float32Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Float32Array(bytes.buffer)
}

describe('enuRotationQuaternion', () => {
  it('orients the banana up axis (+Y) along the local surface normal', () => {
    const p = cartesianFromDegrees(8, 47, 0)
    const q = enuRotationQuaternion(p.x, p.y, p.z)
    const rotatedUp = rotateVectorByQuaternion(q, [0, 1, 0])

    const length = Math.hypot(p.x, p.y, p.z)
    const expected = [p.x / length, p.y / length, p.z / length]

    expect(rotatedUp[0]).toBeCloseTo(expected[0], 5)
    expect(rotatedUp[1]).toBeCloseTo(expected[1], 5)
    expect(rotatedUp[2]).toBeCloseTo(expected[2], 5)
  })

  it('returns a unit quaternion', () => {
    const p = cartesianFromDegrees(-74, 40, 1000)
    const [x, y, z, w] = enuRotationQuaternion(p.x, p.y, p.z)
    expect(Math.hypot(x, y, z, w)).toBeCloseTo(1, 6)
  })
})

describe('packBananaInstances', () => {
  it('packs translation, rotation and scale tightly for each instance', () => {
    const positions = [
      { x: 1, y: 2, z: 3 },
      { x: 4, y: 5, z: 6 },
    ]
    const packed = packBananaInstances(positions, 7)

    expect(packed.count).toBe(2)
    expect(packed.byteLength).toBe(2 * (3 + 4 + 3) * 4)
    expect(packed.translation.byteOffset).toBe(0)
    expect(packed.rotation.byteOffset).toBe(2 * 3 * 4)
    expect(packed.scale.byteOffset).toBe(2 * 3 * 4 + 2 * 4 * 4)
    expect(packed.translation.min).toEqual([1, 2, 3])
    expect(packed.translation.max).toEqual([4, 5, 6])

    const floats = decodeFloats(packed.base64)
    // translations come first: [1,2,3, 4,5,6]
    expect(Array.from(floats.slice(0, 6))).toEqual([1, 2, 3, 4, 5, 6])
    // scales are last: 6 floats all equal to 7
    expect(Array.from(floats.slice(-6))).toEqual([7, 7, 7, 7, 7, 7])
  })

  it('stores translations relative to a supplied origin', () => {
    const packed = packBananaInstances([{ x: 100, y: 200, z: 300 }], 1, [
      100, 200, 300,
    ])
    const floats = decodeFloats(packed.base64)
    expect(Array.from(floats.slice(0, 3))).toEqual([0, 0, 0])
    expect(packed.translation.min).toEqual([0, 0, 0])
  })
})

describe('computeBoundingCenter', () => {
  it('returns the bounding-box centre', () => {
    expect(
      computeBoundingCenter([
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 20, z: 30 },
      ]),
    ).toEqual([5, 10, 15])
  })

  it('returns the origin for an empty list', () => {
    expect(computeBoundingCenter([])).toEqual([0, 0, 0])
  })
})

describe('bucketPositions', () => {
  it('groups far-apart positions into separate regional cells', () => {
    const europe = cartesianFromDegrees(8, 47, 10000)
    const australia = cartesianFromDegrees(151, -33, 10000)
    const buckets = bucketPositions([europe, australia])

    expect(buckets).toHaveLength(2)
    expect(buckets.flat()).toHaveLength(2)
  })

  it('keeps nearby positions in the same cell', () => {
    const a = cartesianFromDegrees(8, 47, 10000)
    const b = cartesianFromDegrees(9, 48, 11000)
    const buckets = bucketPositions([a, b])

    expect(buckets).toHaveLength(1)
    expect(buckets[0]).toHaveLength(2)
  })

  it('preserves the total number of positions', () => {
    const positions = [
      cartesianFromDegrees(8, 47, 0),
      cartesianFromDegrees(-74, 40, 0),
      cartesianFromDegrees(139, 35, 0),
      cartesianFromDegrees(-46, -23, 0),
    ]
    expect(bucketPositions(positions).flat()).toHaveLength(4)
  })
})

describe('decodeDataUri', () => {
  it('decodes a base64 data URI to its bytes', () => {
    // "ABC" base64-encoded is "QUJD".
    const uri = 'data:application/octet-stream;base64,QUJD'
    expect(Array.from(decodeDataUri(uri) ?? [])).toEqual([65, 66, 67])
  })

  it('returns null for non-data or non-base64 URIs', () => {
    expect(decodeDataUri('https://example.com/banana.bin')).toBeNull()
    expect(decodeDataUri('blob:https://app/abc')).toBeNull()
  })
})

describe('buildInstancedBananaGltf', () => {
  const base: GltfDocument = {
    asset: { version: '2.0' },
    buffers: [{ uri: 'data:application/octet-stream;base64,AAAA', byteLength: 3 }],
    bufferViews: [{ buffer: 0, byteLength: 3 }],
    accessors: [{ componentType: 5126, count: 1, type: 'VEC3' }],
    nodes: [{ name: 'banana', mesh: 0 }],
    meshes: [{ primitives: [] }],
  }

  it('adds the instancing extension to the mesh node and registers it', () => {
    const gltf = buildInstancedBananaGltf(base, [{ x: 1, y: 2, z: 3 }], 5)

    expect(gltf.extensionsUsed).toContain('EXT_mesh_gpu_instancing')
    expect(gltf.buffers).toHaveLength(2)
    expect(gltf.bufferViews).toHaveLength(4)
    expect(gltf.accessors).toHaveLength(4)

    const ext = gltf.nodes[0].extensions?.EXT_mesh_gpu_instancing
    expect(ext).toEqual({
      attributes: { TRANSLATION: 1, ROTATION: 2, SCALE: 3 },
    })
  })

  it('does not mutate the base document', () => {
    buildInstancedBananaGltf(base, [{ x: 1, y: 2, z: 3 }], 5)
    expect(base.buffers).toHaveLength(1)
    expect(base.nodes[0].extensions).toBeUndefined()
  })
})
