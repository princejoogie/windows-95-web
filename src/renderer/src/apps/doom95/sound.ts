import type { SoundId } from './defs'

export type UiSound = 'menuMove' | 'menuSelect' | 'menuBack'
export type AnySound = SoundId | UiSound

interface Voice {
  readonly ctx: AudioContext
  readonly out: AudioNode
  readonly t: number
  readonly noise: AudioBuffer
}

function envelope(ctx: AudioContext, out: AudioNode, t: number, peak: number, dur: number): GainNode {
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  gain.connect(out)
  return gain
}

function tone(
  v: Voice,
  type: OscillatorType,
  f0: number,
  f1: number,
  dur: number,
  peak: number,
  delay = 0,
): void {
  const t = v.t + delay
  const osc = v.ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(f0, t)
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur)
  osc.connect(envelope(v.ctx, v.out, t, peak, dur))
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

/** A growl: a sawtooth with a wobble on its pitch, through a lowpass. */
function growl(v: Voice, f0: number, f1: number, dur: number, peak: number, wobble: number): void {
  const osc = v.ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(f0, v.t)
  osc.frequency.exponentialRampToValueAtTime(f1, v.t + dur)
  const lfo = v.ctx.createOscillator()
  lfo.frequency.value = wobble
  const depth = v.ctx.createGain()
  depth.gain.value = f0 * 0.15
  lfo.connect(depth).connect(osc.frequency)
  const filter = v.ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 1400
  osc.connect(filter).connect(envelope(v.ctx, v.out, v.t, peak, dur))
  for (const node of [osc, lfo]) {
    node.start(v.t)
    node.stop(v.t + dur + 0.02)
  }
}

function hiss(
  v: Voice,
  type: BiquadFilterType,
  f0: number,
  f1: number,
  dur: number,
  peak: number,
  delay = 0,
): void {
  const t = v.t + delay
  const src = v.ctx.createBufferSource()
  src.buffer = v.noise
  src.loop = true
  const filter = v.ctx.createBiquadFilter()
  filter.type = type
  filter.Q.value = type === 'bandpass' ? 1.2 : 0.7
  filter.frequency.setValueAtTime(f0, t)
  filter.frequency.exponentialRampToValueAtTime(f1, t + dur)
  src.connect(filter).connect(envelope(v.ctx, v.out, t, peak, dur))
  src.start(t, Math.random())
  src.stop(t + dur + 0.02)
}

