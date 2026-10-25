import { getApp } from './registry'
import type { WindowId } from './types'
import type { WindowState } from './windows'

export function TaskSwitcher({
  windows,
  order,
  selected,
}: {
  windows: readonly WindowState[]
  order: readonly WindowId[]
  selected: WindowId
}) {
  return (
    <div className="fixed inset-0 z-[11000] flex items-center justify-center pointer-events-none">
      <div
        role="dialog"
        aria-label="Task switcher"
        className="bg-face bevel-window p-[12px] min-w-[240px] max-w-[80%]"
      >
        <div className="flex flex-wrap gap-[6px] pb-[12px]">
          {order.map((id) => {
            const window = windows.find((window) => window.id === id),
              app = window && getApp(window.appId)
            return (
              <div
                key={id}
                data-switch-task={id}
                role="option"
                tabIndex={-1}
                aria-selected={id === selected}
                className={`p-[5px] border-2 ${id === selected ? 'border-title' : 'border-transparent'}`}
              >
                {app && <img src={app.icon} alt={window?.title} className="size-8" />}
              </div>
            )
          })}
        </div>
        <div className="bevel-sunken h-[23px] px-[6px] py-[4px] text-center">
          {windows.find((window) => window.id === selected)?.title}
        </div>
      </div>
    </div>
  )
}
