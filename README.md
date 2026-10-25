# Windows 95

A Windows 95 desktop built with React, TypeScript, and Electron 45. The same renderer runs in a web browser. The shell provides Start, a taskbar, movable windows, a persistent virtual C: drive, and Notepad. Apps register through their own folders.

The renderer uses local fonts, icons, and assets. Documents stay in the virtual drive, separate from the host's files. Electron stores them in its user profile. A web browser stores them for the current origin. Development and production use different origins, so they have separate virtual drives even with the same Electron profile.

## Install offline

Use Node.js and pnpm. Desktop development and packaging require Windows x64. The pnpm store and Electron download cache must already contain the versions in `pnpm-lock.yaml`.

```powershell
pnpm install --offline
```

The postinstall step extracts Electron from its local cache. An empty cache cannot support an offline install.

## Run the desktop

```powershell
pnpm dev
```

The desktop shows a boot message, then the teal background and taskbar. Open **Start > Programs > Accessories > Notepad**, or use **Start > Run** and enter `notepad`.

Drag a title bar to move a window. The outline moves until you release the mouse. Drag an edge or corner to resize. Use the title buttons to minimize, maximize, restore, or close a window. Click a taskbar button to restore a minimized window.

Use Ctrl+Esc to toggle Start and Escape to dismiss it. F2 renames a selected desktop file. Delete asks for confirmation before moving the file to `C:\RECYCLED`. F11 toggles the Electron host's full screen mode.

Windows opens Start when tapped. Windows+R opens Run, Windows+E opens Explorer, Windows+F opens Find, Windows+M minimizes all windows, and Shift+Windows+M restores them. These bindings apply in windowed and full screen mode when Electron receives the keys. The app uses no global keyboard hook and does not suppress the host Windows shell. A physical Windows key or Windows shortcut consumed by the host opens the host's Start menu or command instead, even in full screen mode. Ctrl+Esc and the in-app Start button remain available. CDP key injection checks app routing and does not verify physical host key capture.

The launch wrapper clears `ELECTRON_RUN_AS_NODE`, which Electron-based terminals can inherit. Clear this variable yourself if you launch an Electron executable directly.

## Run the web renderer

```powershell
pnpm dev:web --port 5401
```

Open the local address printed by Vite. Choose another port if 5401 is occupied. In the web build, click the safe-to-turn-off screen to boot again.

