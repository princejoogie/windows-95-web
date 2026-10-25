import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'

export function TextBox({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-[21px] px-[3px] bg-white bevel-sunken outline-none select-text disabled:bg-face ${className}`}
      spellCheck={false}
      {...rest}
    />
  )
}

export function TextArea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`p-[3px] bg-white bevel-sunken outline-none resize-none select-text ${className}`}
      spellCheck={false}
      {...rest}
    />
  )
}

interface ChoiceProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode
}

const check =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='7' height='7' shape-rendering='crispEdges'%3E%3Cpath d='M6 0h1v3H6v1H5v1H4v1H3v1H2V6H1V5H0V2h1v1h1v1h1V3h1V2h1V1h1z'/%3E%3C/svg%3E\")"

export function Checkbox({ label, className = '', ...rest }: ChoiceProps) {
  return (
    <label className={`inline-flex items-center gap-[6px] ${className}`}>
      <input
        type="checkbox"
        className="appearance-none size-[13px] bg-white bevel-sunken bg-no-repeat bg-center checked:[background-image:var(--check)] disabled:bg-face"
        style={{ '--check': check } as React.CSSProperties}
        {...rest}
      />
      <span>{label}</span>
    </label>
  )
}

export function Radio({ label, className = '', ...rest }: ChoiceProps) {
  return (
    <label className={`inline-flex items-center gap-[6px] ${className}`}>
      <span className="relative size-[12px]">
        <input
          type="radio"
          className="peer appearance-none size-[12px] rounded-full bg-white shadow-[inset_1px_1px_#808080,inset_-1px_-1px_#fff,inset_2px_2px_#000,inset_-2px_-2px_#dfdfdf]"
          {...rest}
        />
        <span className="absolute left-[4px] top-[4px] size-[4px] rounded-full bg-black hidden peer-checked:block" />
      </span>
      <span>{label}</span>
    </label>
  )
}

export function GroupBox({ label, children, className = '' }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <fieldset className={`border border-shadow shadow-[1px_1px_#fff,inset_1px_1px_#fff] px-[8px] pt-[4px] pb-[8px] ${className}`}>
      <legend className="px-[2px]">{label}</legend>
      {children}
    </fieldset>
  )
}

/** The etched line between menu groups and dialog sections. */
export function Separator({ className = '' }: { className?: string }) {
  return <div className={`h-[2px] border-t border-shadow border-b border-b-white ${className}`} />
}

export function StatusBar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex gap-[2px] pt-[2px] ${className}`}>{children}</div>
}

export function StatusPane({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bevel-shallow h-[18px] px-[4px] leading-[18px] truncate ${className}`}>{children}</div>
}
