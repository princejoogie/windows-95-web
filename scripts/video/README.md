# Render the launch video

Run this command from the checkout you want to film. It uses the production Electron build, a fresh data directory, and the installed ffmpeg and ffprobe. Node 24 or later is required. No network or extra package is needed.

```powershell
node scripts/video/render.mjs
```

The command builds the app, drives every footage scene over CDP, captures four title cards in a separate hidden Electron window, synthesizes the score, mixes recorded game audio, and encodes the outputs. It then checks the encoded file and writes the report and contact sheet.

The outputs are in `release/video/`, which the existing repository rules ignore.

- `windows95-launch.mp4` is the full draft with H.264 video and AAC sound.
- `teaser.mp4` is a 10-second excerpt.
- `poster.png` is a frame of the Start menu cascade.
- `capture.json` identifies the recorded source commit and raw footage.
- `work/<timestamp>/` retains frames, captured WebAudio, the original score WAV, clips, command logs, and intermediate mixes.

Proof defaults to `D:/codes/worktrees/windows-95-web/proof/video/`. Set `W95_VIDEO_PROOF_DIR` to change it. The report is `render-report.md`. `metrics.json`, `ffprobe.json`, `loudness-ebur128.txt`, `teaser-ffprobe.json`, and `decode-check.txt` record the output checks. `contact-sheet.png` has one decoded frame per second. The `seconds/` folder retains the larger thumbnails.

CDP starts at port 9440 for footage and 9441 for title cards. When a port is occupied, the script tries the next ports in steps of two. It checks the exact file URL before it sends input and stops only processes it launched. `W95_VIDEO_CDP_PORT` and `W95_VIDEO_CARDS_PORT` change the preferred ports. `ELECTRON_RUN_AS_NODE` and `ELECTRON_RENDERER_URL` are cleared for child Electron processes.

Use these commands to rehearse one scene or re-encode an existing capture.

```powershell
node scripts/video/render.mjs --capture-only --scene paint
node scripts/video/render.mjs --capture-only
node scripts/video/render.mjs --reuse-capture
```

A single-scene rehearsal cannot produce the full film. Run the default command on the final integration commit to film later app fixes. `--reuse-capture` retains the original capture commit in its report.

Edit the ordered scene registry in `scenes.mjs` to change the film. Durations are multiples of two beats at 100 BPM. App pixels remain at 1:1 in a 1024x768 frame centered within 1920x1080. Titles use the app's local bitmap font and 16-color palette. Transitions use cuts and a short caption-style outline zoom.

The Solitaire win scene loads `proofDeal('win')` from the existing fixture source into the production component's state hook before recording. A trusted double-click sends the last King home and starts the real cascade. No app source or production build is patched. A changed React state layout or fixture contract makes this step fail for review.

The audio hook records connections to WebAudio destinations through MediaRecorder. It disables sampled-audio decoding and HTML media playback to exclude the Microsoft system WAVs, including their WebAudio playback path. A zero-valued constant source keeps each recording clock continuous between game sounds. The soundtrack script synthesizes every score note and replacement UI cue from oscillators and seeded noise. ffmpeg normalizes the mix in two passes and measures the encoded MP4 with ebur128. The target is -14 LUFS integrated and -1.5 dBTP.

The final shot records the safe-to-turn-off message before Electron exits. The encode holds that last captured frame through the end of the film. The repo-name card comes before shutdown so the final image remains the requested message.
