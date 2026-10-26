import { describe, expect, it } from 'vitest'
import { closeUp, full, inShot, shotGraph, shots, viewFilter } from './camera.mjs'

describe('close-up framing', () => {
  it('centers the target vertically and keeps the left icon column whole', () => {
    const view = closeUp({ x: 257, y: 187, width: 510, height: 367 })
    expect(view).toMatchObject({ scale: 2, x: 0, y: 101 })
    expect(inShot(view.focus, view)).toBe(true)
  })

  it('shifts right only as far as a wide target needs', () => {
    expect(closeUp({ x: 32, y: 114, width: 960, height: 540 })).toMatchObject({ x: 32, y: 114 })
    expect(closeUp({ x: 100, y: 0, width: 900, height: 300 })).toMatchObject({ x: 64 })
  })

  it('keeps the crop inside the app when the target sits on an edge', () => {
    expect(closeUp({ x: 0, y: 503, width: 543, height: 265 })).toMatchObject({ x: 0, y: 228 })
  })

  it('refuses targets that cannot stay fully visible at 2x', () => {
    expect(() => closeUp({ x: 0, y: 0, width: 1024, height: 28 })).toThrow(/larger than a 2x close-up/)
    expect(() => closeUp({ x: 900, y: 10, width: 200, height: 100 })).toThrow(/outside/)
  })

  it('reports UI that falls outside the current shot', () => {
    expect(inShot({ x: 10, y: 10, width: 100, height: 100 }, { scale: 2, x: 32, y: 0 })).toBe(false)
    expect(inShot({ x: 10, y: 10, width: 100, height: 100 }, full())).toBe(true)
  })
})

describe('shot timeline', () => {
  const close = { scale: 2, x: 0, y: 228 }

  it('cuts on the nearest frame and drops repeated views', () => {
    const timeline = shots(
      [
        { time: 0, view: full() },
        { time: 0.74, view: close },
        { time: 1.5, view: close },
      ],
      4.8,
    )
    expect(timeline).toEqual([
      { from: 0, to: 22, view: full() },
      { from: 22, to: 144, view: close },
    ])
  })

  it('encodes 2x close-ups with nearest-neighbor scaling and full shots on black', () => {
    expect(viewFilter(close)).toBe('crop=960:540:0:228,scale=1920:1080:flags=neighbor')
    expect(viewFilter(full())).toBe('pad=1920:1080:448:156:black')
    expect(shotGraph(shots([{ time: 0, view: close }], 1), 30)).toMatch(/flags=neighbor\[v\]$/)
  })
})
