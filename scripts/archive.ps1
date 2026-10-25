param(
  [Parameter(Mandatory = $true)][string]$Folder,
  [Parameter(Mandatory = $true)][string]$Destination
)
$ErrorActionPreference = 'Stop'
Compress-Archive -LiteralPath $Folder -DestinationPath $Destination -Force
