import { useState, useEffect, type ReactNode } from 'react'
import InstallGuide from './InstallGuide'
import LoginGuide from './LoginGuide'

interface Props {
  children: ReactNode
}

type AuthState = 'checking' | 'no-cli' | 'no-auth' | 'ready'

export default function AuthGate({ children }: Props) {
  const [state, setState] = useState<AuthState>('checking')
  const [version, setVersion] = useState<string | null>(null)

  const check = async () => {
    setState('checking')
    try {
      const status = await window.electronAPI.app.checkCli()
      if (!status.installed) {
        setState('no-cli')
      } else if (!status.authenticated) {
        setVersion(status.version)
        setState('no-auth')
      } else {
        setVersion(status.version)
        setState('ready')
      }
    } catch {
      setState('no-cli')
    }
  }

  useEffect(() => {
    check()
  }, [])

  if (state === 'checking') {
    return (
      <div className="flex h-screen items-center justify-center bg-pampas">
        <div className="fixed top-0 left-0 right-0 h-12 drag-region" />
        <p className="text-cloudy animate-pulse">Checking Claude Code...</p>
      </div>
    )
  }

  if (state === 'no-cli') {
    return <InstallGuide onRetry={check} />
  }

  if (state === 'no-auth') {
    return <LoginGuide version={version} onRetry={check} />
  }

  return <>{children}</>
}
