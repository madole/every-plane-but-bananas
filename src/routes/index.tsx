import { lazy, Suspense } from 'react'
import { createFileRoute } from '@tanstack/react-router'

const GlobeViewer = lazy(() =>
  import('../components/GlobeViewer').then((module) => ({
    default: module.GlobeViewer,
  })),
)

function IndexPage() {
  return (
    <Suspense fallback={<div className="globe-viewer globe-viewer--loading" />}>
      <GlobeViewer />
    </Suspense>
  )
}

export const Route = createFileRoute('/')({
  ssr: false,
  component: IndexPage,
})
