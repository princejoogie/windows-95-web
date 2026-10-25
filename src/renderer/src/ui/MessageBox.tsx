import { type MessageBoxIcon, messageBoxIcons } from '../icons/messagebox'
import { Button } from './Button'
import { Dialog } from './Dialog'

interface MessageBoxProps<B extends string> {
  title: string
  message: string
  icon?: MessageBoxIcon
  /** The first button is the default one. */
  buttons: readonly B[]
  onClose: (result: B | 'cancel') => void
}

/** The standard Windows alert: an icon, a message, and a row of buttons. */
export function MessageBox<B extends string>({ title, message, icon, buttons, onClose }: MessageBoxProps<B>) {
  return (
    <Dialog title={title} onClose={() => onClose('cancel')} className="min-w-[250px] max-w-[440px]">
      <form
        className="flex flex-col gap-[12px] px-[10px] pt-[12px] pb-[8px]"
        onSubmit={(event) => {
          event.preventDefault()
          const first = buttons[0]
          if (first) onClose(first)
        }}
      >
        <div className="flex items-start gap-[14px]">
          {icon && <img src={messageBoxIcons[icon]} alt="" className="size-8 shrink-0" />}
          <p className="whitespace-pre-line pt-[2px] select-text">{message}</p>
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
              {button}
            </Button>
          ))}
        </div>
      </form>
    </Dialog>
  )
}
