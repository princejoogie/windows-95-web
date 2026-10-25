import { spawn } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { capture, captureCards } from './capture.mjs'
import { scenes } from './scenes.mjs'
import { soundtrack } from './soundtrack.mjs'

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const output = join(root, 'release/video')
const proof = resolve(process.env.W95_VIDEO_PROOF_DIR ?? 'D:/codes/worktrees/windows-95-web/proof/video')
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
    scene.clip = join(work, `${scene.id}.mp4`)
    console.log(`Encode ${scene.id}`)
    if (scene.kind === 'card') {
      await ffmpeg([
        '-framerate',
        '30',
        '-i',
        join(scene.folder, '%06d.png'),
        '-frames:v',
        String(Math.round(scene.duration * 30)),
        '-an',
        ...encoding,
        scene.clip,
      ])
    } else {
      const initial = readFileSync(join(scene.folder, 'initial.png'))
      if (initial.readUInt32BE(16) !== 1024 || initial.readUInt32BE(20) !== 768)
        throw new Error(`Capture is not native 1024x768: ${scene.id}`)
      const backdrop = scene.backdrop === 'black' ? 'black' : '0x008080'
      await ffmpeg([
        '-safe',
        '0',
        '-f',
        'concat',
        '-i',
        join(scene.folder, 'frames.ffconcat'),
        '-vf',
        `fps=30,pad=1920:1080:448:156:${backdrop},tpad=stop_mode=clone:stop_duration=5`,
        '-frames:v',
        String(Math.round(scene.duration * 30)),
        '-an',
        ...encoding,
        scene.clip,
      ])
    }
  }
  const concat = join(work, 'film.ffconcat')
  writeFileSync(
    concat,
    `ffconcat version 1.0\n${ordered.map((scene) => `file '${ffpath(scene.clip)}'`).join('\n')}\n`,
  )
  const score = join(work, 'soundtrack.wav')
  const scoreInfo = soundtrack(ordered, score)
  writeFileSync(join(proof, 'soundtrack.json'), `${JSON.stringify(scoreInfo, null, 2)}\n`)
  const audioInputs = ['-i', score]
  const audioFilters = []
  const labels = ['[0:a]']
  let number = 0
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
      number++
      audioInputs.push('-i', track.file)
      const delay = Math.round((scene.start + track.offset) * 1000)
      audioFilters.push(
        `[${number}:a]aresample=48000,asetpts=PTS-STARTPTS,adelay=${delay}:all=1,volume=0.55[a${number}]`,
      )
      labels.push(`[a${number}]`)
    }
  const mixed = join(work, 'mix.wav')
  await ffmpeg([
    ...audioInputs,
    '-filter_complex',
    `${audioFilters.map((filter) => `${filter};`).join('')}${labels.join('')}amix=inputs=${labels.length}:duration=first:normalize=0,alimiter=limit=0.95:level=false[mix]`,
    '-map',
    '[mix]',
    '-ar',
    '48000',
    '-c:a',
    'pcm_s24le',
    mixed,
  ])
  const first = await ffmpeg(
    ['-i', mixed, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=9:print_format=json', '-f', 'null', '-'],
    'loudnorm-pass1.txt',
  )
  const measurement = JSON.parse(first.stderr.match(/\{\s*"input_i"\s*:[\s\S]*?\}/)?.[0] ?? 'null')
  if (!measurement) throw new Error('ffmpeg did not return loudnorm measurements')
  const normalize = `loudnorm=I=-14:TP=-1.5:LRA=9:measured_I=${measurement.input_i}:measured_TP=${measurement.input_tp}:measured_LRA=${measurement.input_lra}:measured_thresh=${measurement.input_thresh}:offset=${measurement.target_offset}:linear=true:print_format=json`
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
  await ffmpeg([
    '-ss',
    '30',
    '-i',
    video,
    '-t',
    '10',
    '-map',
    '0:v:0',
    '-map',
    '0:a:0',
    ...encoding,
    '-af',
    'afade=t=in:d=0.15,afade=t=out:st=9.5:d=0.5',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-movflags',
    '+faststart',
    join(output, 'teaser.mp4'),
  ])
  await ffmpeg(['-ss', '10.8', '-i', video, '-frames:v', '1', join(output, 'poster.png')])
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
  const loudnessResult = await ffmpeg(
    ['-i', video, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
    'loudness-ebur128.txt',
  )
  const summary = loudnessResult.stderr.slice(loudnessResult.stderr.lastIndexOf('Summary:'))
  const lufs = Number(summary.match(/I:\s+(-?[\d.]+) LUFS/)?.[1])
  if (!Number.isFinite(lufs) || Math.abs(lufs + 14) > 0.5)
    throw new Error(`Unexpected integrated loudness: ${summary}`)
  await ffmpeg(['-v', 'error', '-i', video, '-f', 'null', '-'], 'decode-check.txt')
  const teaserProbe = await run(
    'ffprobe',
    ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', join(output, 'teaser.mp4')],
    'teaser-ffprobe.json',
  )
  if (Math.abs(Number(JSON.parse(teaserProbe.stdout).format.duration) - 10) > 0.1)
    throw new Error('Teaser must be 10 seconds')
  const secondsDir = join(proof, 'seconds', runId)
  mkdirSync(secondsDir, { recursive: true })
  await ffmpeg(['-i', video, '-vf', 'fps=1,scale=480:270:flags=neighbor', join(secondsDir, '%03d.png')])
  const seconds = readdirSync(secondsDir)
    .filter((file) => file.endsWith('.png'))
    .sort()
    .map((file) => join(secondsDir, file))
  if (seconds.length < Math.floor(offset)) throw new Error('The contact sheet is missing seconds')
  await captureCards(root, work, proof, log, null, seconds)
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
    integratedLufs: lufs,
    loudnessSummary: summary,
    gameAudioTracks: number,
    contactSheetFrames: seconds.length,
    soundtrack: scoreInfo,
    scenes: ordered.map(({ id, title, start, end, fixture, frames, audioTracks }) => ({
      id,
      title,
      start,
      end,
      fixture,
      frames,
      audioTracks,
    })),
    output: video,
  }
  writeFileSync(join(proof, 'metrics.json'), `${JSON.stringify(metrics, null, 2)}\n`)
  const lines = [
    '# Launch video draft',
    '',
    `Production Electron source ${source.head} on branch \`${source.branch}\`.`,
    '',
    `The film is ${offset.toFixed(1)} seconds at 1920x1080 and 30 fps. The app stays at native 1024x768, centered at 448,156 without scaling.`,
    '',
    '| Start | End | Scene |',
    '| --- | --- | --- |',
    ...ordered.map((scene) => `| ${stamp(scene.start)} | ${stamp(scene.end)} | ${scene.title} |`),
    '',
    `Output \`${video}\`. Teaser \`${join(output, 'teaser.mp4')}\`. Poster \`${join(output, 'poster.png')}\`.`,
    '',
    `ffprobe reports H.264, yuv420p, ${videoStream.nb_frames} video frames, AAC stereo at 48000 Hz, and ${probe.format.duration} seconds. Full output is in [ffprobe.json](ffprobe.json).`,
    '',
    `The encoded MP4 measures ${lufs.toFixed(1)} LUFS integrated. The ffmpeg ebur128 summary follows.`,
    '',
    '```text',
    summary.trim(),
    '```',
    '',
    `The score is an original deterministic 100 BPM synth composition. ${number} game WebAudio tracks were captured through MediaRecorder and mixed at their scene offsets. Sampled-audio decoding and HTML media playback were disabled to exclude Microsoft system WAVs, including their WebAudio path. A zero-valued constant source keeps each recorder clock continuous. Clicks, typing, startup, and the mine cue use original synthesized stand-ins.`,
    '',
    '[Contact sheet](contact-sheet.png) contains one decoded frame per second. Full thumbnails live in the seconds folder. [Metrics](metrics.json) and [decode check](decode-check.txt) describe the actual final file.',
    '',
    'The Solitaire cascade uses the existing proofDeal("win") fixture. The pipeline strips TypeScript types from that fixture in Node and dispatches it to the production component game hook before recording. The final double-click and cascade are real production UI. This is not evidence of solving a random deal.',
    '',
    'The shutdown clip captures the safe-to-turn-off screen before Electron exits and holds its last captured frame to finish the film.',
    '',
    `Run \`node scripts/video/render.mjs\` on the final integration commit for a fresh build, a fresh Electron data directory, a full capture, and a complete encode. The current draft starts at ${source.head}. Later card artwork, menus, app fidelity, icons, and shell audit fixes can change the footage. Selectors deliberately fail on missing UI rather than silently omit a scene.`,
    '',
    'The rerunnable pipeline is the Build the Lever choice. The scene registry is the Model the Domain choice. Production capture, decoded contact frames, ffprobe, and ebur128 implement Prove It Works.',
    '',
    'Throughput checkpoint. Build and CDP are the first gates. Capture, cards, and sound have separate modules. One render process owns each timestamped output directory. This worker owns all implementation because the brief forbids subagents.',
    '',
    'Delegated design, review, and cross-model trail review were skipped under the explicit no-subagents instruction. No push or PR was attempted under the offline brief.',
    '',
  ]
  writeFileSync(join(proof, 'render-report.md'), `${lines.join('\n')}\n`)
  console.log(
    `PASS ${offset.toFixed(1)}s, ${videoStream.nb_frames} frames, ${lufs.toFixed(1)} LUFS, ${number} original game-audio tracks`,
  )
}

try {
  await run('ffmpeg', ['-version'])
  await run('ffprobe', ['-version'])
  console.log('Build production Electron renderer')
  await run(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'pnpm build'], 'build.txt')
  const head = (await run('git', ['rev-parse', 'HEAD'])).stdout.trim()
  const branch = (await run('git', ['branch', '--show-current'])).stdout.trim()
  const source = { head, branch, capturedAt: new Date().toISOString() }
  const sceneArg = process.argv.indexOf('--scene')
  const only = sceneArg === -1 ? undefined : process.argv[sceneArg + 1]
  if (only && !scenes.some((scene) => scene.id === only && scene.kind !== 'card'))
    throw new Error(`Unknown footage scene ${only}`)
  let records
  if (process.argv.includes('--reuse-capture')) {
    const saved = JSON.parse(readFileSync(join(output, 'capture.json'), 'utf8'))
    records = saved.records.filter((scene) => scene.kind !== 'card')
    Object.assign(source, saved.source)
  } else {
    records = await capture(root, work, proof, log, only)
    writeFileSync(join(output, 'capture.json'), `${JSON.stringify({ source, records }, null, 2)}\n`)
  }
  if (!process.argv.includes('--capture-only')) {
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
