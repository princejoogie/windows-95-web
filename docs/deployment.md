# Deploy to Cloudflare Pages

The browser app is static and needs no backend or database. Saved data stays in each browser's storage for the current origin. See [Storage and profiles](development.md#storage-and-profiles).

Use the [local prerequisites](../README.md#run-locally) and run these commands from the repository root. Expose `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the deploying shell. If you saved Windows user environment variables, open a new shell to inherit them. Keep credentials outside the repository. See [Wrangler environment variables](https://developers.cloudflare.com/workers/wrangler/system-environment-variables/).

## Build without imported Windows assets

The [system asset documentation](../src/renderer/src/system/README.md) prohibits distributing generated Microsoft assets. Temporarily point `W95_SYSTEM_ROOT` at a nonexistent directory for the public build:

```powershell
$previousSystemRoot = $env:W95_SYSTEM_ROOT
try {
	$env:W95_SYSTEM_ROOT = Join-Path $env:TEMP 'win95-no-windows'
	if (Test-Path -LiteralPath $env:W95_SYSTEM_ROOT) {
		throw 'Choose a nonexistent directory for W95_SYSTEM_ROOT.'
	}
	pnpm build:web
	if ($LASTEXITCODE -ne 0) { throw 'Web build failed.' }
} finally {
	$env:W95_SYSTEM_ROOT = $previousSystemRoot
}
```

The importer removes stale generated Windows assets, and the build writes `dist/web/`. This variant uses the bundled fallback font, CSS cursors, and silent system sounds. Games retain their synthesized audio. The README screenshots show the production Electron app, so public fallback rendering can differ.

The `finally` block restores the previous process environment setting, including an unset value. Do not run another build with imported Windows assets before uploading `dist/web/`.

## Upload the public build

The Pages project is `windows-95-web`, and its production branch is `master`. Upload the public build with the pinned CLI:

```powershell
pnpm dlx wrangler@4.152.0 pages deploy dist/web --project-name windows-95-web --branch master
```

`pnpm dlx` runs Wrangler without adding a project dependency. The explicit branch selects production even when your local checkout uses another branch. [wrangler.jsonc](../wrangler.jsonc) records the project name, output directory, and compatibility date. See the official [Pages commands](https://developers.cloudflare.com/workers/wrangler/commands/pages/) and [Pages configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/) references.

## Create the project once

Skip this step when the project already exists. For a new project, create it before uploading:

```powershell
pnpm dlx wrangler@4.152.0 pages project create windows-95-web --production-branch master --force
```

In Wrangler 4.152.0, `--force` bypasses Workers auto-configuration when an agent creates a new Pages project. This option is absent from its help output. Once the Pages project exists, subsequent commands use Pages directly. Omit `--force` from later deploy commands.
