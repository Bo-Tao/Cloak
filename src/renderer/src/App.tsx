import { Button } from './components/ui/button'

function App(): React.JSX.Element {
  return (
    <div className="flex h-screen items-center justify-center bg-pampas">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-serif text-gray-800">Cloak</h1>
        <p className="text-cloudy">Tailwind v4 + shadcn/ui configured</p>
        <Button className="bg-terracotta hover:bg-terracotta-dark text-white">
          Get Started
        </Button>
      </div>
    </div>
  )
}

export default App
