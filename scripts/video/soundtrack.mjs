import { writeFileSync } from 'node:fs'

const rate = 48000
const tau = Math.PI * 2
const beat = 0.6
const midi = (note) => 440 * 2 ** ((note - 69) / 12)
const chords = [
  [50, 57, 60, 65],
  [46, 53, 57, 62],
  [53, 60, 64, 69],
  [48, 55, 60, 64],
]

// Every score note and UI cue is synthesized here from oscillators and seeded noise.
export function soundtrack(scenes, file) {
  const duration = scenes.reduce((sum, scene) => sum + scene.duration, 0)
  const count = Math.round(duration * rate)
  const left = new Float32Array(count)
  const right = new Float32Array(count)
  let seed = 95
  const noise = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 2147483648 - 1
  }
  function voice(start, length, sample, gain = 1, pan = 0) {
    const first = Math.round(start * rate)
    const samples = Math.round(length * rate)
    const a = Math.sqrt((1 - pan) / 2) * gain
    const b = Math.sqrt((1 + pan) / 2) * gain
    for (let i = 0; i < samples && first + i < count; i++) {
      if (first + i < 0) continue
      const value = sample(i / rate, i / samples)
      left[first + i] += value * a
      right[first + i] += value * b
    }
  }
  const regions = []
  const starts = []
  let offset = 0
  scenes.forEach((scene, index) => {
    const chord = chords[Math.floor(index / 2) % chords.length]
    const last = regions.at(-1)
    if (last?.chord === chord) last.end = offset + scene.duration
    else regions.push({ chord, start: offset, end: offset + scene.duration })
    starts.push(offset)
    offset += scene.duration
  })
  const fadeOut = Math.min(2.4, scenes.at(-1).duration)
  regions.forEach((region, index) => {
    const overlap = 0.25
    const start = index ? region.start - overlap : 0
    const end = index === regions.length - 1 ? duration : region.end + overlap
    const length = end - start
    const attack = index ? overlap * 2 : 0.6
    const release = index === regions.length - 1 ? fadeOut : overlap * 2
    region.chord.forEach((note, n) => {
      const freq = midi(note)
      voice(
        start,
        length,
        (t) => {
          const env = Math.min(1, t / attack) * Math.min(1, Math.max(0, (length - t) / release))
          return (
            env *
            (Math.sin(tau * freq * t + 0.25 * Math.sin(tau * 0.19 * t + n)) +
              0.17 * Math.sin(tau * freq * 2.002 * t))
          )
        },
        0.05,
        (n - 1.5) / 3,
      )
    })
  })
  scenes.forEach((scene, index) => {
    const chord = chords[Math.floor(index / 2) % chords.length]
    const quiet = scene.id === 'doom' ? 0.6 : 1
    const ending = index === scenes.length - 1
    const at0 = starts[index]
    for (let n = 0; n * beat < scene.duration - 0.25; n++) {
      const at = at0 + n * beat
      if (ending) break
      if (n % 2 === 0) {
        const bass = midi(chord[0] - 12)
        voice(
          at,
          0.5,
          (t) => Math.sin(tau * bass * t) * Math.exp(-t * 6) * Math.min(1, t / 0.015),
          0.12 * quiet,
        )
      }
      if (scene.kind !== 'card')
        voice(at + beat / 2, 0.06, (t) => noise() * Math.exp(-t * 65), 0.011 * quiet, n % 2 ? 0.4 : -0.4)
      if (n % 2 === 1) {
        const freq = midi(chord[(n + index) % chord.length] + 12)
        voice(
          at,
          0.65,
          (t) =>
            (Math.sin(tau * freq * t) + 0.08 * Math.sin(tau * freq * 3 * t)) *
            Math.exp(-t * 6) *
            Math.min(1, t / 0.008),
          0.042 * quiet,
          index % 2 ? -0.3 : 0.3,
        )
      }
    }
    if (ending) {
      for (const [i, note] of [74, 69, 65, 62].entries())
        voice(
          at0 + 0.3 + i * 0.3,
          2.2,
          (t) => Math.sin(tau * midi(note) * t) * Math.exp(-t * 2.4) * Math.min(1, t / 0.01),
          0.05,
          (i - 1.5) / 4,
        )
    }
    for (const cue of scene.cues ?? []) {
      if (cue.kind === 'boot') {
        for (const [i, note] of [62, 69, 65, 74].entries())
          voice(
            at0 + cue.time + i * 0.15,
            0.9,
            (t) => Math.sin(tau * midi(note) * t) * Math.exp(-t * 5) * Math.min(1, t / 0.01),
            0.08,
          )
        continue
      }
      const gain = cue.kind === 'key' ? 0.012 : cue.kind === 'tick' ? 0.04 : 0.023
      voice(
        at0 + cue.time,
        0.035,
        (t) => (noise() * 0.5 + Math.sin(tau * 1500 * t) * 0.3) * Math.exp(-t * 140),
        gain,
      )
    }
  })
  const wav = Buffer.alloc(44 + count * 4)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(wav.length - 8, 4)
  wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(2, 22)
  wav.writeUInt32LE(rate, 24)
  wav.writeUInt32LE(rate * 4, 28)
  wav.writeUInt16LE(4, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(count * 4, 40)
  for (let i = 0; i < count; i++) {
    const fade = Math.min(1, i / (rate * 0.03), (count - i) / (rate * 0.03))
    wav.writeInt16LE(Math.round(Math.tanh(left[i] * fade) * 32767), 44 + i * 4)
    wav.writeInt16LE(Math.round(Math.tanh(right[i] * fade) * 32767), 46 + i * 4)
  }
  writeFileSync(file, wav)
  return {
    duration,
    sampleRate: rate,
    channels: 2,
    bpm: 60 / beat,
    seed: 95,
    chordRegions: regions.map(({ chord, start, end }) => ({ chord, start, end })),
    samples:
      'All score and UI cues synthesized in soundtrack.mjs. Game WebAudio recorded separately. No system WAV samples.',
  }
}
