type AircraftStatusOverlayProps = {
  aircraftCount: number
  lastUpdatedAt: Date | null
  isUsingCache: boolean
  globeWarning?: string
}

function formatLastUpdated(date: Date): string {
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  })
}

export function AircraftStatusOverlay({
  aircraftCount,
  lastUpdatedAt,
  isUsingCache,
  globeWarning,
}: AircraftStatusOverlayProps) {
  return (
    <div className="aircraft-status" aria-live="polite">
      <p className="aircraft-status__count">
        {aircraftCount.toLocaleString()} bananas in the sky
      </p>
      <p className="aircraft-status__updated">
        {lastUpdatedAt
          ? `Last updated ${formatLastUpdated(lastUpdatedAt)}`
          : 'Waiting for aircraft data…'}
        {isUsingCache ? ' (cached)' : ''}
      </p>
      {globeWarning ? (
        <p className="aircraft-status__warning">{globeWarning}</p>
      ) : null}
    </div>
  )
}
