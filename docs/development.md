# Developer guide

This guide documents the app contracts and local checks. See the [README](../README.md#run-locally) for prerequisites, development commands, and package outputs.

## Source layout

| Path | Responsibility |
| --- | --- |
| `src/main/` | Electron window, host keyboard events, profile selection, shutdown, and restart. |
| `src/preload/` and `src/shared/` | The `window.win95` host bridge and its IPC types. |
| `src/renderer/src/shell/` | App discovery, windows, taskbar, Start, desktop, and app launching. |
| `src/renderer/src/apps/` | App manifests, components, and app logic. |
| `src/renderer/src/fs/` | Virtual drive types, pure operations, store, and persistence. |
| `src/renderer/src/ui/` | Shared controls, menus, dialogs, and file pickers. |
| `src/renderer/src/settings/` | Desktop preferences, virtual clock, and screen savers. |
| `src/renderer/src/system/` | Imported font, cursor, and sound integration. |

Renderer code reaches Electron only through `window.win95`. The main process and preload do not import renderer code. Biome checks these import boundaries.

## Add an app

Create `src/renderer/src/apps/<id>/index.tsx` and export `app: AppManifest`. The [registry](../src/renderer/src/shell/registry.ts) discovers manifests with `import.meta.glob`. No shared registration edit is needed. Use [Notepad](../src/renderer/src/apps/notepad/index.tsx) as a document-app example and [AppManifest](../src/renderer/src/shell/types.ts) for the full contract.

Each manifest supplies `id`, `title`, `icon`, `exe`, `window`, and `component`. Draw a 32-pixel icon with `pixelArt` from [icons/pixel.ts](../src/renderer/src/icons/pixel.ts). Set `smallIcon` for a separate 16-pixel version.

| Optional field | Behavior |
| --- | --- |
| `installDir` | Defaults to `C:\WINDOWS`. `exe` is the virtual installed program name. Run accepts the name with or without `.exe` and ignores case. |
| `startMenu` | A path under Programs. `['Accessories', 'Games']` adds nested folders. `[]` places the app directly under Programs. Omit the field to leave the app out of Programs. |
| `fileTypes` | Extensions without a dot. The shell uses them to choose an app when opening a file. |
| `desktopShortcut` | Creates a shortcut on the first boot. Later boots preserve the user's deletion of that shortcut. |
| `desktop` | Defines a shell icon, its order, and optional state-dependent image, file-drop handler, and Properties component. |

A fixed window uses `{ kind: 'fixed' }`, sizes to its content, and cannot resize or maximize. A resizable window supplies `width`, `height`, and optional `minWidth` and `minHeight`. These sizes describe the client area. Let the app root fill that area with `h-full w-full flex flex-col`.

The component receives `{ window, args }`. `args.file` and `args.folder` are virtual node IDs. Other launch arguments support selecting a node, opening a help book, or targeting a shell-folder item. See [LaunchArgs](../src/renderer/src/shell/types.ts).

The `window` handle provides these values and methods:

- `id`, `focused`, and `minimized` describe the window.
- `setTitle()` updates the caption. `setWindowSpec()` changes its presentation.
- `onCloseRequest(handler)` registers a handler returning `Promise<boolean>` and returns a cleanup function. The handler owns any save prompt and calls `close()` when closing is accepted. Resolve `true` after closing or `false` to cancel. Shutdown uses that result to continue or stop.
- `onHelpRequest(handler)` registers window help and returns a cleanup function.
- `close()` closes the window directly, without calling the close-request handler.

Pause game loops while `window.minimized` or `!window.focused`. Use `useKeyDown` from [shell/context.ts](../src/renderer/src/shell/context.ts) for keys that apply only to the focused app. The shell keeps windows in stable DOM order when their stacking order changes.

To add app help, export `help` from `apps/<id>/help.ts`. The registry discovers that module's book ID. Follow the [WordPad help book](../src/renderer/src/apps/wordpad/help.ts) for the topic structure.

## Use the virtual file system

Import `fs`, `createNode`, `useFs`, and `fsTimestamp` from [fs/store.ts](../src/renderer/src/fs/store.ts). The pure functions in [fs/fs.ts](../src/renderer/src/fs/fs.ts) handle paths, children, names, extensions, and reducer operations. Known folder IDs and node types live in [fs/types.ts](../src/renderer/src/fs/types.ts).

Select a stable value with `useFs`, such as the whole state or one node. Derive arrays with `useMemo`. Returning a new array from the selector can cause repeated renders.

`createNode(parent, name, spec)` returns `{ id }` on success or `{ error }` if name validation fails. File content is a string. Apps encode their own document or picture content.

`fs.write(id, content)` returns `{ ok: true }` or `{ ok: false, error: string }`. It writes only to an existing file that is not read-only. Check the result before marking a document saved, changing its current filename, or continuing a pending close. A failed write leaves the node unchanged.

`fsTimestamp()` returns epoch milliseconds from the recreation's virtual system clock, including Date/Time settings. The store uses it for creation and mutation timestamps. Use it for direct filesystem actions that require an `at` value. Use the host clock for elapsed interaction timers, not virtual file dates.

The `fs` helpers also expose rename, move, recycle, restore, purge, attribute changes, and shortcut settings. Their return types differ. For example, `rename` returns an error string or `null`. Check the source contract before assuming every mutation returns `WriteResult`.

Use `launch`, `openNode`, and `opener` from [shell/system.ts](../src/renderer/src/shell/system.ts) for app launches and document opening. `launch` returns a window ID or `null`. `openNode` returns whether it opened a window. `opener` resolves a node to an app and launch arguments without opening it.

## Use the shared UI

Import controls from [ui/index.ts](../src/renderer/src/ui/index.ts). `MenuBar` and `MenuList` accept labels with `&` before an accelerator. Pointer use of a menu preserves the editor's focus and selection.

`Dialog` and `MessageBox` block their owning window and stack with it. Shell dialogs use `ShellDialogHost`. Escape dismisses the top dialog. Use `ModelessDialog` for dialogs that allow continued work in their owner, such as Find.

[`FileDialog`](../src/renderer/src/ui/FileDialog.tsx) accepts `mode: 'open' | 'save'`, `initialFolder`, `initialName`, `filters`, `initialFilter`, `defaultExtension`, `pickable`, `onSelect`, and `onCancel`. Each filter has a label and an array of extensions. Use `'*'` for all files.

`onSelect(result, filter)` receives the selected filter and one of these results:

- `{ kind: 'existing', id, parent, name }` identifies an existing node.
- `{ kind: 'new', parent, name }` describes a new file to create.

The dialog confirms an overwrite but leaves file creation and writing to the app. Open reads the existing node. Save checks `fs.write` for an existing file or `createNode` for a new one. Recheck write success even after the overwrite prompt.

Use theme colors and bevel utilities from [styles.css](../src/renderer/src/styles.css). The default theme uses the classic 16-color palette, MS Sans Serif at 11 pixels, and 1-pixel bevels. Appearance settings can change those colors and fonts. See the [system asset guide](../src/renderer/src/system/README.md) for font metrics, cursor classes, sound playback, and fallbacks.

## Storage and profiles

The virtual file system is serialized to `localStorage` under `w95.fs.v1`. Writes are batched with a 250 ms delay and flushed on `beforeunload`. Settings use `win95.settings.v1`. Other app preferences and game records have their own storage keys.

Electron stores origin data inside `app.getPath('userData')`. `W95_DATA_DIR` overrides that directory before the window starts. The host also stores its full screen preference in `shell-window.json` there. A portable package still uses an Electron user-data profile. Its documents do not travel inside the executable's folder.

Use the same profile and launch mode for persistence checks. Electron development loads a Vite URL. Production loads `out/renderer/index.html` through a file URL. Those origins have separate virtual drives, even within the same profile. Browser storage is also separate for each scheme, host, and port.

The [launch wrapper](../scripts/electron-vite.mjs) clears `ELECTRON_RUN_AS_NODE`, which Electron-based terminals can inherit. If you launch an Electron executable directly, clear that variable yourself.

## Run code and package checks

Run these commands from the repository root:

```powershell
pnpm typecheck
pnpm lint
pnpm test
```

Vitest runs pure logic tests without jsdom. Build and preview commands are in the [README](../README.md#build-and-package).

`pnpm package` builds the app, copies the locally installed Electron runtime, embeds [icon.ico](../src/renderer/public/icon.ico), and archives the portable folder. The [package script](../scripts/package.mjs) requires Windows x64. The package has no runtime dependency on this checkout or `node_modules`.

The icon script accepts ICO files with multiple images, including PNG images and 256-pixel directory entries. It replaces the executable's icon resources and reads them back to check every byte. To verify an existing package, run:

```powershell
powershell.exe -NoProfile -File scripts/set-icon.ps1 -Executable 'release/Windows 95-win32-x64/Windows 95.exe' -Icon src/renderer/public/icon.ico -VerifyOnly
```

## Run live Electron checks

Build once, then start Electron with an isolated profile and a free CDP port. Use a disposable profile because the checks create, rename, and delete virtual files.

```powershell
pnpm build
$env:W95_DATA_DIR = Join-Path $env:TEMP 'win95-check'
$env:W95_CDP_PORT = '9301'
pnpm start
```

In another terminal, run the shell checks. These require an installed `agent-browser` CLI. They connect to the app through the selected CDP port.

```powershell
$env:W95_CDP_PORT = '9301'
node scripts/verify-shell.mjs smoke
node scripts/verify-shell.mjs editing
node scripts/verify-shell.mjs desktop
node scripts/verify-shell.mjs shutdown
```

The shutdown check exits Electron after the safe screen. Confirm that the process exits, then relaunch with the same profile and run `node scripts/verify-shell.mjs persistence`. The smoke check must first save `note.txt`, and the desktop check must rename and move the desktop readme. Keep the launch mode unchanged so the storage origin stays the same.

The checks use the `shell` browser session and save screenshots and results locally. Set `W95_BROWSER_SESSION`, `W95_PROOF_DIR`, or `W95_AGENT_BROWSER` to change the session, output directory, or CLI executable. CDP launches disable native window occlusion so a covered test window still accepts browser input. Injected Windows keys check app routing, not physical host key capture.

The [verification script guide](../scripts/verify/README.md) distinguishes current app checks from historical proofs and documents their profile and port requirements. Keep proof claims tied to the revision and executable they checked.

## Keyboard and host limits

When Electron receives them, tapping Windows opens Start. Windows+R opens Run, Windows+E opens Explorer, Windows+F opens Find, Windows+M minimizes all windows, and Shift+Windows+M restores them.

The app has no global keyboard hook and does not suppress the host Windows shell. A physical key or shortcut consumed by the host opens the host's Start menu or command, even in full screen. Ctrl+Esc and the in-app Start button remain available.
