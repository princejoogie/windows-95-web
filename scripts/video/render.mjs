import { spawn } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FPS, full, shotGraph, shots } from './camera.mjs'
import { capture, captureCards } from './capture.mjs'
import { poster, scenes, teaser } from './scenes.mjs'
import { soundtrack } from './soundtrack.mjs'

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const output = join(root, 'release/video')
const proof = resolve(
  process.env.W95_VIDEO_PROOF_DIR ?? 'D:/codes/worktrees/windows-95-web/proof/video-opus55',
)
const runId = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const work = join(output, 'work', runId)
mkdirSync(work, { recursive: true })
mkdirSync(proof, { recursive: true })
const log = createWriteStream(join(work, 'commands.log'))
const commands = []
async function run(command, args, logName) {
  const entry = { command, args, started: new Date().toISOString() }
  commands.push(entry)
  const result = await new Promise((resolveResult, reject) => {
    const child = spawn(command, args, { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = '',
      stderr = ''
    child.stdout.on('data', (data) => {
      stdout += data
      log.write(data)
    })
    child.stderr.on('data', (data) => {
      stderr += data
      log.write(data)
    })
    child.on('error', reject)
    child.on('close', (code) => {
      entry.exitCode = code
      if (logName) writeFileSync(join(proof, logName), stdout + stderr)
      if (code !== 0) reject(new Error(`${command} exited ${code}\n${stderr.slice(-6000)}`))
      else resolveResult({ stdout, stderr })
    })
  })
  return result
}
const ffmpeg = (args, logName) => run('ffmpeg', ['-hide_banner', '-y', ...args], logName)
const encoding = [
  '-c:v',
  'libx264',
  '-preset',
  'fast',
  '-crf',
  '17',
  '-pix_fmt',
  'yuv420p',
  '-threads',
  '4',
  '-video_track_timescale',
  '15360',
]
const ffpath = (path) => path.replaceAll('\\', '/').replaceAll("'", "'\\''")
const stamp = (seconds) => {
  const tenths = Math.round(seconds * 10)
  return `${String(Math.floor(tenths / 600)).padStart(2, '0')}:${((tenths % 600) / 10).toFixed(1).padStart(4, '0')}`
}

async function encodeScene(scene) {
  scene.clip = join(work, `${scene.id}.mp4`)
  console.log(`Encode ${scene.id}`)
  const frames = Math.round(scene.duration * FPS)
  if (scene.kind === 'card') {
    await ffmpeg([
      '-framerate',
      String(FPS),
      '-i',
      join(scene.folder, '%06d.png'),
      '-frames:v',
      String(frames),
      '-an',
      ...encoding,
      scene.clip,
    ])
    return
  }
  const initial = readFileSync(join(scene.folder, 'initial.png'))
  if (initial.readUInt32BE(16) !== 1024 || initial.readUInt32BE(20) !== 768)
    throw new Error(`Capture is not native 1024x768: ${scene.id}`)
  scene.shots = shots(scene.camera ?? [{ time: 0, view: full() }], scene.duration)
  await ffmpeg([
    '-safe',
    '0',
    '-f',
    'concat',
    '-i',
    join(scene.folder, 'frames.ffconcat'),
    '-filter_complex',
    shotGraph(scene.shots, frames, 'black'),
    '-map',
    '[v]',
    '-frames:v',
    String(frames),
    '-an',
    ...encoding,
    scene.clip,
  ])
}

async function mix(score, tracks, out) {
  const inputs = ['-i', score]
  const filters = tracks.map((track, index) => {
    inputs.push('-i', track.file)
    const trim = `atrim=start=${track.from}${track.duration ? `:duration=${track.duration}` : ''}`
    return `[${index + 1}:a]aresample=48000,asetpts=PTS-STARTPTS,${trim},asetpts=PTS-STARTPTS,adelay=${Math.round(track.at * 1000)}:all=1,volume=0.55[a${index + 1}];`
  })
  const labels = ['[0:a]', ...tracks.map((_, index) => `[a${index + 1}]`)]
  await ffmpeg([
    ...inputs,
    '-filter_complex',
    `${filters.join('')}${labels.join('')}amix=inputs=${labels.length}:duration=first:normalize=0,alimiter=limit=0.95:level=false[mix]`,
    '-map',
    '[mix]',
    '-ar',
    '48000',
    '-c:a',
    'pcm_s24le',
    out,
  ])
}

async function loudnorm(mixed, name) {
  const first = await ffmpeg(
    ['-i', mixed, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=9:print_format=json', '-f', 'null', '-'],
    `${name}-pass1.txt`,
  )
  const measurement = JSON.parse(first.stderr.match(/\{\s*"input_i"\s*:[\s\S]*?\}/)?.[0] ?? 'null')
  if (!measurement) throw new Error('ffmpeg did not return loudnorm measurements')
  return `loudnorm=I=-14:TP=-1.5:LRA=9:measured_I=${measurement.input_i}:measured_TP=${measurement.input_tp}:measured_LRA=${measurement.input_lra}:measured_thresh=${measurement.input_thresh}:offset=${measurement.target_offset}:linear=true:print_format=json`
}

async function measure(file, logName) {
  const result = await ffmpeg(['-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], logName)
  const summary = result.stderr.slice(result.stderr.lastIndexOf('Summary:'))
  return { summary, lufs: Number(summary.match(/I:\s+(-?[\d.]+) LUFS/)?.[1]) }
}

async function renderTeaser(ordered) {
  let at = 0
  const cuts = teaser.map((cut) => {
    const scene = ordered.find((item) => item.id === cut.scene)
    if (!scene || cut.from + cut.duration > scene.duration + 1e-6)
      throw new Error(`Teaser cut is outside its scene: ${JSON.stringify(cut)}`)
    const entry = { ...cut, scene, at }
    at += cut.duration
    return entry
  })
  if (Math.abs(at - 10) > 1e-6) throw new Error(`Teaser cuts total ${at}s instead of 10s`)
  const score = join(work, 'teaser-score.wav')
  soundtrack(
    cuts.map(({ scene, from, duration }) => ({
      id: scene.id,
      kind: scene.kind,
      duration,
      cues: (scene.cues ?? [])
        .filter((cue) => cue.time >= from && cue.time < from + duration)
        .map((cue) => ({ ...cue, time: cue.time - from })),
    })),
    score,
  )
  const tracks = cuts.flatMap((cut) =>
    cut.scene.audioTracks
      .map((track) => {
        const lead = track.offset - cut.from
        return {
          file: track.file,
          at: cut.at + Math.max(0, lead),
          from: Math.max(0, -lead),
          duration: cut.duration - Math.max(0, lead),
        }
      })
      .filter((track) => track.duration > 0),
  )
  const mixed = join(work, 'teaser-mix.wav')
  await mix(score, tracks, mixed)
  const normalize = await loudnorm(mixed, 'teaser-loudnorm')
  const silent = join(work, 'teaser-video.mp4')
  await ffmpeg([
    ...cuts.flatMap((cut) => ['-i', cut.scene.clip]),
    '-filter_complex',
    [
      ...cuts.map((cut, index) => {
        const first = Math.round(cut.from * FPS)
        return `[${index}:v]trim=start_frame=${first}:end_frame=${first + Math.round(cut.duration * FPS)},setpts=PTS-STARTPTS[v${index}]`
      }),
      `${cuts.map((_, index) => `[v${index}]`).join('')}concat=n=${cuts.length}:v=1:a=0[v]`,
    ].join(';'),
    '-map',
    '[v]',
    '-frames:v',
    String(10 * FPS),
    '-an',
    ...encoding,
    silent,
  ])
  await ffmpeg(
    [
      '-i',
      silent,
      '-i',
      mixed,
      '-map',
      '0:v:0',
      '-map',
      '1:a:0',
      '-c:v',
      'copy',
      '-af',
      normalize,
      '-ar',
      '48000',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-t',
      '10',
      '-movflags',
      '+faststart',
      '-metadata',
      'title=Windows 95, rebuilt (teaser)',
      join(output, 'teaser.mp4'),
    ],
    'teaser-loudnorm-pass2.txt',
  )
  return cuts.map(({ scene, from, duration, at }) => ({ scene: scene.id, from, duration, at }))
}

async function compose(records, source) {
  const ordered = scenes.map((scene) => {
    const record = records.find((item) => item.id === scene.id)
    if (!record)
      throw new Error(`Missing capture for ${scene.id}. Run without --scene to capture the complete film.`)
    return record
  })
  let offset = 0
  for (const scene of ordered) {
    scene.start = offset
    scene.end = offset + scene.duration
    offset = scene.end
    await encodeScene(scene)
  }
  const concat = join(work, 'film.ffconcat')
  writeFileSync(
    concat,
    `ffconcat version 1.0\n${ordered.map((scene) => `file '${ffpath(scene.clip)}'`).join('\n')}\n`,
  )
  const score = join(work, 'soundtrack.wav')
  const scoreInfo = soundtrack(ordered, score)
  writeFileSync(join(proof, 'soundtrack.json'), `${JSON.stringify(scoreInfo, null, 2)}\n`)
  const tracks = []
  for (const scene of ordered)
    for (const track of scene.audioTracks) {
      if (!existsSync(track.file)) throw new Error(`Missing game audio ${track.file}`)
      const result = await run('ffprobe', [
        '-v',
        'error',
        '-show_format',
        '-show_streams',
        '-of',
        'json',
        track.file,
      ])
      const captured = JSON.parse(result.stdout)
      if (
        !captured.streams.some((stream) => stream.codec_type === 'audio') ||
        Number(captured.format.duration) < scene.duration - track.offset - 0.3
      )
        throw new Error(`Captured audio clock is incomplete: ${scene.id}`)
      tracks.push({ file: track.file, at: scene.start + track.offset, from: 0 })
    }
  const number = tracks.length
  const mixed = join(work, 'mix.wav')
  await mix(score, tracks, mixed)
  const normalize = await loudnorm(mixed, 'loudnorm')
  const video = join(output, 'windows95-launch.mp4')
  await ffmpeg(
    [
      '-safe',
      '0',
      '-f',
      'concat',
      '-i',
      concat,
      '-i',
      mixed,
      '-map',
      '0:v:0',
      '-map',
      '1:a:0',
      '-c:v',
      'copy',
      '-af',
      normalize,
      '-ar',
      '48000',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-t',
      String(offset),
      '-movflags',
      '+faststart',
      '-metadata',
      'title=Windows 95, rebuilt',
      '-metadata',
      `comment=Production Electron capture at ${source.head}. Original synthesized soundtrack. Solitaire near-win fixture used for cascade.`,
      video,
    ],
    'loudnorm-pass2.txt',
  )
  console.log('Encode 10-second teaser and poster')
  const teaserCuts = await renderTeaser(ordered)
  const posterScene = ordered.find((scene) => scene.id === poster.scene)
  const posterFrame = Math.round((posterScene.start + poster.at) * FPS)
  await ffmpeg([
    '-i',
    video,
    '-vf',
    `select=eq(n\\,${posterFrame})`,
    '-frames:v',
    '1',
    join(output, 'poster.png'),
  ])
  const probeResult = await run(
    'ffprobe',
    ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', video],
    'ffprobe.json',
  )
  const probe = JSON.parse(probeResult.stdout)
  const videoStream = probe.streams.find((stream) => stream.codec_type === 'video')
  const audioStream = probe.streams.find((stream) => stream.codec_type === 'audio')
  const bytes = readFileSync(video)
  const boxes = []
  for (let position = 0; position < bytes.length; ) {
    const size = bytes.readUInt32BE(position)
    boxes.push(bytes.toString('ascii', position + 4, position + 8))
    if (size < 8 || position + size > bytes.length) throw new Error('Invalid MP4 box length')
    position += size
  }
  if (!boxes.includes('moov') || !boxes.includes('mdat') || boxes.indexOf('moov') > boxes.indexOf('mdat'))
    throw new Error('MP4 is missing faststart metadata')
  if (
    videoStream.codec_name !== 'h264' ||
    videoStream.width !== 1920 ||
    videoStream.height !== 1080 ||
    videoStream.pix_fmt !== 'yuv420p' ||
    videoStream.avg_frame_rate !== '30/1' ||
    Number(videoStream.nb_frames) !== Math.round(offset * 30)
  )
    throw new Error('Output video stream failed validation')
  if (audioStream.codec_name !== 'aac' || audioStream.sample_rate !== '48000' || audioStream.channels !== 2)
    throw new Error('Output audio stream failed validation')
  if (Math.abs(Number(probe.format.duration) - offset) > 0.1)
    throw new Error('Output duration failed validation')
  const film = await measure(video, 'loudness-ebur128.txt')
  if (!Number.isFinite(film.lufs) || Math.abs(film.lufs + 14) > 0.5)
    throw new Error(`Unexpected integrated loudness: ${film.summary}`)
  await ffmpeg(['-v', 'error', '-i', video, '-f', 'null', '-'], 'decode-check.txt')
  const teaserFile = join(output, 'teaser.mp4')
  const teaserProbe = JSON.parse(
    (
      await run(
        'ffprobe',
        ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', teaserFile],
        'teaser-ffprobe.json',
      )
    ).stdout,
  )
  if (Math.abs(Number(teaserProbe.format.duration) - 10) > 0.1) throw new Error('Teaser must be 10 seconds')
  const teaserLoudness = await measure(teaserFile, 'teaser-loudness-ebur128.txt')
  if (!Number.isFinite(teaserLoudness.lufs) || Math.abs(teaserLoudness.lufs + 14) > 1)
    throw new Error(`Unexpected teaser loudness: ${teaserLoudness.summary}`)
  await ffmpeg(['-v', 'error', '-i', teaserFile, '-f', 'null', '-'], 'teaser-decode-check.txt')
  const black = await ffmpeg(
    ['-i', video, '-vf', 'blackdetect=d=0.2:pix_th=0.10', '-an', '-f', 'null', '-'],
    'blackdetect.txt',
  )
  const freeze = await ffmpeg(
    ['-i', video, '-vf', 'freezedetect=n=-60dB:d=2', '-an', '-f', 'null', '-'],
    'freezedetect.txt',
  )
  const intervals = (text, kind) =>
    [...text.matchAll(new RegExp(`${kind}_start:\\s*([\\d.]+)[\\s\\S]*?${kind}_end:\\s*([\\d.]+)`, 'g'))].map(
      (match) => [Number(match[1]), Number(match[2])],
    )
  const blackIntervals = intervals(black.stderr, 'black')
  const freezeIntervals = intervals(freeze.stderr, 'freeze')
  const secondsDir = join(proof, 'seconds', runId)
  mkdirSync(secondsDir, { recursive: true })
  await ffmpeg(['-i', video, '-vf', 'fps=1,scale=480:270:flags=neighbor', join(secondsDir, '%03d.png')])
  const seconds = readdirSync(secondsDir)
    .filter((file) => file.endsWith('.png'))
    .sort()
    .map((file) => join(secondsDir, file))
  if (seconds.length < Math.floor(offset)) throw new Error('The contact sheet is missing seconds')
  await captureCards(root, work, proof, log, null, seconds)
  const shotLabel = (view) => (view.scale === 2 ? `2x at ${view.x},${view.y}` : '1:1 full')
  const metrics = {
    source,
    duration: Number(probe.format.duration),
    frames: Number(videoStream.nb_frames),
    resolution: [1920, 1080],
    fps: '30/1',
    videoCodec: 'h264',
    pixelFormat: 'yuv420p',
    audioCodec: 'aac',
    audioSampleRate: 48000,
    audioChannels: 2,
    mp4Boxes: boxes,
    integratedLufs: film.lufs,
    loudnessSummary: film.summary,
    teaser: { file: teaserFile, cuts: teaserCuts, integratedLufs: teaserLoudness.lufs },
    poster: { file: join(output, 'poster.png'), ...poster, frame: posterFrame },
    blackIntervals,
    freezeIntervals,
    gameAudioTracks: number,
    contactSheetFrames: seconds.length,
    soundtrack: scoreInfo,
    scenes: ordered.map(({ id, title, start, end, fixture, frames, audioTracks, shots, framing }) => ({
      id,
      title,
      start,
      end,
      fixture,
      frames,
      audioTracks,
      shots: shots?.map(({ from, to, view }) => ({ start: start + from / FPS, end: start + to / FPS, view })),
      framing,
    })),
    output: video,
  }
  writeFileSync(join(proof, 'metrics.json'), `${JSON.stringify(metrics, null, 2)}\n`)
  const lines = [
    '# Launch video render',
    '',
    `Production Electron source ${source.head} on branch \`${source.branch}\`${source.dirty ? ' with uncommitted changes' : ''}.`,
    '',
    `The film is ${offset.toFixed(1)} seconds at 1920x1080 and 30 fps. Full shots keep the 1024x768 app at 1:1, centered at 448,156 on black. Close-ups crop 960x540 app pixels and scale them by exactly 2 with nearest-neighbor sampling.`,
    '',
    '| Start | End | Scene | Shots |',
    '| --- | --- | --- | --- |',
    ...ordered.map(
      (scene) =>
        `| ${stamp(scene.start)} | ${stamp(scene.end)} | ${scene.title} | ${
          scene.shots
            ? scene.shots
                .map((shot) => `${stamp(scene.start + shot.from / FPS)} ${shotLabel(shot.view)}`)
                .join(', ')
            : 'title card'
        } |`,
    ),
    '',
    'Each close-up asserts that its UI is fully inside the crop at capture time.',
    '',
    '| Scene | Assertion | Shot |',
    '| --- | --- | --- |',
    ...ordered.flatMap((scene) =>
      (scene.framing ?? []).map((check) => `| ${scene.id} | ${check.name} | ${shotLabel(check.shot)} |`),
    ),
    '',
    `Output \`${video}\`. Teaser \`${teaserFile}\`. Poster \`${join(output, 'poster.png')}\`, frame ${posterFrame} from the ${poster.scene} scene.`,
    '',
    `ffprobe reports H.264, yuv420p, ${videoStream.nb_frames} video frames, AAC stereo at 48000 Hz, and ${probe.format.duration} seconds. Full output is in [ffprobe.json](ffprobe.json).`,
    '',
    `The encoded MP4 measures ${film.lufs.toFixed(1)} LUFS integrated. The ffmpeg ebur128 summary follows.`,
    '',
    '```text',
    film.summary.trim(),
    '```',
    '',
    `The teaser is a 10-second montage of ${teaserCuts.length} beat-length cuts with its own score cue. It measures ${teaserLoudness.lufs.toFixed(1)} LUFS integrated.`,
    '',
    '| Teaser | Scene | Scene offset | Length |',
    '| --- | --- | --- | --- |',
    ...teaserCuts.map(
      (cut) => `| ${stamp(cut.at)} | ${cut.scene} | ${cut.from.toFixed(1)}s | ${cut.duration.toFixed(1)}s |`,
    ),
    '',
    `blackdetect found ${blackIntervals.length ? blackIntervals.map(([a, b]) => `${a.toFixed(2)}s to ${b.toFixed(2)}s`).join(', ') : 'no intervals'}. freezedetect (2 s, -60 dB) found ${freezeIntervals.length ? freezeIntervals.map(([a, b]) => `${a.toFixed(2)}s to ${b.toFixed(2)}s`).join(', ') : 'no intervals'}. See [blackdetect.txt](blackdetect.txt) and [freezedetect.txt](freezedetect.txt).`,
    '',
    `The score is an original deterministic 100 BPM synth composition with pads that cross-fade between chords. ${number} game WebAudio tracks were captured through MediaRecorder and mixed at their scene offsets. Sampled-audio decoding and HTML media playback were disabled to exclude Microsoft system WAVs, including their WebAudio path. A zero-valued constant source keeps each recorder clock continuous. Clicks, typing, the boot chime, and the mine cue use original synthesized stand-ins.`,
    '',
    '[Contact sheet](contact-sheet.png) contains one decoded frame per second. Full thumbnails live in the seconds folder. [Metrics](metrics.json) and [decode check](decode-check.txt) describe the actual final file.',
    '',
    'The Solitaire cascade uses the existing proofDeal("win") fixture. The pipeline strips TypeScript types from that fixture in Node and dispatches it to the production component game hook before recording. The final double-click and cascade are real production UI. This is not evidence of solving a random deal.',
    '',
    'The Minesweeper driver reads the new game seed from the production component and replays the app engine in Node to choose a first click that opens a wide area. The clicks themselves are trusted input on the real board.',
    '',
    'The shutdown clip captures the safe-to-turn-off screen before Electron exits and holds its last captured frame to finish the film.',
    '',
    `Run \`node scripts/video/render.mjs\` on the final integration commit for a fresh build, a fresh Electron data directory, a full capture, and a complete encode. This render starts at ${source.head}. Later app, shell, icon, or card-art changes alter the footage. Selectors and framing checks fail on missing or oversized UI rather than silently omit a scene.`,
    '',
  ]
  writeFileSync(join(proof, 'render-report.md'), `${lines.join('\n')}\n`)
  console.log(
    `PASS ${offset.toFixed(1)}s, ${videoStream.nb_frames} frames, ${film.lufs.toFixed(1)} LUFS, teaser ${teaserLoudness.lufs.toFixed(1)} LUFS, ${number} original game-audio tracks`,
  )
}

try {
  await run('ffmpeg', ['-version'])
  await run('ffprobe', ['-version'])
  const sceneArg = process.argv.indexOf('--scene')
  const only = sceneArg === -1 ? undefined : process.argv[sceneArg + 1]
  if (only && !scenes.some((scene) => scene.id === only && scene.kind !== 'card'))
    throw new Error(`Unknown footage scene ${only}`)
  if (process.argv.includes('--skip-build') && !only)
    throw new Error('--skip-build is only for single-scene rehearsals')
  if (!process.argv.includes('--skip-build')) {
    console.log('Build production Electron renderer')
    await run(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'pnpm build'], 'build.txt')
  }
  const head = (await run('git', ['rev-parse', 'HEAD'])).stdout.trim()
  const branch = (await run('git', ['branch', '--show-current'])).stdout.trim()
  const dirty = (await run('git', ['status', '--porcelain'])).stdout.trim() !== ''
  const source = { head, branch, dirty, capturedAt: new Date().toISOString() }
  let records
  if (process.argv.includes('--reuse-capture')) {
    const saved = JSON.parse(readFileSync(join(output, 'capture.json'), 'utf8'))
    records = saved.records.filter((scene) => scene.kind !== 'card')
    Object.assign(source, saved.source)
  } else {
    records = await capture(root, work, proof, log, only)
    writeFileSync(
      join(only ? work : output, 'capture.json'),
      `${JSON.stringify({ source, records }, null, 2)}\n`,
    )
  }
  if (only) {
    if (!process.argv.includes('--capture-only')) {
      await encodeScene(records[0])
      console.log(`Rehearsal clip ${records[0].clip}`)
    }
  } else if (!process.argv.includes('--capture-only')) {
    await captureCards(root, work, proof, log, records)
    await compose(records, source)
  }
} catch (error) {
  writeFileSync(join(proof, 'last-failure.txt'), `${error.stack}\n`)
  console.error(error.stack)
  process.exitCode = 1
} finally {
  writeFileSync(join(work, 'commands.json'), `${JSON.stringify(commands, null, 2)}\n`)
  log.end()
}
