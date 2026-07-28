/**
 * Who is acting. There is no auth yet, so the picked user is kept in
 * localStorage and sent as `X-User-Id` on every request — that is what stamps
 * the activity log. Swapping this for a real session touches only this file
 * and `api/client.ts`.
 */
import { useSyncExternalStore } from 'react'

const KEY = 'pipeline.currentUserId'
const listeners = new Set<() => void>()

let currentUserId: number | null = readStored()

function readStored(): number | null {
  const raw = localStorage.getItem(KEY)
  const parsed = raw === null ? NaN : Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

export function getCurrentUserId(): number | null {
  return currentUserId
}

export function setCurrentUserId(id: number | null): void {
  currentUserId = id
  if (id === null) localStorage.removeItem(KEY)
  else localStorage.setItem(KEY, String(id))
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useCurrentUserId(): number | null {
  return useSyncExternalStore(subscribe, getCurrentUserId)
}
