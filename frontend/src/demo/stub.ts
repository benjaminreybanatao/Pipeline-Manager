/**
 * Stands in for the demo backend in the normal build.
 *
 * Vite aliases `../demo/store` here unless `VITE_DEMO=true`, which keeps the
 * demo fixture (~190 kB of JSON) out of the real app's bundle entirely. Nothing
 * calls these — `IS_DEMO` is false, so the branches that would are removed.
 */

export function handle(): never {
  throw new Error('The demo backend is not available in this build.')
}

export function resetDemoData(): void {
  /* nothing to reset without the demo backend */
}
