import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { connect, wait } from './cdp.mjs'
import { scenes } from './scenes.mjs'

async function availablePort(preferred) {
  if (!Number.isInteger(preferred) || preferred < 1024 || preferred > 65535)
    throw new Error(`Invalid CDP port ${preferred}`)
  for (let port = preferred; port <= Math.min(preferred + 20, 65535); port += 2) {
    const free = await new Promise((resolve, reject) => {
      const server = createServer()
      server.once('error', (error) => (error.code === 'EADDRINUSE' ? resolve(false) : reject(error)))
      server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)))
    })
    if (free) {
      console.log(`Use CDP port ${port}${port !== preferred ? ` (${preferred} is occupied)` : ''}`)
      return port
    }
  }
  throw new Error(`No free CDP port near ${preferred}`)
}

export function launchElectron(root, entry, dataDir, port, log) {
  const env = {
    ...process.env,
    W95_DATA_DIR: dataDir,
    W95_CDP_PORT: String(port),
    W95_VIDEO_CARDS_PORT: String(port),
  }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_RENDERER_URL
  const executable = join(root, 'node_modules/electron/dist/electron.exe')
  const processHandle = spawn(executable, [entry, '--force-device-scale-factor=1'], {
    cwd: root,
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  processHandle.stdout.on('data', (data) => log.write(data))
  processHandle.stderr.on('data', (data) => log.write(data))
  return processHandle
}

export async function stopElectron(child) {
  if (!child || child.exitCode !== null) return
  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    })
    await new Promise((resolve) => killer.on('close', resolve))
  } else child.kill()
}

async function record(c, scene, folder, proof) {
  mkdirSync(folder, { recursive: true })
  const frames = []
  const cues = []
  const errors = []
  const duration = scene.captureDuration ?? scene.duration
  await c.shot(join(folder, 'initial.png'))
  frames.push({ file: 'initial.png', time: 0 })
  await c.eval('window.__videoAudio.start()')
  const start = performance.now()
  const saveFrame = (data, source, sourceTimestamp) => {
    const time = (performance.now() - start) / 1000
    const file = `${String(frames.length).padStart(6, '0')}.png`
    writeFileSync(join(folder, file), Buffer.from(data, 'base64'))
    frames.push({ file, time, source, sourceTimestamp })
  }
  const remove = c.on('Page.screencastFrame', (event) => {
    saveFrame(event.data, 'screencast', event.metadata.timestamp)
    c.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch((error) =>
      errors.push(error.message),
    )
  })
  c.cue = (kind) => cues.push({ kind, time: (performance.now() - start) / 1000 })
  c.checkpoint = (name) => c.shot(join(proof, `${scene.id}-${name}.png`))
  let sampling = true
  let sampler
  try {
    await c.send('Page.startScreencast', { format: 'png', maxWidth: 1024, maxHeight: 768, everyNthFrame: 1 })
    sampler = (async () => {
      while (sampling) {
        const result = await c.send('Page.captureScreenshot', { format: 'png' })
        if (sampling) saveFrame(result.data, 'screenshot')
        await wait(200)
      }
    })().catch((error) => errors.push(error.message))
    await scene.action(c)
    const remaining = duration * 1000 - (performance.now() - start)
    if (remaining < -150)
      throw new Error(
        `${scene.id} actions overrun the ${duration}s capture by ${(-remaining / 1000).toFixed(2)}s`,
      )
    await wait(Math.max(0, remaining))
    sampling = false
    await sampler
    await c.send('Page.stopScreencast')
    remove()
    const audio = await c.eval('window.__videoAudio.stop()')
    const audioTracks = audio.map((track, index) => {
      const file = join(folder, `game-audio-${index}.webm`)
      writeFileSync(file, Buffer.from(track.data, 'base64'))
      return { file, offset: track.offset }
    })
    await c.shot(join(proof, `${scene.id}.png`))
    if (errors.length) throw new Error(errors.join('\n'))
    const timeline = frames.filter((frame) => frame.time < duration)
    const concat = ['ffconcat version 1.0']
    for (let i = 0; i < timeline.length; i++) {
      concat.push(
        `file '${timeline[i].file}'`,
        'option framerate 1000',
        `duration ${Math.max(0.001, (timeline[i + 1]?.time ?? scene.duration) - timeline[i].time).toFixed(6)}`,
      )
    }
    concat.push(`file '${timeline.at(-1).file}'`)
    writeFileSync(join(folder, 'frames.ffconcat'), `${concat.join('\n')}\n`)
    writeFileSync(
      join(folder, 'frames.json'),
      `${JSON.stringify({ duration, frames: timeline, cues, audioTracks }, null, 2)}\n`,
    )
    return { ...scene, folder, frames: timeline.length, audioTracks, cues }
  } finally {
    sampling = false
    await sampler
    c.cue = () => {}
    c.checkpoint = () => {}
    remove()
  }
}

