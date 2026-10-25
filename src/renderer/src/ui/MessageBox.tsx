import { type MessageBoxIcon, messageBoxIcons } from '../icons/messagebox'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { Accel, accelKey } from './text'

interface MessageBoxProps<B extends string> {
  title: string
  message: string
  icon?: MessageBoxIcon
  /** The first button is the default one. */
  buttons: readonly B[]
  /**
   * Esc and the Close button answer `Cancel` when there is one, and `OK` in an OK-only box. Any other box
   * can only be answered with its buttons, so `'cancel'` never arrives from them.
   */
  onClose: (result: B | 'cancel') => void
}

/** Windows marks these standard answers with an accelerator; OK and Cancel have none. */
const LABELS: Readonly<Record<string, string>> = {
  Yes: '&Yes',
  No: '&No',
  Retry: '&Retry',
  Abort: '&Abort',
  Ignore: '&Ignore',
}

const labelOf = (button: string) => LABELS[button] ?? button

/** What Esc answers, or `null` when the box has no way to dismiss it without choosing. */
export function escapeAnswer<B extends string>(buttons: readonly B[]): B | null {
  const cancel = buttons.find((button) => button === 'Cancel')
  if (cancel) return cancel
  return buttons.length === 1 && buttons[0] === 'OK' ? buttons[0] : null
}

/** The standard Windows alert: an icon, a message, and a row of buttons. */
export function MessageBox<B extends string>({ title, message, icon, buttons, onClose }: MessageBoxProps<B>) {
  const dismiss = escapeAnswer(buttons)
  return (
    <Dialog title={title} {...(dismiss === null ? {} : { onClose: () => onClose(dismiss) })}>
      <form
        className="flex flex-col items-center gap-[12px] pl-[11px] pr-[11px] pt-[11px] pb-[10px]"
        onSubmit={(event) => {
          event.preventDefault()
          const first = buttons[0]
          if (first) onClose(first)
        }}
        onKeyDown={(event) => {
          if (event.altKey || event.ctrlKey || event.metaKey) return
          const button = buttons.find((b) => accelKey(labelOf(b)) === event.key.toLowerCase())
          if (!button) return
          event.preventDefault()
          onClose(button)
        }}
      >
        <div className="flex items-start gap-[14px] self-stretch">
          {icon && <img src={messageBoxIcons[icon]} alt="" className="size-8 shrink-0" />}
          <div className={`flex items-center ${icon ? 'min-h-8' : ''}`}>
            <p className="whitespace-pre-line w-max max-w-[62.5vw] select-text">{message}</p>
          </div>
        </div>
        <div className="flex justify-center gap-[6px]">
          {buttons.map((button, index) => (
            <Button
              key={button}
              type={index === 0 ? 'submit' : 'button'}
              isDefault={index === 0}
              autoFocus={index === 0}
              onClick={index === 0 ? undefined : () => onClose(button)}
            >
              <Accel label={labelOf(button)} />
            </Button>
          ))}
        </div>
      </form>
    </Dialog>
  )
}
