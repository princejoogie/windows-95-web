export function revealSelection(area: HTMLTextAreaElement): void {
  const mirror = document.createElement('div')
  const marker = document.createElement('span')
  const style = getComputedStyle(area)
  for (const property of [
    'font-family',
    'font-size',
    'line-height',
    'font-weight',
    'letter-spacing',
    'tab-size',
    'padding',
    'word-break',
    'overflow-wrap',
  ]) {
    mirror.style.setProperty(property, style.getPropertyValue(property))
  }
  Object.assign(mirror.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    visibility: 'hidden',
    boxSizing: 'border-box',
    width: `${area.clientWidth}px`,
    whiteSpace: area.wrap === 'off' ? 'pre' : 'pre-wrap',
  })
  mirror.append(document.createTextNode(area.value.slice(0, area.selectionStart)))
  marker.textContent = area.value.slice(area.selectionStart, area.selectionEnd) || ' '
  mirror.append(marker)
  document.body.append(mirror)
  const target = marker.getBoundingClientRect()
  const origin = mirror.getBoundingClientRect()
  const top = target.top - origin.top
  const left = target.left - origin.left
  if (top < area.scrollTop || top + target.height > area.scrollTop + area.clientHeight) {
    area.scrollTop = Math.max(0, top - area.clientHeight / 2)
  }
  if (
    area.wrap === 'off' &&
    (left < area.scrollLeft || left + target.width > area.scrollLeft + area.clientWidth)
  ) {
    area.scrollLeft = Math.max(0, left - area.clientWidth / 2)
  }
  mirror.remove()
}