export async function capture(root, work, proof, log, only) {
  const port = await availablePort(Number(process.env.W95_VIDEO_CDP_PORT ?? 9440))
  const child = launchElectron(root, '.', join(work, 'app-profile'), port, log)
  let c
  try {
    c = await connect(port)
    if (c.url.toLowerCase() !== pathToFileURL(join(root, 'out/renderer/index.html')).href.toLowerCase())
      throw new Error(`Capture requires the production Electron renderer: ${c.url}`)
    await c.send('Page.enable')
    await c.send('Runtime.enable')
    await c.send('Emulation.setDeviceMetricsOverride', {
      width: 1024,
      height: 768,
      deviceScaleFactor: 1,
      mobile: false,
    })
    await c.send('Page.addScriptToEvaluateOnNewDocument', {
      source: readFileSync(join(root, 'scripts/video/browser-hooks.js'), 'utf8'),
    })
    const exceptions = []
    c.on('Runtime.exceptionThrown', (event) => exceptions.push(event.exceptionDetails))
    const results = []
    for (const scene of scenes.filter((item) => item.kind !== 'card' && (!only || item.id === only))) {
      console.log(`Capture ${scene.id} (${scene.duration}s)`)
      await scene.setup(c, root)
      const geometry = await c.eval(
        '({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,url:location.href})',
      )
      if (geometry.width !== 1024 || geometry.height !== 768 || geometry.dpr !== 1)
        throw new Error(`Wrong capture geometry: ${JSON.stringify(geometry)}`)
      await c.move(930, 690)
      results.push({ ...(await record(c, scene, join(work, scene.id), proof)), cdpPort: port })
      writeFileSync(
        join(work, 'capture.json'),
        `${JSON.stringify({ scenes: results, exceptions }, null, 2)}\n`,
      )
    }
    if (exceptions.length) throw new Error(`Renderer exceptions: ${JSON.stringify(exceptions)}`)
    return results
  } catch (error) {
    if (c) await c.shot(join(proof, 'capture-failure.png')).catch(() => {})
    throw error
  } finally {
    c?.close()
    await stopElectron(child)
  }
}

export async function captureCards(root, work, proof, log, records, seconds) {
  const port = await availablePort(Number(process.env.W95_VIDEO_CARDS_PORT ?? 9441))
  const child = launchElectron(
    root,
    join(root, 'scripts/video/cards.cjs'),
    join(work, 'cards-profile'),
    port,
    log,
  )
  let c
  try {
    c = await connect(port)
    if (c.url.toLowerCase() !== pathToFileURL(join(root, 'scripts/video/title.html')).href.toLowerCase())
      throw new Error(`Wrong title-card page: ${c.url}`)
    await c.send('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false,
    })
    await c.until('!!window.drawCard')
    if (records) {
      for (const scene of scenes.filter((item) => item.kind === 'card')) {
        console.log(`Capture title ${scene.id}`)
        const folder = join(work, scene.id)
        mkdirSync(folder, { recursive: true })
        const count = Math.round(scene.duration * 30)
        for (let frame = 0; frame < count; frame++) {
          await c.eval(
            `window.drawCard(${JSON.stringify(scene.title)}, ${JSON.stringify(scene.subtitle)}, ${frame})`,
          )
          await c.eval(
            `window.videoCapture(${JSON.stringify(join(folder, `${String(frame).padStart(6, '0')}.png`))}, 1920, 1080)`,
          )
        }
        records.push({ ...scene, folder, frames: count, cues: [], audioTracks: [] })
      }
    }
    if (seconds) {
      const images = seconds.map((file) => pathToFileURL(file).href)
      const height = await c.eval(`window.drawContactSheet(${JSON.stringify(images)})`)
      await c.send('Emulation.setDeviceMetricsOverride', {
        width: 1920,
        height,
        deviceScaleFactor: 1,
        mobile: false,
      })
      await c.eval(
        `window.videoCapture(${JSON.stringify(join(proof, 'contact-sheet.png'))}, 1920, ${height})`,
      )
    }
  } finally {
    c?.close()
    await stopElectron(child)
  }
}
