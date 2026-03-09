interface Props {
  onRetry: () => void
}

export default function InstallGuide({ onRetry }: Props) {
  return (
    <div className="flex h-screen items-center justify-center bg-pampas">
      <div className="fixed top-0 left-0 right-0 h-12 drag-region" />
      <div className="text-center space-y-6 max-w-md px-6">
        <h1 className="text-3xl font-serif text-text-primary">Cloak</h1>
        <div className="space-y-3">
          <p className="text-gray-600">Claude Code CLI is not installed.</p>
          <div className="bg-surface rounded-lg border border-border p-4 text-left space-y-3">
            <p className="text-sm text-gray-700 font-medium">Install Claude Code:</p>
            <code className="block bg-gray-50 px-3 py-2 rounded text-sm font-mono text-text-primary">
              npm install -g @anthropic-ai/claude-code
            </code>
            <p className="text-xs text-cloudy">
              Or visit{' '}
              <a
                href="https://docs.anthropic.com/en/docs/claude-code"
                className="text-terracotta hover:underline"
              >
                docs.anthropic.com
              </a>{' '}
              for more installation options.
            </p>
          </div>
        </div>
        <button
          onClick={onRetry}
          className="px-4 py-2 rounded-lg bg-terracotta hover:bg-terracotta-dark text-white text-sm font-medium transition-colors"
        >
          Check Again
        </button>
      </div>
    </div>
  )
}
