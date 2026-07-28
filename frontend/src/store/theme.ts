import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark' | 'system'

const KEY = 'pipeline.theme'
const listeners = new Set<() => void>()

let theme: Theme = (localStorage.getItem(KEY) as Theme | null) ?? 'system'
apply(theme)

function apply(next: Theme) {
  if (next === 'system') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', next)
}

export function setTheme(next: Theme) {
  theme = next
  localStorage.setItem(KEY, next)
  apply(next)
  listeners.forEach((listener) => listener())
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => theme,
  )
}
