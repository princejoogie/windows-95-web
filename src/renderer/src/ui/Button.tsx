import type { ButtonHTMLAttributes } from 'react'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The button Enter presses. Windows draws it with an extra black ring. */
  isDefault?: boolean
  /** Holds the pressed look, for toggle buttons. */
  pressed?: boolean
}

/**
 * A Windows 95 push button. The ring and the focus rectangle live in `styles.css` (`push-button`), because
 * which button wears the ring depends on where focus is in the whole dialog.
 */
export function Button({
  isDefault,
  pressed,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      data-default={isDefault || undefined}
      className={`group relative min-w-[75px] h-[23px] px-2 bg-face disabled:text-embossed
        ${pressed ? 'bevel-pressed dither outline-none' : 'push-button'} ${className}`}
      {...rest}
    >
      <span
        className={`block ${pressed ? 'translate-x-px translate-y-px' : 'group-enabled:group-active:translate-x-px group-enabled:group-active:translate-y-px'}`}
      >
        {children}
      </span>
    </button>
  )
}