const RECIPES: Readonly<Record<AnySound, (v: Voice) => void>> = {
  pistol: (v) => {
    hiss(v, 'bandpass', 2200, 500, 0.16, 0.9)
    tone(v, 'square', 200, 50, 0.07, 0.25)
  },
  shotgun: (v) => {
    hiss(v, 'lowpass', 3000, 200, 0.45, 1.2)
    tone(v, 'sine', 110, 35, 0.25, 0.7)
    hiss(v, 'bandpass', 900, 600, 0.05, 0.25, 0.42)
    hiss(v, 'bandpass', 700, 500, 0.06, 0.25, 0.55)
  },
  punch: (v) => {
    tone(v, 'sine', 140, 45, 0.1, 0.8)
    hiss(v, 'lowpass', 700, 200, 0.08, 0.4)
  },
  doorOpen: (v) => {
    tone(v, 'sawtooth', 55, 85, 0.6, 0.18)
    hiss(v, 'lowpass', 300, 500, 0.6, 0.35)
  },
  doorClose: (v) => {
    tone(v, 'sawtooth', 85, 55, 0.5, 0.18)
    hiss(v, 'lowpass', 500, 250, 0.5, 0.3)
    tone(v, 'sine', 80, 35, 0.2, 0.7, 0.45)
  },
  locked: (v) => {
    growl(v, 150, 100, 0.22, 0.35, 18)
  },
  item: (v) => {
    tone(v, 'square', 620, 640, 0.05, 0.18)
    tone(v, 'square', 930, 950, 0.06, 0.18, 0.05)
  },
  weaponUp: (v) => {
    tone(v, 'square', 420, 430, 0.06, 0.18)
    tone(v, 'square', 630, 640, 0.06, 0.18, 0.06)
    tone(v, 'square', 840, 850, 0.08, 0.18, 0.12)
  },
  switch: (v) => {
    hiss(v, 'highpass', 2500, 3000, 0.03, 0.5)
    tone(v, 'square', 320, 300, 0.04, 0.2)
    tone(v, 'square', 200, 190, 0.05, 0.2, 0.06)
  },
  trooperSight: (v) => growl(v, 150, 95, 0.55, 0.45, 9),
  demonSight: (v) => {
    growl(v, 95, 55, 0.8, 0.55, 22)
    hiss(v, 'lowpass', 600, 200, 0.8, 0.25)
  },
  trooperPain: (v) => tone(v, 'square', 320, 150, 0.2, 0.25),
  demonPain: (v) => {
    growl(v, 210, 90, 0.3, 0.45, 30)
    hiss(v, 'bandpass', 800, 300, 0.25, 0.2)
  },
  trooperDeath: (v) => {
    growl(v, 230, 45, 0.7, 0.45, 12)
    hiss(v, 'lowpass', 1200, 150, 0.6, 0.3)
  },
  demonDeath: (v) => {
    growl(v, 170, 30, 1, 0.55, 20)
    hiss(v, 'lowpass', 900, 100, 1, 0.35)
  },
  claw: (v) => hiss(v, 'highpass', 1200, 4000, 0.14, 0.6),
  fireball: (v) => hiss(v, 'bandpass', 400, 1400, 0.45, 0.55),
  fireballHit: (v) => {
    hiss(v, 'lowpass', 1500, 150, 0.45, 0.8)
    tone(v, 'sine', 90, 30, 0.3, 0.5)
  },
  explode: (v) => {
    hiss(v, 'lowpass', 3500, 80, 1.1, 1.4)
    tone(v, 'sine', 70, 22, 0.9, 0.9)
  },
  playerPain: (v) => {
    tone(v, 'square', 230, 140, 0.2, 0.25)
    hiss(v, 'bandpass', 600, 300, 0.15, 0.2)
  },
  playerDeath: (v) => growl(v, 280, 45, 1.1, 0.5, 14),
  secret: (v) => {
    for (const [i, f] of [520, 660, 780, 1040].entries()) tone(v, 'sine', f, f, 0.14, 0.3, i * 0.09)
  },
  menuMove: (v) => {
    hiss(v, 'bandpass', 1800, 900, 0.05, 0.4)
    tone(v, 'square', 240, 160, 0.04, 0.1)
  },
  menuSelect: (v) => {
    hiss(v, 'bandpass', 2000, 500, 0.12, 0.6)
    tone(v, 'square', 200, 60, 0.06, 0.18)
  },
  menuBack: (v) => tone(v, 'square', 200, 110, 0.08, 0.15),
}

/** Synthesizes every sound on demand. The audio context starts on the first user gesture. */
export class SoundBoard {
  private ctx: AudioContext | null = null
  private noise: AudioBuffer | null = null
  private master: GainNode | null = null
  private gain = 0.35

  /** Call from a key or mouse handler, where browsers allow audio to start. */
  unlock(): void {
    if (!this.ctx) {
      const ctx = new AudioContext()
      const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
      const data = noise.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
      const master = ctx.createGain()
      master.gain.value = this.gain
      master.connect(ctx.destination)
      this.ctx = ctx
      this.noise = noise
      this.master = master
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  /** Sets the master level, which the Options page's Sound Volume controls. */
  setGain(gain: number): void {
    this.gain = gain
    if (this.master) this.master.gain.value = gain
  }

  /** `volume` from 0 to 1, `pan` from -1 (left) to 1 (right). */
  play(sound: AnySound, volume = 1, pan = 0): void {
    const { ctx, noise, master } = this
    if (!ctx || !noise || !master || ctx.state !== 'running' || volume <= 0.01) return
    const gain = ctx.createGain()
    gain.gain.value = volume
    const panner = ctx.createStereoPanner()
    panner.pan.value = Math.max(-1, Math.min(1, pan))
    gain.connect(panner).connect(master)
    RECIPES[sound]({ ctx, out: gain, t: ctx.currentTime, noise })
  }

  close(): void {
    void this.ctx?.close()
    this.ctx = null
  }
}
