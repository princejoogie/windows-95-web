export const APP = { width: 1024, height: 768 }
export const FRAME = { width: 1920, height: 1080 }
export const CROP = { width: FRAME.width / 2, height: FRAME.height / 2 }
export const FULL = { x: (FRAME.width - APP.width) / 2, y: (FRAME.height - APP.height) / 2 }
export const FPS = 30

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export function closeUp(rect, label = 'close-up') {
  const focus = {
    x: Math.floor(rect.x),
    y: Math.floor(rect.y),
    width: Math.ceil(rect.x + rect.width) - Math.floor(rect.x),
    height: Math.ceil(rect.y + rect.height) - Math.floor(rect.y),
  }
  if (focus.width > CROP.width || focus.height > CROP.height)
    throw new Error(`${label} is ${focus.width}x${focus.height}, larger than a 2x close-up`)
  if (focus.x < 0 || focus.y < 0 || focus.x + focus.width > APP.width || focus.y + focus.height > APP.height)
    throw new Error(`${label} extends outside the ${APP.width}x${APP.height} app`)
  // The crop has only 64 px of horizontal slack. Centering would slice the desktop icon column on
  // the left edge, so the crop stays at x=0 whenever the target fits there.
  const x =
    focus.x + focus.width <= CROP.width
      ? 0
      : clamp(Math.round(focus.x + focus.width / 2 - CROP.width / 2), 0, APP.width - CROP.width)
  const y = clamp(Math.round(focus.y + focus.height / 2 - CROP.height / 2), 0, APP.height - CROP.height)
  return { scale: 2, x, y, focus }
}

export const full = () => ({ scale: 1 })

export function inShot(rect, view) {
  const shot = view.scale === 2 ? { x: view.x, y: view.y, ...CROP } : { x: 0, y: 0, ...APP }
  return (
    Math.floor(rect.x) >= shot.x &&
    Math.floor(rect.y) >= shot.y &&
    Math.ceil(rect.x + rect.width) <= shot.x + shot.width &&
    Math.ceil(rect.y + rect.height) <= shot.y + shot.height
  )
}

export function shots(camera, duration, fps = FPS) {
  const total = Math.round(duration * fps)
  const segments = []
  for (const { time, view } of [...camera].sort((a, b) => a.time - b.time)) {
    const from = segments.length ? clamp(Math.round(time * fps), 0, total) : 0
    const last = segments.at(-1)
    if (last?.from === from) last.view = view
    else if (!last || JSON.stringify(last.view) !== JSON.stringify(view)) segments.push({ from, view })
  }
  return segments
    .map((segment, index) => ({ ...segment, to: segments[index + 1]?.from ?? total }))
    .filter((segment) => segment.to > segment.from)
}

export function viewFilter(view, backdrop = 'black') {
  if (view.scale === 2)
    return `crop=${CROP.width}:${CROP.height}:${view.x}:${view.y},scale=${FRAME.width}:${FRAME.height}:flags=neighbor`
  if (view.scale === 1) return `pad=${FRAME.width}:${FRAME.height}:${FULL.x}:${FULL.y}:${backdrop}`
  throw new Error(`Unsupported camera scale ${view.scale}`)
}

export function shotGraph(segments, frames, backdrop) {
  const input = `[0:v]fps=${FPS},tpad=stop_mode=clone:stop_duration=5,trim=end_frame=${frames},setpts=PTS-STARTPTS`
  if (segments.length === 1) return `${input},${viewFilter(segments[0].view, backdrop)}[v]`
  const labels = segments.map((_, index) => `[s${index}]`)
  return [
    `${input},split=${segments.length}${labels.join('')}`,
    ...segments.map(
      (segment, index) =>
        `${labels[index]}trim=start_frame=${segment.from}:end_frame=${segment.to},setpts=PTS-STARTPTS,${viewFilter(segment.view, backdrop)}[c${index}]`,
    ),
    `${segments.map((_, index) => `[c${index}]`).join('')}concat=n=${segments.length}:v=1:a=0[v]`,
  ].join(';')
}
