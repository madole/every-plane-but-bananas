import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fetchAircraftPositions } from '../server/aircraft'
import { GlobeViewer } from './GlobeViewer'

vi.mock('../server/aircraft', () => ({
  fetchAircraftPositions: vi.fn(() =>
    Promise.resolve({
      apiTime: 1,
      positions: [{ x: -74, y: 40, z: 1000 }],
    }),
  ),
}))

vi.mock('./AircraftStatusOverlay', () => ({
  AircraftStatusOverlay: () => <div data-testid="aircraft-status" />,
}))

vi.mock('./BananaAircraftLayer', () => ({
  BananaAircraftLayer: () => <div data-testid="banana-layer" />,
}))

vi.mock('resium', () => ({
  Viewer: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="cesium-viewer">{children}</div>
  ),
}))

vi.mock('../lib/cesium-setup', () => ({
  configureCesiumIon: vi.fn(() => true),
  createTerrainProvider: vi.fn(() => Promise.resolve({})),
  createFallbackBaseLayer: vi.fn(() => ({})),
  applyGlobeImagery: vi.fn(() => Promise.resolve()),
}))

vi.mock('cesium', () => ({
  Viewer: vi.fn(),
}))

describe('GlobeViewer', () => {
  beforeEach(() => {
    vi.mocked(fetchAircraftPositions).mockResolvedValue({
      apiTime: 1,
      positions: [{ x: -74, y: 40, z: 1000 }],
    })
  })

  it('renders the Cesium viewer container', async () => {
    render(<GlobeViewer />)
    await waitFor(() => {
      expect(screen.getByTestId('cesium-viewer')).toBeInTheDocument()
    })
  })

  it('still renders the viewer when the upstream returns an error', async () => {
    vi.mocked(fetchAircraftPositions).mockResolvedValue({
      positions: [],
      error: 'OpenSky request failed: 503',
    })

    render(<GlobeViewer />)
    await waitFor(() => {
      expect(screen.getByTestId('cesium-viewer')).toBeInTheDocument()
      expect(screen.getByTestId('aircraft-status')).toBeInTheDocument()
    })
  })
})
