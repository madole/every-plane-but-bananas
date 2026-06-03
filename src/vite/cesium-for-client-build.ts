import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import cesium from 'vite-plugin-cesium'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const globeViewerModule = path.resolve(
  root,
  'src/components/GlobeViewer.tsx',
)
export const globeViewerStub = path.resolve(
  root,
  'src/components/GlobeViewer.stub.tsx',
)

/** Swap the globe for a no-op stub during the SSR bundle. */
export function globeViewerSsrStub(): Plugin {
  return {
    name: 'globe-viewer-ssr-stub',
    enforce: 'pre',
    apply: 'build',
    resolveId(source, _importer, options) {
      if (!options.ssr) {
        return null
      }

      const normalized = source.replace(/\\/g, '/')
      if (
        normalized === '../components/GlobeViewer' ||
        normalized.endsWith('/components/GlobeViewer') ||
        normalized === globeViewerModule ||
        normalized.endsWith('src/components/GlobeViewer.tsx')
      ) {
        return globeViewerStub
      }

      return null
    },
  }
}

/** Run vite-plugin-cesium only for the client environment. */
export function cesiumForClientBuild(
  options?: Parameters<typeof cesium>[0],
): Plugin {
  const cesiumPlugin = cesium({ rebuildCesium: true, ...options })

  return {
    name: 'cesium-for-client-build',
    configEnvironment(name, config, env) {
      if (name === 'client') {
        return cesiumPlugin.config?.(config, env)
      }

      if (name === 'ssr') {
        return {
          build: {
            rollupOptions: {
              output: {
                intro: '',
              },
            },
          },
        }
      }
    },
    configureServer: cesiumPlugin.configureServer,
    transformIndexHtml: cesiumPlugin.transformIndexHtml,
    closeBundle() {
      // Static assets are copied in scripts/copy-cesium-assets.mjs
    },
  }
}
