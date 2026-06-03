import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = path.join(root, 'node_modules/cesium/Build/Cesium')
const publishRoot = process.env.CESIUM_PUBLISH_DIR ?? 'dist/client'
const targetRoot = path.join(root, publishRoot, 'cesium')

const assetDirs = ['Assets', 'ThirdParty', 'Workers', 'Widgets']

for (const dir of assetDirs) {
  await fs.cp(path.join(sourceRoot, dir), path.join(targetRoot, dir), {
    recursive: true,
  })
}

console.log(`Copied Cesium static assets to ${targetRoot}`)
