# Historical proof from an earlier rebuild round. See scripts/verify/README.md.
param(
  [int]$Port = 9340,
  [string]$ProofDir = 'D:/codes/worktrees/windows-95-web/proof/minesfix',
  [ValidateSet('rules', 'full')][string]$Mode = 'full'
)

$ErrorActionPreference = 'Stop'
& node (Join-Path $PSScriptRoot 'minesweeper.mjs') $Port $ProofDir $Mode
if ($LASTEXITCODE -ne 0) { throw 'Minesweeper verification failed' }
