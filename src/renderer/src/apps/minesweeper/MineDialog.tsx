import { type ComponentProps, useLayoutEffect, useRef } from 'react'
import { Dialog } from '../../ui'

export function MineDialog({ children, ...props }: ComponentProps<typeof Dialog>) {
  const content = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const keepOnScreen = () => {
      const dialog = content.current?.closest<HTMLElement>('[role="dialog"]')
      if (!dialog) return
      dialog.style.translate = ''
      const box = dialog.getBoundingClientRect()
      const x = Math.max(0, -box.left) - Math.max(0, box.right - innerWidth)
      const y = Math.max(0, -box.top) - Math.max(0, box.bottom - innerHeight)
      dialog.style.translate = `${x}px ${y}px`
    }
    keepOnScreen()
    const observer = new ResizeObserver(keepOnScreen)
    if (content.current) observer.observe(content.current)
    globalThis.addEventListener('resize', keepOnScreen)
    globalThis.addEventListener('pointerup', keepOnScreen)
    return () => {
      observer.disconnect()
      globalThis.removeEventListener('resize', keepOnScreen)
      globalThis.removeEventListener('pointerup', keepOnScreen)
    }
  }, [])
  return (
    <Dialog {...props}>
      <div ref={content}>{children}</div>
    </Dialog>
  )
}
