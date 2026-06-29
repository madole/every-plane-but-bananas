// Generates a low-poly, untextured banana glTF at public/banana.gltf.
//
// The previous model was a 5.4 MB textured mesh; rebuilding the GPU-instanced
// model from it every data refresh took 10–40s and hung the tab. This produces a
// tiny (~30 KB) curved banana with a solid yellow material instead.
//
// Axis convention (matches src/components/BananaAircraftLayer.tsx):
//   +X = length, +Y = up (curve faces up), +Z = thickness.
//
// Run with: node scripts/generate-banana.mjs

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const LENGTH_SEGMENTS = 22
const RADIAL_SEGMENTS = 10
const HALF_LENGTH = 0.115
const MAX_RADIUS = 0.022
const CURVE_HEIGHT = 0.085

function spine(u) {
  const x = -HALF_LENGTH + u * 2 * HALF_LENGTH
  // Smile-shaped arc so the tips point up and the belly faces down.
  const y = CURVE_HEIGHT * (1 - Math.sin(Math.PI * u))
  return [x, y, 0]
}

function tangent(u) {
  const dx = 2 * HALF_LENGTH
  const dy = CURVE_HEIGHT * -Math.PI * Math.cos(Math.PI * u)
  const length = Math.hypot(dx, dy)
  return [dx / length, dy / length, 0]
}

function radiusAt(u) {
  // Taper to a point at both tips, fattest just past the middle.
  return MAX_RADIUS * Math.pow(Math.sin(Math.PI * u), 0.6)
}

const positions = []
const normals = []

for (let i = 0; i <= LENGTH_SEGMENTS; i += 1) {
  const u = i / LENGTH_SEGMENTS
  const center = spine(u)
  const t = tangent(u)
  const dir1 = [t[1], -t[0], 0] // in-plane, perpendicular to the spine
  const dir2 = [0, 0, 1] // out-of-plane thickness axis
  const r = Math.max(radiusAt(u), 1e-4)
  for (let j = 0; j < RADIAL_SEGMENTS; j += 1) {
    const angle = (j / RADIAL_SEGMENTS) * Math.PI * 2
    const ca = Math.cos(angle)
    const sa = Math.sin(angle)
    const nx = ca * dir1[0] + sa * dir2[0]
    const ny = ca * dir1[1] + sa * dir2[1]
    const nz = ca * dir1[2] + sa * dir2[2]
    positions.push(center[0] + r * nx, center[1] + r * ny, center[2] + r * nz)
    normals.push(nx, ny, nz)
  }
}

const indices = []
for (let i = 0; i < LENGTH_SEGMENTS; i += 1) {
  for (let j = 0; j < RADIAL_SEGMENTS; j += 1) {
    const a = i * RADIAL_SEGMENTS + j
    const b = i * RADIAL_SEGMENTS + ((j + 1) % RADIAL_SEGMENTS)
    const c = (i + 1) * RADIAL_SEGMENTS + j
    const d = (i + 1) * RADIAL_SEGMENTS + ((j + 1) % RADIAL_SEGMENTS)
    indices.push(a, c, b, b, c, d)
  }
}

// Tip caps (triangle fans) so the ends are closed.
const startTip = positions.length / 3
const s0 = spine(0)
const t0 = tangent(0)
positions.push(s0[0], s0[1], s0[2])
normals.push(-t0[0], -t0[1], -t0[2])
for (let j = 0; j < RADIAL_SEGMENTS; j += 1) {
  const a = j
  const b = (j + 1) % RADIAL_SEGMENTS
  indices.push(startTip, b, a)
}

const endTip = positions.length / 3
const s1 = spine(1)
const t1 = tangent(1)
positions.push(s1[0], s1[1], s1[2])
normals.push(t1[0], t1[1], t1[2])
const lastRing = LENGTH_SEGMENTS * RADIAL_SEGMENTS
for (let j = 0; j < RADIAL_SEGMENTS; j += 1) {
  const a = lastRing + j
  const b = lastRing + ((j + 1) % RADIAL_SEGMENTS)
  indices.push(endTip, a, b)
}

