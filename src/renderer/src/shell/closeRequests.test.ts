import { describe, expect, it } from 'vitest'
import { closeInOrder, closeSession } from './closeRequests'

describe('close sequencing', () => {
  it('queries a window opened while another close request is pending', async () => {
    let owners = [1]
    const seen: number[] = []
    expect(
      await closeSession(
        () => owners,
        async (id) => {
          seen.push(id)
          owners = owners.filter((owner) => owner !== id)
          if (id === 1) owners.push(2)
          return id !== 2
        },
      ),
    ).toBe(false)
    expect(seen).toEqual([1, 2])
  })
  it('awaits each owner and stops at Cancel', async () => {
    const seen: number[] = []
    let finish: (closed: boolean) => void = () => {}
    const result = closeInOrder([3, 2, 1], async (id) => {
      seen.push(id)
      return id === 3
        ? new Promise<boolean>((resolve) => {
            finish = resolve
          })
        : false
    })
    expect(seen).toEqual([3])
    finish(true)
    expect(await result).toBe(false)
    expect(seen).toEqual([3, 2])
  })
  it('completes only when every app has closed', async () => {
    const seen: number[] = []
    expect(
      await closeInOrder([2, 1], async (id) => {
        seen.push(id)
        return true
      }),
    ).toBe(true)
    expect(seen).toEqual([2, 1])
  })
})
