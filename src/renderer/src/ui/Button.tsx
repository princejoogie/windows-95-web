import type { ButtonHTMLAttributes } from 'react'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The button Enter presses. Windows draws it with an extra black ring. */
  isDefault?: boolean
  /** Holds the pressed look, for toggle buttons. */
  pressed?: boolean
}

export function Button({
  isDefault,
  pressed,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const ring = isDefault ? 'outline outline-1 outline-black -outline-offset-1' : ''
  return (
    <button
      type={type}
      className={`group relative min-w-[75px] h-[23px] px-2 bg-face outline-none disabled:text-embossed
        ${pressed ? 'bevel-pressed dither' : 'bevel-raised enabled:active:bevel-pressed'} ${ring} ${className}`}
      {...rest}
    >
      <span
        className={`block group-focus-visible:outline group-focus-visible:outline-1 group-focus-visible:outline-dotted
          group-focus-visible:outline-black ${pressed ? 'translate-x-px translate-y-px' : 'group-enabled:group-active:translate-x-px group-enabled:group-active:translate-y-px'}`}
      >
        {children}
      </span>
    </button>
  )
}
