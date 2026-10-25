# System assets

The importer reads the local Windows installation. It generates fonts, cursor files, sound files, and `assets/system/assets.css`. Only the importer and the output folder's `.gitignore` belong in Git. Do not distribute the generated Microsoft assets.

The package scripts run the importer before installation finishes, development starts, or either build starts. `W95_SYSTEM_ROOT` overrides the Windows directory. A missing installation produces an empty asset stylesheet. The renderer then uses `micross.ttf`, CSS cursors, and silence.

## Fonts

The default UI uses `MS Sans Serif Bitmap` at 11px. Its normal and bold faces preserve the FNT metrics. Bold adds one pixel to each glyph's advance. The imported 10pt and 12pt families are `MS Sans Serif Bitmap 10pt` at 13px and `MS Sans Serif Bitmap 12pt` at 16px.

The `font-mono` class uses `Fixedsys Bitmap` at its native 12px size and 15px cell height. Without that font it keeps the existing 13px fallback size and 16px line height.

Electron enables Blink's `NoFontAntialiasing` feature before creating a window. Plain browsers control their own text antialiasing.

## Cursors

The global stylesheet applies the imported arrow and text cursor. It also handles the existing resize handles. The importer reads each cursor's hotspot from its 32px CUR directory entry.

Use `cursorClassNames` from `./cursors` on elements that need a system cursor. A stylesheet cursor resolves its asset URL relative to the generated stylesheet. Assigning the same CSS variable to an inline cursor resolves the URL relative to the document and loses the `assets` directory in packaged builds.

`cursorClassNames` provides matching classes for busy, wait, move, no, help, and the four resize directions. The stylesheet also defines the CSS variables `--cursor-default`, `--cursor-progress`, `--cursor-wait`, `--cursor-text`, `--cursor-move`, `--cursor-not-allowed`, `--cursor-help`, and `--cursor-<direction>-resize`.

Window edges, corners, and the taskbar sizing edge use these classes. No copies of cursor assets belong beside `index.html`.

## Sounds

Import `playSound` from `./sound`. The accepted names are `tada`, `chord`, `ding`, `chimes`, `notify`, and `recycle`.

`void playSound('chord')` starts playback. The promise resolves to `{ duration, sampleRate, channels }` after playback starts, or `null` when audio is unavailable. The module caches decoded WebAudio buffers. Missing files, failed decodes, and locked audio return silence. A locked resume attempt waits at most 100ms, so a later user action can retry.

The shell owns when sounds play. Importing this module bundles only the locally available WAV files.