// Anchor the geometry: centre it horizontally (X = length, Z = thickness) but
// rest its base on Y = 0. The +Y axis becomes the local "up" (surface normal)
// at render time, so flooring Y keeps the whole banana above the aircraft point
// instead of sinking its lower half below the globe surface.
const min = [Infinity, Infinity, Infinity]
const max = [-Infinity, -Infinity, -Infinity]
for (let i = 0; i < positions.length; i += 3) {
  for (let k = 0; k < 3; k += 1) {
    min[k] = Math.min(min[k], positions[i + k])
    max[k] = Math.max(max[k], positions[i + k])
  }
}
const offset = [(min[0] + max[0]) / 2, min[1], (min[2] + max[2]) / 2]
for (let i = 0; i < positions.length; i += 3) {
  positions[i + 0] -= offset[0]
  positions[i + 1] -= offset[1]
  positions[i + 2] -= offset[2]
}

const posMin = [Infinity, Infinity, Infinity]
const posMax = [-Infinity, -Infinity, -Infinity]
for (let i = 0; i < positions.length; i += 3) {
  for (let k = 0; k < 3; k += 1) {
    posMin[k] = Math.min(posMin[k], positions[i + k])
    posMax[k] = Math.max(posMax[k], positions[i + k])
  }
}

const positionArray = new Float32Array(positions)
const normalArray = new Float32Array(normals)
const indexArray = new Uint16Array(indices)

const posBytes = positionArray.byteLength
const normBytes = normalArray.byteLength
const idxBytes = indexArray.byteLength
const idxOffset = posBytes + normBytes
const totalBytes = idxOffset + Math.ceil(idxBytes / 4) * 4

const buffer = Buffer.alloc(totalBytes)
Buffer.from(positionArray.buffer).copy(buffer, 0)
Buffer.from(normalArray.buffer).copy(buffer, posBytes)
Buffer.from(indexArray.buffer).copy(buffer, idxOffset)

const vertexCount = positionArray.length / 3

const gltf = {
  asset: { version: '2.0', generator: 'generate-banana.mjs' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ name: 'banana', mesh: 0 }],
  meshes: [
    {
      name: 'banana',
      primitives: [
        {
          attributes: { POSITION: 0, NORMAL: 1 },
          indices: 2,
          material: 0,
          mode: 4,
        },
      ],
    },
  ],
  materials: [
    {
      name: 'banana',
      pbrMetallicRoughness: {
        baseColorFactor: [0.97, 0.8, 0.13, 1],
        metallicFactor: 0,
        roughnessFactor: 0.85,
      },
      emissiveFactor: [0.06, 0.05, 0],
      doubleSided: true,
    },
  ],
  accessors: [
    {
      bufferView: 0,
      componentType: 5126,
      count: vertexCount,
      type: 'VEC3',
      min: posMin,
      max: posMax,
    },
    { bufferView: 1, componentType: 5126, count: vertexCount, type: 'VEC3' },
    {
      bufferView: 2,
      componentType: 5123,
      count: indexArray.length,
      type: 'SCALAR',
    },
  ],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: posBytes, target: 34962 },
    { buffer: 0, byteOffset: posBytes, byteLength: normBytes, target: 34962 },
    { buffer: 0, byteOffset: idxOffset, byteLength: idxBytes, target: 34963 },
  ],
  buffers: [
    {
      byteLength: totalBytes,
      uri: `data:application/octet-stream;base64,${buffer.toString('base64')}`,
    },
  ],
}

const here = dirname(fileURLToPath(import.meta.url))
const outPath = resolve(here, '..', 'public', 'banana.gltf')
writeFileSync(outPath, JSON.stringify(gltf))

console.log(
  `Wrote ${outPath}: ${vertexCount} vertices, ${indexArray.length / 3} triangles, ` +
    `${(totalBytes / 1024).toFixed(1)} KB buffer, X-extent ${(posMax[0] - posMin[0]).toFixed(4)} m`,
)