## Check and build

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm build:web
```

Vitest runs pure logic tests without jsdom. `pnpm build` writes the Electron main, preload, and renderer files under `out/`. `pnpm build:web` writes the static web build to `dist/web/`.

```powershell
pnpm start
```

This launches the production Electron renderer through electron-vite preview.

## Package Windows

Close any running copy of the previous release, then run:

```powershell
pnpm package
```

The command builds the app, copies the cached Electron runtime, embeds `src/renderer/public/icon.ico`, and creates these outputs:

- `release/Windows 95-win32-x64/Windows 95.exe` launches the app without an installer.
- `release/Windows 95-win32-x64.zip` contains the complete portable app folder.

Keep the executable with the rest of its folder. The package has no runtime dependency on this checkout or `node_modules`.

The icon script accepts ICO files with multiple images, including PNG images and 256-pixel directory entries. It replaces the executable's icon resources and reads them back to check every byte. To verify an existing package:

```powershell
powershell.exe -NoProfile -File scripts/set-icon.ps1 -Executable 'release/Windows 95-win32-x64/Windows 95.exe' -Icon src/renderer/public/icon.ico -VerifyOnly
```

## Add an app

Create `src/renderer/src/apps/<id>/index.tsx` and export `app: AppManifest`. The shell discovers the manifest with `import.meta.glob`. No shared registration edit is needed. Use [Notepad](src/renderer/src/apps/notepad/index.tsx) as the reference app and [AppManifest](src/renderer/src/shell/types.ts) for the full contract.

Each manifest supplies an `id`, `title`, `icon`, `exe`, `window`, and `component`. A 32-pixel icon belongs in the app folder. Draw it with `pixelArt` from `icons/pixel.ts`. Set `smallIcon` for a separate 16-pixel version.

Use the remaining manifest fields as needed:

- `installDir` defaults to `C:\WINDOWS`. `exe` is the installed program name. Run accepts it with or without `.exe` and ignores case.
- `startMenu` is a path under Programs. `['Accessories', 'Games']` adds two nested folders. An empty array puts the app directly under Programs.
- `fileTypes` lists extensions without a dot. The shell uses them when a user opens a file.
- `desktopShortcut` creates a shortcut on the first boot. The shell preserves a user's later deletion.
- `desktop` defines a shell icon, its order, optional state-dependent image, and optional file-drop handler.

A fixed window uses `{ kind: 'fixed' }`, sizes to its content, and cannot resize or maximize. A resizable window supplies `width`, `height`, and optional minimum sizes. These sizes describe the client area. Let the app root fill that area with `h-full w-full flex flex-col`.

The component receives `{ window, args }`. `args.file` and `args.folder` are virtual node ids. `window` supplies `id`, `focused`, `minimized`, `setTitle()`, and `close()`. Register `onCloseRequest(handler)` to intercept the title-bar Close button. It returns a cleanup function. After any save prompt, call `close()` to finish closing.

Pause game loops while `window.minimized` or `!window.focused`. Use `useKeyDown` from `shell/context.ts` for shortcuts that apply only to the focused app. The shell keeps windows in stable DOM order when their stacking order changes.

### Use the virtual file system

Use `fs`, `createNode`, and `useFs` from `fs/store.ts`. Use the pure functions in `fs/fs.ts` for paths, children, names, and extensions. The known folder ids live in `fs/types.ts`.

Select a stable value with `useFs`, such as the whole state or one node. Derive arrays with `useMemo`. Returning a new array from the selector can cause repeated renders.

Use `launch`, `openNode`, and `opener` from `shell/system.ts` for app launches and document opening.

### Use the shared UI

Import controls from `ui/index.ts`. `MenuBar` and `MenuList` accept labels with `&` before an accelerator. `Dialog` and `MessageBox` block their owning window and stack with it. Shell dialogs use `ShellDialogHost`. Escape dismisses the top dialog. Pointer use of a menu preserves the editor's focus and selection.

`FileDialog` accepts `mode: 'open' | 'save'`, `initialFolder`, `initialName`, `filters`, `defaultExtension`, `onSelect`, and `onCancel`. Each filter has a label and an array of extensions. Use `'*'` for all files.

`onSelect` receives either `{ kind: 'existing', id, parent, name }` or `{ kind: 'new', parent, name }`. The dialog confirms an overwrite but leaves creation and writing to the app. Open reads the existing node. Save writes its content with `fs.write` or creates a new node with `createNode`.

Use theme colors and bevel utilities from `styles.css`. The shell uses the 16-color palette, local MS Sans Serif at 11 pixels, and 1-pixel bevels.

## Run the live checks

Start Electron with an isolated profile and a CDP port:

```powershell
$env:W95_DATA_DIR = Join-Path $env:TEMP 'win95-check'
$env:W95_CDP_PORT = '9301'
pnpm start
```

In another terminal, use the installed agent-browser CLI:

```powershell
$env:W95_CDP_PORT = '9301'
node scripts/verify-shell.mjs smoke
node scripts/verify-shell.mjs editing
node scripts/verify-shell.mjs desktop
node scripts/verify-shell.mjs shutdown
```

The shutdown check exits Electron after the safe screen. Confirm the process exits, then relaunch with the same profile and run `node scripts/verify-shell.mjs persistence`. Save `note.txt` through the smoke check before running persistence. Use the same launch mode for both runs so the storage origin stays the same.

The checks use the `shell` browser session and save screenshots and check results under `../proof/shell/`. Override `W95_BROWSER_SESSION`, `W95_PROOF_DIR`, or `W95_AGENT_BROWSER` to change the session, output path, or CLI executable. CDP launches disable native window occlusion so a covered test window still accepts browser input.
