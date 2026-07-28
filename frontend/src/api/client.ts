import { getCurrentUserId } from '../store/currentUser'

const BASE = '/api'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function toQuery(params?: Record<string, unknown>): string {
  if (!params) return ''
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      // FastAPI reads repeated keys as a list, so no bracket syntax here.
      value.forEach((v) => search.append(key, String(v)))
    } else {
      search.append(key, String(value))
    }
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

async function request<T>(
  method: string,
  path: string,
  options: { body?: unknown; params?: Record<string, unknown> } = {},
): Promise<T> {
  const userId = getCurrentUserId()
  const response = await fetch(`${BASE}${path}${toQuery(options.params)}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(userId ? { 'X-User-Id': String(userId) } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`
    try {
      const payload = await response.json()
      if (typeof payload.detail === 'string') detail = payload.detail
      else if (Array.isArray(payload.detail)) detail = payload.detail.map((d: { msg: string }) => d.msg).join(', ')
    } catch {
      /* keep the status line */
    }
    throw new ApiError(detail, response.status)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const api = {
  get: <T,>(path: string, params?: Record<string, unknown>) => request<T>('GET', path, { params }),
  post: <T,>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  patch: <T,>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  delete: <T,>(path: string) => request<T>('DELETE', path),
}
