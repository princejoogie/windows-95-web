import { Button } from './Button'
import { Dialog } from './Dialog'
import { Separator } from './fields'

interface AboutDialogProps {
  /** The product name after "Microsoft", such as `Paint` or `Windows 95`. */
  readonly app: string
  readonly icon: string
  /** Defaults to `About <app>`. */
  readonly title?: string
  /** The extra line under the copyright, such as a game's author. */
  readonly credit?: string
  readonly onClose: () => void
}

/** The shell About box (`ShellAbout`), which every Windows 95 accessory and game shows from its Help menu. */
export function AboutDialog({ app, icon, title = `About ${app}`, credit, onClose }: AboutDialogProps) {
  return (
    <Dialog title={title} onClose={onClose} className="w-[400px]">
      <form
        className="flex gap-[14px] px-[12px] pt-[12px] pb-[10px]"
        onSubmit={(event) => {
          event.preventDefault()
          onClose()
        }}
      >
        <img src={icon} alt="" className="size-8 shrink-0" />
        <div className="flex flex-1 flex-col gap-[2px]">
          <p>Microsoft {app}</p>
          <p>Windows 95</p>
          <p>Copyright © 1981-1995 Microsoft Corp.</p>
          {credit && <p>{credit}</p>}
          <Separator className="my-[8px]" />
          <p>This product is licensed to:</p>
          <p>Windows 95 User</p>
          <p>&nbsp;</p>
          <Separator className="my-[8px]" />
          <div className="grid grid-cols-[1fr_auto] gap-y-[2px]">
            <span>Physical Memory Available to Windows:</span>
            <span className="text-right">32,000 KB</span>
            <span>System Resources:</span>
            <span className="text-right">85% Free</span>
          </div>
          <div className="mt-[10px] flex justify-end">
            <Button type="submit" isDefault autoFocus>
              OK
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  )
}
