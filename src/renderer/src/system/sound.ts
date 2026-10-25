const soundUrls = import.meta.glob<string>('../assets/system/*.wav', {
  query: '?url',
  import: 'default',
  eager: true,
})

export type SoundName = 'tada' | 'chord' | 'ding' | 'chimes' | 'notify' | 'recycle'

export interface SoundPlayback {
  duration: number
  sampleRate: number
  channels: number
}

let context: AudioContext | undefined
const buffers = new Map<SoundName, Promise<AudioBuffer | null>>()

function decode(name: SoundName, url: string, audio: AudioContext): Promise<AudioBuffer | null> {
  const cached = buffers.get(name)
  if (cached) return cached
  const pending = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error('Sound unavailable')
      return response.arrayBuffer()
    })
    .then((bytes) => audio.decodeAudioData(bytes))
    .catch(() => {
      buffers.delete(name)
      return null
    })
  buffers.set(name, pending)
  return pending
}

async function resume(audio: AudioContext): Promise<void> {
  if (audio.state === 'running') return
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      audio.resume(),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, 100)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

export async function playSound(name: SoundName): Promise<SoundPlayback | null> {
  const url = soundUrls[`../assets/system/${name}.wav`]
  if (!url) return null
  try {
    if (!context || context.state === 'closed') {
      context = new AudioContext()
      buffers.clear()
    }
    const audio = context
    const [buffer] = await Promise.all([decode(name, url, audio), resume(audio)])
    if (!buffer || audio.state !== 'running') return null
    const source = audio.createBufferSource()
    source.buffer = buffer
    source.connect(audio.destination)
    source.onended = () => source.disconnect()
    source.start()
    return { duration: buffer.duration, sampleRate: buffer.sampleRate, channels: buffer.numberOfChannels }
  } catch {
    return null
  }
}
