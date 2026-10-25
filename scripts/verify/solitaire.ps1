param(
  [int]$CdpPort = 9341,
  [string]$Url = 'http://127.0.0.1:5441',
  [string]$Session = 'solfix',
  [string]$ProofDir = 'D:\codes\worktrees\windows-95-web\proof\solfix'
)
$ErrorActionPreference = 'Stop'
& agent-browser --session $Session connect $CdpPort
if ($LASTEXITCODE -ne 0) { throw 'Cannot attach to the Solitaire Electron instance.' }
& agent-browser --session $Session snapshot -i
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect the Electron renderer.' }
& node (Join-Path $PSScriptRoot 'solitaire.mjs') $CdpPort $ProofDir $Url
if ($LASTEXITCODE -ne 0) { throw 'Solitaire verification failed.' }
