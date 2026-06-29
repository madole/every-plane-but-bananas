<!-- intent-skills:start -->
# Skill mappings - load `use` with `pnpm dlx @tanstack/intent@latest load <use>`.
skills:
  - when: "Install TanStack Devtools, pick framework adapter (React/Vue/Solid/Preact), register plugins via plugins prop, configure shell (position, hotkeys, theme, hideUntilHover, requireUrlFlag, eventBusConfig). TanStackDevtools component, defaultOpen, localStorage persistence."
    use: "@tanstack/devtools#devtools-app-setup"
  - when: "Publish plugin to npm and submit to TanStack Devtools Marketplace. PluginMetadata registry format, plugin-registry.ts, pluginImport (importName, type), requires (packageName, minVersion), framework tagging, multi-framework submissions, featured plugins."
    use: "@tanstack/devtools#devtools-marketplace"
  - when: "Build devtools panel components that display emitted event data. Listen via EventClient.on(), handle theme (light/dark), use @tanstack/devtools-ui components. Plugin registration (name, render, id, defaultOpen), lifecycle (mount, activate, destroy), max 3 active plugins. Two paths: Solid.js core with devtools-ui for multi-framework support, or framework-specific panels."
    use: "@tanstack/devtools#devtools-plugin-panel"
  - when: "Handle devtools in production vs development. removeDevtoolsOnBuild, devDependency vs regular dependency, conditional imports, NoOp plugin variants for tree-shaking, non-Vite production exclusion patterns."
    use: "@tanstack/devtools#devtools-production"
  - when: "Two-way event patterns between devtools panel and application. App-to-devtools observation, devtools-to-app commands, time-travel debugging with snapshots and revert. structuredClone for snapshot safety, distinct event suffixes for observation vs commands, serializable payloads only."
    use: "@tanstack/devtools-event-client#devtools-bidirectional"
  - when: "Create typed EventClient for a library. Define event maps with typed payloads, pluginId auto-prepend namespacing, emit()/on()/onAll()/onAllPluginEvents() API. Connection lifecycle (5 retries, 300ms), event queuing, enabled/disabled state, SSR fallbacks, singleton pattern. Unique pluginId requirement to avoid event collisions."
    use: "@tanstack/devtools-event-client#devtools-event-client"
  - when: "Analyze library codebase for critical architecture and debugging points, add strategic event emissions. Identify middleware boundaries, state transitions, lifecycle hooks. Consolidate events (1 not 15), debounce high-frequency updates, DRY shared payload fields, guard emit() for production. Transparent server/client event bridging."
    use: "@tanstack/devtools-event-client#devtools-instrumentation"
  - when: "Configure @tanstack/devtools-vite for source inspection (data-tsd-source, inspectHotkey, ignore patterns), console piping (client-to-server, server-to-client, levels), enhanced logging, server event bus (port, host, HTTPS), production stripping (removeDevtoolsOnBuild), editor integration (launch-editor, custom editor.open). Must be FIRST plugin in Vite config. Vite ^6 || ^7 only."
    use: "@tanstack/devtools-vite#devtools-vite-plugin"
  - when: "Step-by-step migration from Next.js App Router to TanStack Start: route definition conversion, API mapping, server function conversion from Server Actions, middleware conversion, data fetching pattern changes."
    use: "@tanstack/react-start#lifecycle/migrate-from-nextjs"
  - when: "React bindings for TanStack Start: createStart, StartClient, StartServer, React-specific imports, re-exports from @tanstack/react-router, full project setup with React, useServerFn hook."
    use: "@tanstack/react-start#react-start"
  - when: "Implement, review, debug, and refactor TanStack Start React Server Components in React 19 apps. Use when tasks mention @tanstack/react-start/rsc, renderServerComponent, createCompositeComponent, CompositeComponent, renderToReadableStream, createFromReadableStream, createFromFetch, Composite Components, React Flight streams, loader or query owned RSC caching, router.invalidate, structuralSharing: false, selective SSR, stale names like renderRsc or .validator, or migration from Next App Router RSC patterns. Do not use for generic SSR or non-TanStack RSC frameworks except brief comparison."
    use: "@tanstack/react-start#react-start/server-components"
  - when: "Framework-agnostic core concepts for TanStack Router: route trees, createRouter, createRoute, createRootRoute, createRootRouteWithContext, addChildren, Register type declaration, route matching, route sorting, file naming conventions. Entry point for all router skills."
    use: "@tanstack/router-core#router-core"
  - when: "Route protection with beforeLoad, redirect()/throw redirect(), isRedirect helper, authenticated layout routes (_authenticated), non-redirect auth (inline login), RBAC with roles and permissions, auth provider integration (Auth0, Clerk, Supabase), router context for auth state."
    use: "@tanstack/router-core#router-core/auth-and-guards"
  - when: "Automatic code splitting (autoCodeSplitting), .lazy.tsx convention, createLazyFileRoute, createLazyRoute, lazyRouteComponent, getRouteApi for typed hooks in split files, codeSplitGroupings per-route override, splitBehavior programmatic config, critical vs non-critical properties."
    use: "@tanstack/router-core#router-core/code-splitting"
  - when: "Route loader option, loaderDeps for cache keys, staleTime/gcTime/ defaultPreloadStaleTime SWR caching, pendingComponent/pendingMs/ pendingMinMs, errorComponent/onError/onCatch, beforeLoad, router context and createRootRouteWithContext DI pattern, router.invalidate, Await component, deferred data loading with unawaited promises."
    use: "@tanstack/router-core#router-core/data-loading"
  - when: "Link component, useNavigate, Navigate component, router.navigate, ToOptions/NavigateOptions/LinkOptions, from/to relative navigation, activeOptions/activeProps, preloading (intent/viewport/render), preloadDelay, navigation blocking (useBlocker, Block), createLink, linkOptions helper, scroll restoration, MatchRoute."
    use: "@tanstack/router-core#router-core/navigation"
  - when: "notFound() function, notFoundComponent, defaultNotFoundComponent, notFoundMode (fuzzy/root), errorComponent, CatchBoundary, CatchNotFound, isNotFound, NotFoundRoute (deprecated), route masking (mask option, createRouteMask, unmaskOnReload)."
    use: "@tanstack/router-core#router-core/not-found-and-errors"
  - when: "Dynamic path segments ($paramName), splat routes ($ / _splat), optional params ({-$paramName}), prefix/suffix patterns ({$param}.ext), useParams, params.parse/stringify, pathParamsAllowedCharacters, i18n locale patterns."
    use: "@tanstack/router-core#router-core/path-params"
  - when: "validateSearch, search param validation with Zod/Valibot/ArkType adapters, fallback(), search middlewares (retainSearchParams, stripSearchParams), custom serialization (parseSearch, stringifySearch), search param inheritance, loaderDeps for cache keys, reading and writing search params."
    use: "@tanstack/router-core#router-core/search-params"
  - when: "Non-streaming and streaming SSR, RouterClient/RouterServer, renderRouterToString/renderRouterToStream, createRequestHandler, defaultRenderHandler/defaultStreamHandler, HeadContent/Scripts components, head route option (meta/links/styles/scripts), ScriptOnce, automatic loader dehydration/hydration, memory history on server, data serialization, document head management."
    use: "@tanstack/router-core#router-core/ssr"
  - when: "Full type inference philosophy (never cast, never annotate inferred values), Register module declaration, from narrowing on hooks and Link, strict:false for shared components, getRouteApi for code-split typed access, addChildren with object syntax for TS perf, LinkProps and ValidateLinkOptions type utilities, as const satisfies pattern."
    use: "@tanstack/router-core#router-core/type-safety"
  - when: "TanStack Router bundler plugin for route generation and automatic code splitting. Supports Vite, Webpack, Rspack, and esbuild. Configures autoCodeSplitting, routesDirectory, target framework, and code split groupings."
    use: "@tanstack/router-plugin#router-plugin"
