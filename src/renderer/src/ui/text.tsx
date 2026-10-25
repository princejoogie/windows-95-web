import { Fragment } from 'react'

/** Renders `&File` as File with the F underlined, the way Windows marks keyboard accelerators. */
export function Accel({ label }: { label: string }) {
  const at = label.indexOf('&')
  if (at < 0 || at === label.length - 1) return <>{label}</>
  return (
    <Fragment>
      {label.slice(0, at)}
      <span className="underline">{label[at + 1]}</span>
      {label.slice(at + 2)}
    </Fragment>
  )
}

export const plainLabel = (label: string): string => label.replace('&', '')

export const accelKey = (label: string): string | undefined => {
  const at = label.indexOf('&')
  return at >= 0 ? label[at + 1]?.toLowerCase() : undefined
}
