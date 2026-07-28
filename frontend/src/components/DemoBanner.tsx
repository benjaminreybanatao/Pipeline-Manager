import { useQueryClient } from '@tanstack/react-query'
import { IS_DEMO } from '../api/client'
import { Button } from './ui'

/**
 * Shown only in the server-free demo build, so nobody mistakes a browser-local
 * sandbox for a shared pipeline.
 */
export function DemoBanner() {
  const queryClient = useQueryClient()
  if (!IS_DEMO) return null

  async function reset() {
    const { resetDemoData } = await import('../demo/store')
    resetDemoData()
    await queryClient.invalidateQueries()
  }

  return (
    <div className="border-b border-edge bg-surface-2 px-4 py-1.5">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
        <span className="font-medium text-ink">Demo</span>
        <span>
          No server — the sample pipeline lives in this browser. Edits are yours alone and stay on
          this device.
        </span>
        <Button variant="ghost" className="ml-auto !py-0.5 text-xs" onClick={reset}>
          Reset demo data
        </Button>
      </div>
    </div>
  )
}