<!-- intent-skills:end -->

## Cursor Cloud specific instructions

Despite the TanStack skill mappings above (CTA-injected hints), this repo is a **single TanStack Start (React 19) + Cesium app** (`every-plane-but-bananas`), not the TanStack monorepo. There are no workspaces/turbo/nx. Package manager is **pnpm**.

Standard scripts live in `package.json` (`dev`, `build`, `preview`, `test`, `lint`, `format`, `check`). `pnpm dev` serves at http://localhost:3000.

Non-obvious caveats:
- **OpenSky API is unreachable from the cloud VM (server-side IP block).** Requests to `opensky-network.org` (`194.209.200.34`) complete the TCP handshake but are then reset (`ECONNRESET`) on both port 443 and port 80, regardless of SNI. OpenSky is up and serves data fine from other networks, so this is OpenSky's edge firewall rejecting this datacenter egress IP — **not** the Cursor "allow network activity" toggle and not a code bug. Enabling network access does not change it; fixing it would require OpenSky allowlisting the IP or routing OpenSky traffic through a different (non-blocked) egress. The app degrades gracefully: the globe still renders and the overlay shows `0 bananas in the sky` / `Waiting for aircraft data…`.
- **No Cesium Ion token by default.** Without `VITE_CESIUM_ION_TOKEN` in `.env`, Cesium uses its default ion token / OSM fallback and the globe still renders (with a token warning in the overlay). `.env` is optional; copy `.env.example` to `.env` and set the token only if you need HD imagery/terrain.
- The home route is `ssr: false` and the globe needs **WebGL/a real browser**; the large `GlobeViewer` bundle takes ~10–15s to lazy-load on first paint (black screen until then).
- `pnpm lint` currently reports pre-existing `consistent-type-imports` errors in committed source; they are auto-fixable via `pnpm format` (or `eslint --fix`) and are unrelated to environment setup.
