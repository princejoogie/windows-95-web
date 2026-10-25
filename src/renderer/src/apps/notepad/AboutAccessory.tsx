import { Button, Dialog, Separator } from '../../ui'

export function AboutAccessory({ name, icon, onClose }: { name: string; icon: string; onClose: () => void }) {
  return (
    <Dialog title={`About ${name}`} onClose={onClose} className="w-[375px]">
      <div className="flex gap-[18px] p-[14px]">
        <img src={icon} alt="" className="size-8" />
        <div className="flex-1 flex flex-col gap-[10px]">
          <div>
            <p>Microsoft Windows 95</p>
            <p>{name}</p>
            <p>Copyright © 1981-1995 Microsoft Corp.</p>
          </div>
          <Separator />
          <div>
            <p>This product is licensed to:</p>
            <p className="pl-[12px]">Windows 95 User</p>
            <p className="pl-[12px]">Personal Computer</p>
          </div>
          <Separator />
          <div>
            <p>Physical memory available to Windows: 32,000 KB</p>
            <p>System resources: 85% free</p>
          </div>
          <div className="flex justify-end">
            <Button isDefault autoFocus onClick={onClose}>
              OK
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
