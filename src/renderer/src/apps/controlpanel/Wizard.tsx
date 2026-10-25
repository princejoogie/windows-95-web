import { type ReactNode, useState } from 'react'
import { Button, Dialog } from '../../ui'
import { appletIcons } from './icons'

export function Wizard({
  title,
  pages,
  onClose,
}: {
  title: string
  pages: readonly ReactNode[]
  onClose: () => void
}) {
  const [page, setPage] = useState(0)
  const last = page === pages.length - 1
  return (
    <Dialog title={title} onClose={onClose}>
      <div className="w-[440px] p-3">
        <div className="flex min-h-[238px] gap-4">
          <div className="w-[72px] bg-[#ffffff] p-3 shrink-0">
            <img src={appletIcons.programs} width={48} height={48} alt="" />
          </div>
          <div className="flex-1 pt-2" data-wizard-page={page}>
            {pages[page]}
          </div>
        </div>
        <div className="border-t border-shadow pt-3 flex justify-end gap-2">
          <Button disabled={page === 0} onClick={() => setPage(page - 1)}>
            &lt; Back
          </Button>
          <Button isDefault onClick={() => (last ? onClose() : setPage(page + 1))}>
            {last ? 'Finish' : 'Next >'}
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Dialog>
  )
}
