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
- Aircraft positions via the `fetchAircraftPositions` server function (runs server-side to avoid browser CORS)

## Aircraft data sources

Positions come from the [OpenSky Network](https://opensky-network.org/) API by default, with [adsb.fi](https://adsb.fi/) as an automatic fallback when the primary provider is blocked, rate-limited, or returns nothing. Configure with server-side environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `AIRCRAFT_SOURCE` | `opensky` | Preferred provider (`opensky` or `adsbfi`); the other is the fallback. |
| `ADSBFI_LAT` / `ADSBFI_LON` | `50` / `8` | Center of the adsb.fi search region (it is radius-based, not global). |
| `ADSBFI_DIST` | `250` | adsb.fi search radius in nautical miles (250 is the API maximum). |

> Note: OpenSky's `states/all` endpoint is global, but adsb.fi returns aircraft within a radius, so the fallback shows a regional snapshot. Some networks (e.g. cloud/datacenter IPs) are blocked by OpenSky at the firewall level, in which case the adsb.fi fallback kicks in automatically.

The home route uses `ssr: false` because Cesium requires browser APIs.

Aircraft are drawn with a `BillboardCollection` (one banana texture, thousands of billboards) instead of per-aircraft GLTF `Entity` instances. Cesium 1.142 does not yet expose a public API for dynamic instanced GLTF models (`ModelInstanceCollection` was removed; multi-instance `Model.fromGltfAsync` is still in progress upstream).
