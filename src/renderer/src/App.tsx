import { useState, useEffect } from 'react'
import MainLayout from './components/layout/MainLayout'

export default function App() {
  const [status, setStatus] = useState<'checking' | 'ready' | 'no-cli' | 'no-auth'>('checking')
  const [cliVersion, setCliVersion] = useState<string | null>(null)

  useEffect(() => {
    window.electronAPI.app.checkCli().then((s) => {
      if (!s.installed) {
        setStatus('no-cli')
      } else if (!s.authenticated) {
        setCliVersion(s.version)
        setStatus('no-auth')
      } else {
        setCliVersion(s.version)
        setStatus('ready')
      }
    })
  }, [])

  if (status === 'checking') {
    return (
      <div className="flex h-screen items-center justify-center bg-pampas">
        <div className="fixed top-0 left-0 right-0 h-12 drag-region" />
        <p className="text-cloudy">Checking Claude Code...</p>
      </div>
    )
  }

  if (status === 'no-cli') {
    return (
      <div className="flex h-screen items-center justify-center bg-pampas">
        <div className="fixed top-0 left-0 right-0 h-12 drag-region" />
        <div className="text-center space-y-4 max-w-md px-6">
          <h1 className="text-3xl font-serif text-gray-800">Cloak</h1>
          <p className="text-cloudy">Claude Code CLI not found.</p>
          <p className="text-sm text-gray-500">
            Install Claude Code first:{' '}
            <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">npm install -g @anthropic-ai/claude-code</code>
          </p>
        </div>
      </div>
    )
  }

  if (status === 'no-auth') {
    return (
      <div className="flex h-screen items-center justify-center bg-pampas">
        <div className="fixed top-0 left-0 right-0 h-12 drag-region" />
        <div className="text-center space-y-4 max-w-md px-6">
          <h1 className="text-3xl font-serif text-gray-800">Cloak</h1>
          <p className="text-cloudy">Claude Code v{cliVersion} — Not authenticated</p>
          <p className="text-sm text-gray-500">
            Run <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">claude auth login</code> in your terminal.
          </p>
        </div>
      </div>
    )
  }

  return <MainLayout />
}
