import { createFileRoute } from '@tanstack/react-router'
import { GlobeViewer } from '../components/GlobeViewer'

export const Route = createFileRoute('/')({
  ssr: false,
  component: GlobeViewer,
})
