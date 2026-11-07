import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { USE_MOCK } from './services/apiClient'

const root = createRoot(document.getElementById('root')!)

function Splash({ message, error, onRetry }: { message: string; error?: boolean; onRetry?: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-canvas p-6 text-center">
      <div className="text-lg font-bold text-navy">
        NIRF <span className="text-accent">Insights</span>
      </div>
      <p className={error ? 'max-w-md text-sm text-red-700' : 'text-sm text-muted'}>{message}</p>
      {onRetry && (
        <button type="button" className="btn-primary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

/**
 * Live mode loads the real NIRF records from the backend before any page is imported, so every
 * page sees the real data. Demo mode (VITE_USE_MOCK unset or true) skips the load.
 */
async function start() {
  if (!USE_MOCK) {
    root.render(<Splash message="Loading NIRF rankings…" />)
    try {
      const { loadLiveData } = await import('./data/live')
      await loadLiveData()
    } catch (err) {
      console.error(err)
      root.render(
        <Splash
          error
          message="Could not load data from the backend. Check that the API is running (python run.py in the backend folder) and that VITE_API_BASE_URL is correct."
          onRetry={start}
        />,
      )
      return
    }
  }
  const { default: App } = await import('./App')
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void start()
