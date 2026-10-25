import type { WindowId } from './types'

export async function closeInOrder<T>(
  items: readonly T[],
  request: (item: T) => Promise<boolean>,
): Promise<boolean> {
  for (const item of items) if (!(await request(item))) return false
  return true
}

export async function closeSession<T>(
  remaining: () => readonly T[],
  request: (item: T) => Promise<boolean>,
): Promise<boolean> {
  for (;;) {
    const owners = remaining()
    if (!owners.length) return true
    if (!(await closeInOrder(owners, request))) return false
  }
}

const requests = new Map<WindowId, () => Promise<boolean>>()
const pending = new Map<WindowId, Promise<boolean>>()

export function registerCloseRequest(id: WindowId, request: () => Promise<boolean>): () => void {
  requests.set(id, request)
  return () => {
    requests.delete(id)
  }
}

export function requestWindowClose(id: WindowId): Promise<boolean> {
  const existing = pending.get(id)
  if (existing) return existing
  const result = (requests.get(id)?.() ?? Promise.resolve(false)).finally(() => pending.delete(id))
  pending.set(id, result)
  return result
}
