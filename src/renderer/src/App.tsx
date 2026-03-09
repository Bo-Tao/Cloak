import MainLayout from './components/layout/MainLayout'
import AuthGate from './components/auth/AuthGate'
import { useStreamEvents } from './hooks/useStreamEvents'
import { useTheme } from './hooks/useTheme'

export default function App() {
  useStreamEvents()
  useTheme()

  return (
    <AuthGate>
      <MainLayout />
    </AuthGate>
  )
}
