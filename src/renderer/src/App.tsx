import { useState, useEffect } from 'react'
import { Button } from './components/ui/button'

export default function App() {
  const [status, setStatus] = useState('Checking...')

  useEffect(() => {
    window.electronAPI.app.checkCli().then((s) => {
      if (!s.installed) setStatus('Claude Code not installed')
      else if (!s.authenticated)
        setStatus(`Claude Code v${s.version} — Not authenticated`)
      else setStatus(`Claude Code v${s.version} — Ready`)
    })
  }, [])

  return (
    <div className="flex h-screen items-center justify-center bg-pampas">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-serif text-gray-800">Cloak</h1>
        <p className="text-cloudy">{status}</p>
        <Button className="bg-terracotta hover:bg-terracotta-dark text-white">
          Get Started
        </Button>
      </div>
    </div>
  )
}
