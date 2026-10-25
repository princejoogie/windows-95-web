import type { FsNode } from '../fs/types'
import { icons } from '../icons'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { useNaming } from './folderOptions'

/** The title and question Windows 95 asks before a delete, from what is being deleted and where it goes. */
export function deleteWording(
  nodes: readonly FsNode[],
  permanent: boolean,
  label: (node: FsNode) => string,
): { title: string; message: string } | null {
  const [first] = nodes
  if (!first) return null
  const many = nodes.length > 1
  const folder = !many && first.kind === 'folder'
  const title = many
    ? 'Confirm Multiple File Delete'
    : folder
      ? 'Confirm Folder Delete'
      : 'Confirm File Delete'
  const message = permanent
    ? many
      ? `Are you sure you want to delete these ${nodes.length} items?`
      : `Are you sure you want to delete '${label(first)}'?`
    : many
      ? `Are you sure you want to send these ${nodes.length} items to the Recycle Bin?`
      : folder
        ? `Are you sure you want to remove the folder '${label(first)}' and move all its contents to the Recycle Bin?`
        : `Are you sure you want to send '${label(first)}' to the Recycle Bin?`
  return { title, message }
}

/**
 * The shell's delete confirmation: a picture of the item flying into the Recycle Bin (or a full bin for a
 * permanent delete), the question, and Yes and No. The desktop and every folder window ask with it.
 */
export function DeleteConfirmation({
  nodes,
  permanent,
  onAnswer,
}: {
  nodes: readonly FsNode[]
  permanent: boolean
  onAnswer: (yes: boolean) => void
}) {
  const naming = useNaming()
  const wording = deleteWording(nodes, permanent, naming.label)
  if (!wording) return null
  const folder = nodes.length === 1 && nodes[0]?.kind === 'folder'
  return (
    <Dialog title={wording.title} onClose={() => onAnswer(false)}>
      <form
        className="p-3 flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          onAnswer(true)
        }}
        onKeyDown={(event) => {
          if (event.altKey || event.ctrlKey) return
          if (event.key.toLowerCase() === 'y' || event.key.toLowerCase() === 'n') {
            event.preventDefault()
            onAnswer(event.key.toLowerCase() === 'y')
          }
        }}
      >
        <div className="flex items-center gap-4">
          <div
            role="img"
            className="relative size-8 shrink-0"
            aria-label={permanent ? 'Delete file' : 'Send file to Recycle Bin'}
          >
            <img
              src={folder ? icons.small.folderClosed : icons.document}
              alt=""
              className="absolute left-0 top-0 size-4"
            />
            <svg
              aria-hidden="true"
              className="absolute left-[13px] top-[1px]"
              width="8"
              height="8"
              shapeRendering="crispEdges"
            >
              <path d="M0 1h2v2h2V1h2v5H1V4h2L0 1z" />
            </svg>
            <img
              src={permanent ? icons.binFull : icons.binEmpty}
              alt=""
              className="absolute right-0 bottom-0 size-6"
            />
          </div>
          <p className="max-w-[400px]">{wording.message}</p>
        </div>
        <div className="flex justify-center gap-[6px]">
          <Button type="submit" isDefault autoFocus>
            <u>Y</u>es
          </Button>
          <Button onClick={() => onAnswer(false)}>
            <u>N</u>o
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
