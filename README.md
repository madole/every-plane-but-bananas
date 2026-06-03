# Every plane in the sky, but bananas

TanStack Start app showing live aircraft positions on a Cesium globe, each rendered as a banana model.

## Setup

```bash
pnpm install
cp .env.example .env
# Set VITE_CESIUM_ION_TOKEN in .env — https://cesium.com/ion/tokens
```

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Dev server at http://localhost:3000 |
| `pnpm build` | Production build |
| `pnpm preview` | Preview production build |
| `pnpm test` | Vitest smoke tests |

## Deploy to Netlify

This project uses [`@netlify/vite-plugin-tanstack-start`](https://www.npmjs.com/package/@netlify/vite-plugin-tanstack-start). `netlify.toml` is already configured:

- **Build command:** `pnpm build`
- **Publish directory:** `dist/client`

Set `VITE_CESIUM_ION_TOKEN` in the Netlify UI under **Site configuration → Environment variables** before deploying.

## Stack

- [TanStack Start](https://tanstack.com/start) + React 19
- [Cesium](https://cesium.com/) + [Resium](https://resium.reearth.io/)
- [vite-plugin-cesium](https://www.npmjs.com/package/vite-plugin-cesium)
- OpenSky Network API for aircraft positions (`fetchOpenSkyStates` server function avoids browser CORS)

The home route uses `ssr: false` because Cesium requires browser APIs.

Aircraft are drawn with a `BillboardCollection` (one banana texture, thousands of billboards) instead of per-aircraft GLTF `Entity` instances. Cesium 1.142 does not yet expose a public API for dynamic instanced GLTF models (`ModelInstanceCollection` was removed; multi-instance `Model.fromGltfAsync` is still in progress upstream).
