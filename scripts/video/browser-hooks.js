;(() => {
  HTMLMediaElement.prototype.play = () => Promise.resolve()
  AudioContext.prototype.decodeAudioData = () =>
    Promise.reject(new Error('Sampled audio is disabled for video capture'))
  const connect = AudioNode.prototype.connect
  const contexts = new Map()
  let recording = false
  let origin = 0
  function start(context, track) {
    track.chunks = []
    track.offset = (performance.now() - origin) / 1000
    track.recorder = new MediaRecorder(track.destination.stream, { mimeType: 'audio/webm;codecs=opus' })
    track.recorder.ondataavailable = (event) => {
      if (event.data.size) track.chunks.push(event.data)
    }
    track.keepAlive = context.createConstantSource()
    track.keepAlive.offset.value = 0
    track.keepAlive.connect(track.destination)
    track.keepAlive.start()
    track.recorder.start()
    void context.resume()
  }
  AudioNode.prototype.connect = function (destination, ...args) {
    const result = connect.call(this, destination, ...args)
    if (destination instanceof AudioDestinationNode) {
      let track = contexts.get(this.context)
      if (!track) {
        track = { destination: this.context.createMediaStreamDestination() }
        contexts.set(this.context, track)
        if (recording) start(this.context, track)
      }
      connect.call(this, track.destination)
    }
    return result
  }
  window.__videoAudio = {
    start() {
      recording = true
      origin = performance.now()
      for (const [context, track] of contexts) start(context, track)
    },
    async stop() {
      recording = false
      const results = []
      for (const track of contexts.values()) {
        if (!track.recorder || track.recorder.state === 'inactive') continue
        await new Promise((resolve) => {
          track.recorder.onstop = resolve
          track.recorder.stop()
        })
        track.keepAlive.stop()
        track.keepAlive.disconnect()
        const blob = new Blob(track.chunks, { type: 'audio/webm' })
        const data = await new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result.split(',')[1])
          reader.readAsDataURL(blob)
        })
        results.push({ offset: track.offset, data })
      }
      return results
    },
  }
  const cursors = {
    arrow: {
      hotspot: [0, 0],
      rows: [
        'B',
        'BB',
        'BWB',
        'BWWB',
        'BWWWB',
        'BWWWWB',
        'BWWWWWB',
        'BWWWWWWB',
        'BWWWWWWWB',
        'BWWWWWWWWB',
        'BWWWWWWWWWB',
        'BWWWWWWBBBBB',
        'BWWWBWWB',
        'BWWB.BWWB',
        'BWB..BWWB',
        'BB....BWWB',
        'B.....BWWB',
        '.......BWWB',
        '.......BBB',
      ],
    },
    crosshair: {
      hotspot: [7, 7],
      rows: [
        '.......B',
        '.......B',
        '.......B',
        '.......B',
        '.......B',
        '.......B',
        '',
        'BBBBBB.B.BBBBBB',
        '',
        '.......B',
        '.......B',
        '.......B',
        '.......B',
        '.......B',
        '.......B',
      ],
    },
    text: {
      hotspot: [3, 8],
      rows: [
        'BBB.BBB',
        '...B',
        '...B',
        '...B',
        '...B',
        '...B',
        '...B',
        '...B',
        '...B',
        '...B',
        '...B',
        '...B',
        '...B',
        '...B',
        '...B',
        'BBB.BBB',
      ],
    },
  }
  function bitmap({ rows }) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(...rows.map((row) => row.length))
    canvas.height = rows.length
    const context = canvas.getContext('2d')
    rows.forEach((row, y) => {
      ;[...row].forEach((pixel, x) => {
        if (pixel === '.') return
        context.fillStyle = pixel === 'W' ? '#ffffff' : '#000000'
        context.fillRect(x, y, 1, 1)
      })
    })
    return canvas.toDataURL()
  }
  function cursorFor(target) {
    if (!(target instanceof Element)) return 'arrow'
    const keyword = getComputedStyle(target).cursor.split(',').at(-1).trim()
    if (keyword === 'none') return null
    if (keyword === 'crosshair') return 'crosshair'
    if (keyword === 'text') return 'text'
    if (target.closest('canvas')) return null
    return 'arrow'
  }
  document.addEventListener('DOMContentLoaded', () => {
    const pointers = Object.fromEntries(
      Object.entries(cursors).map(([name, shape]) => {
        const image = document.createElement('img')
        image.src = bitmap(shape)
        image.dataset.videoPointer = name
        image.style.cssText =
          'position:fixed;left:0;top:0;display:none;pointer-events:none;z-index:2147483647;image-rendering:pixelated'
        document.body.append(image)
        return [name, image]
      }),
    )
    let x = 900
    let y = 650
    let shown = ''
    const render = () => {
      const kind = cursorFor(document.elementFromPoint(x, y))
      const key = kind ? `${kind}:${x}:${y}` : 'hidden'
      if (key !== shown) {
        shown = key
        for (const [name, image] of Object.entries(pointers)) {
          image.style.display = name === kind ? 'block' : 'none'
          if (name !== kind) continue
          const [hx, hy] = cursors[name].hotspot
          image.style.transform = `translate(${x - hx}px, ${y - hy}px)`
        }
      }
    }
    const update = () => {
      render()
      requestAnimationFrame(update)
    }
    document.addEventListener(
      'pointermove',
      (event) => {
        x = Math.round(event.clientX)
        y = Math.round(event.clientY)
        render()
      },
      true,
    )
    requestAnimationFrame(update)
  })
})()
