import { useEffect, useRef } from 'react'
import type { AppProps } from '../../shell/types'
import { SCREEN_H, SCREEN_W } from './render'
import { DoomRuntime } from './runtime'

export function Doom95({ window: win }: AppProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const runtimeRef = useRef<DoomRuntime | null>(null)
  const close = useRef(win.close)
  close.current = win.close
  const active = win.focused && !win.minimized

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const runtime = new DoomRuntime(canvas, () => close.current())
    runtimeRef.current = runtime
    const lock = () => runtime.pointerLockChanged()
    const move = (event: MouseEvent) => runtime.mouseMove(event.movementX)
    const up = (event: MouseEvent) => runtime.mouseUp(event.button)
    document.addEventListener('pointerlockchange', lock)
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
    return () => {
      document.removeEventListener('pointerlockchange', lock)
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
      runtime.dispose()
      runtimeRef.current = null
    }
  }, [])

  useEffect(() => {
    const runtime = runtimeRef.current
    if (!runtime) return
    if (!active) {
      runtime.stop()
      return
    }
    runtime.start()
    const down = (event: KeyboardEvent) => {
      if (event.altKey || event.metaKey) return
      if (runtime.keyDown(event)) event.preventDefault()
    }
    const up = (event: KeyboardEvent) => runtime.keyUp(event)
    document.addEventListener('keydown', down)
    document.addEventListener('keyup', up)
    return () => {
      document.removeEventListener('keydown', down)
      document.removeEventListener('keyup', up)
      runtime.releaseKeys()
    }
  }, [active])

  return (
    <div className="h-full w-full flex flex-col bg-black">
      <canvas
        ref={canvasRef}
        width={SCREEN_W}
        height={SCREEN_H}
        className="flex-1 min-h-0 w-full object-contain pixelated outline-none"
        onMouseDown={(event) => runtimeRef.current?.mouseDown(event.button)}
        onContextMenu={(event) => event.preventDefault()}
      />
    </div>
  )
}
