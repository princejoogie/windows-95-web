# Render the launch video

Run this command from the checkout you want to film. It uses the production Electron build, a fresh data directory, and the installed ffmpeg and ffprobe. Node 24 or later is required. No network or extra package is needed.

```powershell
node scripts/video/render.mjs
```

The command builds the app, drives every footage scene over CDP, captures four title cards in a separate hidden Electron window, synthesizes the score, mixes recorded game audio, and encodes the outputs. It then checks the encoded files and writes the report and contact sheet. Footage combines CDP screencast frames with production screenshots every 200 ms, which refresh the compositor during static scenes. A screenshot is dropped when a newer screencast frame arrived while it was taken.

The outputs are in `release/video/`, which the existing repository rules ignore.

- `windows95-launch.mp4` is the full film with H.264 video and AAC sound.
- `teaser.mp4` is a 10-second montage of beat-length highlights with its own score cue.
- `poster.png` is the frame named by `poster` in `scenes.mjs`.
- `capture.json` identifies the recorded source commit and raw footage.
- `work/<timestamp>/` retains frames, captured WebAudio, the score WAVs, clips, command logs, and intermediate mixes.

Proof defaults to `D:/codes/worktrees/windows-95-web/proof/video-opus55/`. Set `W95_VIDEO_PROOF_DIR` to change it. The report is `render-report.md`. `metrics.json`, `ffprobe.json`, `loudness-ebur128.txt`, `teaser-ffprobe.json`, `teaser-loudness-ebur128.txt`, `blackdetect.txt`, `freezedetect.txt`, and the decode checks record the output checks. `contact-sheet.png` has one decoded frame per second. The `seconds/` folder retains the larger thumbnails.

## Camera

Each footage scene records a camera timeline beside its frames. `camera.mjs` owns the framing math.

- A full shot keeps the 1024x768 app at 1:1, centered at 448,156 on black.
- A close-up crops 960x540 app pixels and scales them by exactly 2 with nearest-neighbor sampling. Every app pixel becomes a 2x2 block, which also lines up with 4:2:0 chroma.

A scene sets its opening shot with `camera`: `'full'`, `'center'`, a selector or list of selectors, or an app-pixel rectangle. Selectors resolve to their bounding box when the shot starts. A close-up refuses any target larger than 960x540 or outside the app. Inside `action`, `c.camera(target)` cuts at that moment. `c.cutWhen(condition, target)` cuts on a screen change: call it before the input that causes the change, and the cut lands on the first captured frame whose compositor timestamp follows the page's animation frame. `c.framed(selectors, name)` asserts that UI is fully inside the current shot and records the result in the report.

During recording, the pointer glides between targets and drags follow interpolated paths, so Paint shows its rubber-band lines. Setup steps still move instantly. The overlay draws original pixel cursors that follow the app's computed CSS cursor: the arrow, the crosshair over the Paint canvas, the text beam, and nothing over other canvases such as Doom, screen savers, and the power screens. Screencasts omit the host cursor, which is why the overlay exists.

## Rehearse

```powershell
node scripts/video/render.mjs --scene paint
node scripts/video/render.mjs --scene paint --skip-build
node scripts/video/render.mjs --capture-only
node scripts/video/render.mjs --reuse-capture
```

`--scene` captures one footage scene and encodes its camera clip in the work folder. `--skip-build` reuses the current `out/` build and only works with `--scene`. A single-scene run never replaces `release/video/capture.json`. `--reuse-capture` re-encodes the last full capture and retains its source commit.

CDP starts at port 9440 for footage and 9441 for title cards. When a port is occupied, the script tries the next ports in steps of two. It checks the exact file URL before it sends input and stops only processes it launched. `W95_VIDEO_CDP_PORT` and `W95_VIDEO_CARDS_PORT` change the preferred ports. `ELECTRON_RUN_AS_NODE` and `ELECTRON_RENDERER_URL` are cleared for child Electron processes.

## Scenes and sound

Edit the ordered scene registry in `scenes.mjs` to change the film. Durations are multiples of two beats at 100 BPM. The teaser cuts and the poster frame live beside it. Titles use the app's local bitmap font and 16-color palette. Transitions are cuts plus a short caption-style outline zoom on the title cards.

The Solitaire win scene loads `proofDeal('win')` from the existing fixture source into the production component's state hook before recording. A trusted double-click sends the last King home and starts the real cascade. The Minesweeper scene reads the fresh game's seed from the production component and replays the app's own engine in Node to choose a first click that opens a wide area. No app source or production build is patched. A changed React state layout or fixture contract makes these steps fail for review.

The audio hook records connections to WebAudio destinations through MediaRecorder. It disables sampled-audio decoding and HTML media playback to exclude the Microsoft system WAVs, including their WebAudio playback path. A zero-valued constant source keeps each recording clock continuous between game sounds. The soundtrack script synthesizes every score note and replacement UI cue from oscillators and seeded noise. Pads cross-fade between chords at scene changes. ffmpeg normalizes each mix in two passes and measures the encoded files with ebur128. The target is -14 LUFS integrated and -1.5 dBTP.

The final shot records the safe-to-turn-off message before Electron exits. The encode holds that last captured frame through the end of the film. The repo-name card comes before shutdown so the final image remains the requested message.
