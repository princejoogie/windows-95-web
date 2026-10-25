import { writeFileSync } from 'node:fs'

const rate = 48000
const tau = Math.PI * 2
const midi = (note) => 440 * 2 ** ((note - 69) / 12)

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
  const chords = [
    [50, 57, 60, 65],
    [46, 53, 57, 62],
    [53, 60, 64, 69],
    [48, 55, 60, 64],
  ]
  let offset = 0
  for (let index = 0; index < scenes.length; index++) {
    const scene = scenes[index]
    const chord = chords[Math.floor(index / 2) % chords.length]
    const quiet = scene.id === 'doom' ? 0.65 : 1
    const end = scene.id === 'shutdown'
    chord.forEach((note, n) => {
      const freq = midi(note)
      voice(
        offset,
        scene.duration,
        (t) => {
          const env = Math.min(1, t / 0.32) * Math.min(1, (scene.duration - t) / (end ? 1.7 : 0.22))
          return (
            env *
            (Math.sin(tau * freq * t + 0.25 * Math.sin(tau * 0.19 * t)) +
              0.17 * Math.sin(tau * freq * 2.002 * t))
          )
        },
        0.055 * quiet,
        (n - 1.5) / 3,
      )
    })
    for (let beat = 0; beat * 0.6 < scene.duration - 0.25; beat++) {
      const at = offset + beat * 0.6
      if (!end && beat % 2 === 0) {
        const bass = midi(chord[0] - 12)
        voice(
          at,
          0.5,
          (t) => Math.sin(tau * bass * t) * Math.exp(-t * 6) * Math.min(1, t / 0.015),
          0.12 * quiet,
        )
      }
      if (!end && scene.kind !== 'card') {
        voice(at + 0.3, 0.06, (t) => noise() * Math.exp(-t * 65), 0.012 * quiet, beat % 2 ? 0.4 : -0.4)
      }
      if (beat % 2 === 1 && !end) {
        const freq = midi(chord[(beat + index) % chord.length] + 12)
        voice(
          at,
          0.65,
          (t) =>
            (Math.sin(tau * freq * t) + 0.08 * Math.sin(tau * freq * 3 * t)) *
            Math.exp(-t * 6) *
            Math.min(1, t / 0.008),
          0.045 * quiet,
          index % 2 ? -0.3 : 0.3,
        )
      }
    }
    if (scene.id === 'boot') {
      for (const [i, note] of [62, 69, 65, 74].entries()) {
        voice(
          offset + 1.7 + i * 0.15,
          0.9,
          (t) => Math.sin(tau * midi(note) * t) * Math.exp(-t * 5) * Math.min(1, t / 0.01),
          0.08,
        )
      }
    }
    for (const cue of scene.cues ?? []) {
      const gain = cue.kind === 'key' ? 0.012 : cue.kind === 'tick' ? 0.04 : 0.023
      voice(
        offset + cue.time,
        0.035,
        (t) => (noise() * 0.5 + Math.sin(tau * 1500 * t) * 0.3) * Math.exp(-t * 140),
        gain,
      )
    }
    offset += scene.duration
  }
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
    const fade = Math.min(1, i / (rate * 0.03))
    wav.writeInt16LE(Math.round(Math.tanh(left[i] * fade) * 32767), 44 + i * 4)
    wav.writeInt16LE(Math.round(Math.tanh(right[i] * fade) * 32767), 46 + i * 4)
  }
  writeFileSync(file, wav)
  return {
    duration,
    sampleRate: rate,
    channels: 2,
    bpm: 100,
    seed: 95,
    samples:
      'All score and UI cues synthesized in soundtrack.mjs. Game WebAudio recorded separately. No system WAV samples.',
  }
}
