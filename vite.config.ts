import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import netlify from '@netlify/vite-plugin-tanstack-start'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import {
  cesiumForClientBuild,
  globeViewerSsrStub,
} from './src/vite/cesium-for-client-build'

export default defineConfig({
  define: {
    CESIUM_BASE_URL: JSON.stringify('/cesium/'),
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    netlify(),
    globeViewerSsrStub(),
    cesiumForClientBuild(),
  ],
  ssr: {
    external: ['cesium', 'resium'],
  },
})
