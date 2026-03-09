import MainLayout from './components/layout/MainLayout'
import AuthGate from './components/auth/AuthGate'
import { useStreamEvents } from './hooks/useStreamEvents'

export default function App() {
  // Subscribe to stream events globally
  useStreamEvents()

  return (
    <AuthGate>
      <MainLayout />
    </AuthGate>
  )
}
