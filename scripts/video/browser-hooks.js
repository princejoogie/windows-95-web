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
  document.addEventListener('DOMContentLoaded', () => {
    const pointer = document.createElement('div')
    pointer.style.cssText =
      'position:fixed;left:900px;top:650px;width:12px;height:19px;pointer-events:none;z-index:2147483647;image-rendering:pixelated'
    pointer.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="19" viewBox="0 0 12 19" shape-rendering="crispEdges"><path fill="white" stroke="black" d="M0 0v16l4-4 3 6 3-1-3-6h5z"/></svg>'
    document.body.append(pointer)
    document.addEventListener(
      'pointermove',
      (event) => {
        pointer.style.left = `${Math.round(event.clientX)}px`
        pointer.style.top = `${Math.round(event.clientY)}px`
        pointer.style.display =
          event.target instanceof Element && event.target.closest('canvas') ? 'none' : 'block'
      },
      true,
    )
  })
})()
