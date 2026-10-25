import { useEffect, useRef } from 'react'
import { Button, Dialog, Separator } from '../../ui'
import { icon } from './cards'
import { Pixels } from './pixels'

const flag = new Pixels(40, 40)
for (let row = 0; row < 4; row++)
  for (let column = 0; column < 4; column++) {
    flag.rect(2 + column * 4, 7 + row * 7, 3, 4, 'k')
  }
flag.rect(18, 4, 22, 30, 'k')
flag.rect(20, 6, 8, 10, 'r')
flag.rect(30, 7, 8, 10, 'L')
flag.rect(20, 19, 8, 10, 'b')
flag.rect(30, 20, 8, 10, 'y')
const windowsFlag = flag.image()

export function About({ onClose }: { onClose: () => void }) {
  const form = useRef<HTMLFormElement>(null)
  useEffect(() => {
    form.current?.querySelector('button')?.focus()
  }, [])
  return (
    <Dialog title="About Solitaire" onClose={onClose} className="w-[400px]">
      <form
        ref={form}
        onSubmit={(event) => {
          event.preventDefault()
          onClose()
        }}
      >
        <div className="flex items-center gap-4 px-5 py-3">
          <img src={windowsFlag} width="40" height="40" alt="" />
          <div className="text-[24px]">Microsoft Windows 95</div>
        </div>
        <Separator className="mx-3" />
        <div className="flex gap-4 p-5">
          <img src={icon} width="32" height="32" className="shrink-0" alt="" />
          <div>
            Microsoft Solitaire
            <br />
            Version 4.00.950
            <br />
            <br />
            Copyright © 1981-1995 Microsoft Corp.
          </div>
        </div>
        <Separator className="mx-3" />
        <div className="flex justify-end p-3">
          <Button isDefault type="submit">
            OK
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
