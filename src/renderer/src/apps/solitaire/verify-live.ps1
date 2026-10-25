param(
  [string]$Url = 'http://localhost:5403',
  [string]$Session = 'solitaire',
  [string]$ProofDir = 'D:\codes\worktrees\windows-95-web\proof\solitaire'
)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $ProofDir | Out-Null

function Browser([string[]]$Command) {
  $output = & agent-browser --session $Session --json @Command
  if ($LASTEXITCODE -ne 0) { throw "$($Command -join ' '): $($output -join ' ')" }
  $response = ($output -join "`n") | ConvertFrom-Json
  if (-not $response.success) { throw $response.error }
  return $response.data
}
function Read-Page([string]$Code) {
  $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Code))
  return (Browser @('eval', '-b', $encoded)).result
}
function Assert-Page([string]$Expression, [string]$Name) {
  $result = Read-Page "if (!($Expression)) throw new Error('$Name'); '$Name passed'"
  Write-Output $result
}
function Click-Button([string]$Name) {
  Browser @('find', 'role', 'button', 'click', '--name', $Name, '--exact') | Out-Null
}
function Picture([string]$Name) {
  Browser @('screenshot', (Join-Path $ProofDir "$Name.png")) | Out-Null
}
function Open-Deal([string]$Query) {
  Browser @('open', "$Url/?$Query") | Out-Null
  Browser @('wait', '[role=option]') | Out-Null
  Browser @('snapshot', '-i') | Out-Null
  Browser @('find', 'role', 'option', 'click', '--name', 'Solitaire', '--exact') | Out-Null
  Browser @('press', 'Enter') | Out-Null
  Browser @('wait', '[data-phase]') | Out-Null
  Browser @('snapshot', '-i') | Out-Null
}
function Drag-Card([string]$Card, [int]$Column) {
  $points = Read-Page "(()=>{const a=document.querySelector('[data-card=$Card]').getBoundingClientRect();const b=document.querySelectorAll('[data-column]')[$Column].getBoundingClientRect();return {x:a.x+15,y:a.y+5,toX:b.x+35,toY:b.y+30}})()"
  if ($null -eq $points.x) { throw "Card coordinates missing: $($points | ConvertTo-Json -Compress)" }
  Browser @('mouse', 'move', "$([Math]::Round($points.x))", "$([Math]::Round($points.y))") | Out-Null
  Browser @('mouse', 'down') | Out-Null
  Browser @('mouse', 'move', "$([Math]::Round($points.toX))", "$([Math]::Round($points.toY))", '--steps', '16') | Out-Null
  Browser @('mouse', 'up') | Out-Null
}
function Open-Options {
  Click-Button 'Game'
  Browser @('find', 'role', 'menuitem', 'click', '--name', 'Options...', '--exact') | Out-Null
  Browser @('snapshot', '-i') | Out-Null
}

Open-Deal 'solitaireDeal=run'
Picture 'initial'
Drag-Card 'hearts-7' 2
Assert-Page "document.querySelectorAll('[data-column]')[0].dataset.count==='4' && document.querySelectorAll('[data-column]')[2].dataset.count==='1'" 'Illegal run snaps back'
Picture 'illegal-drop'
Drag-Card 'hearts-7' 1
Assert-Page "document.querySelectorAll('[data-column]')[0].dataset.count==='1' && document.querySelectorAll('[data-column]')[1].dataset.count==='4'" 'Legal three-card run moves'
Picture 'legal-run'
Browser @('click', '[data-card=clubs-4]') | Out-Null
Assert-Page "document.querySelector('[data-card=clubs-4]').getAttribute('aria-label')==='4 of clubs'" 'Manual flip after drag'
Picture 'manual-flip'
Browser @('press', 'Control+z') | Out-Null
Assert-Page "document.querySelector('[data-card=clubs-4]').getAttribute('aria-label')==='Face-down card'" 'Undo restores hidden card'

Open-Options
Browser @('find', 'role', 'checkbox', 'check', '--name', 'Outline dragging') | Out-Null
Browser @('find', 'role', 'checkbox', 'click', '--name', 'Status bar') | Out-Null
Click-Button 'OK'
Assert-Page "!document.querySelector('.solitaire').textContent.includes('Score:') && document.querySelectorAll('[data-column]')[1].dataset.count==='4'" 'Display options preserve the deal'
$points = Read-Page "(()=>{const r=document.querySelector('[data-card=hearts-7]').getBoundingClientRect();return {x:r.x+15,y:r.y+5}})()"
Browser @('mouse', 'move', "$([Math]::Round($points.x))", "$([Math]::Round($points.y))") | Out-Null
Browser @('mouse', 'down') | Out-Null
Browser @('mouse', 'move', '350', '340', '--steps', '16') | Out-Null
Assert-Page "document.querySelector('.solitaire [aria-hidden=true] .outline') !== null" 'Outline dragging draws outlines'
Picture 'outline-drag'
Browser @('mouse', 'up') | Out-Null
Open-Options
Browser @('find', 'role', 'checkbox', 'check', '--name', 'Status bar') | Out-Null
Click-Button 'OK'

Browser @('click', 'button[aria-label^=Stock]') | Out-Null
Assert-Page "document.querySelectorAll('[data-pile=waste-fan]').length===2 && document.querySelectorAll('[data-pile=waste]').length===1" 'Draw Three fans three cards'
$firstWaste = Read-Page "document.querySelector('[data-pile=waste]').dataset.card"
Picture 'draw-three'
for ($draw = 0; $draw -lt 15; $draw++) { Browser @('click', 'button[aria-label^=Stock]') | Out-Null }
Click-Button 'Recycle waste'
Assert-Page "document.querySelectorAll('[data-pile=waste]').length===0" 'Recycle clears waste'
Picture 'stock-recycled'
Browser @('click', 'button[aria-label^=Stock]') | Out-Null
Assert-Page "document.querySelector('[data-pile=waste]').dataset.card==='$firstWaste'" 'Recycle preserves stock order'

Open-Options
Browser @('find', 'role', 'radio', 'click', '--name', 'Draw one') | Out-Null
Browser @('find', 'role', 'radio', 'click', '--name', 'Vegas') | Out-Null
Browser @('find', 'role', 'checkbox', 'click', '--name', 'Timed game') | Out-Null
Picture 'options'
Click-Button 'OK'
Assert-Page "document.querySelector('.solitaire').textContent.includes('Score: '+String.fromCharCode(36)+'-52')" 'Vegas charges 52'
for ($draw = 0; $draw -lt 24; $draw++) { Browser @('click', 'button[aria-label^=Stock]') | Out-Null }
Assert-Page "Array.from(document.querySelectorAll('button')).some(e=>e.getAttribute('aria-label')==='Stock exhausted') && document.querySelectorAll('[data-pile=waste-fan]').length===0" 'Vegas Draw One blocks recycle'
Picture 'vegas-draw-one'
Open-Options
Browser @('find', 'role', 'radio', 'click', '--name', 'Draw three') | Out-Null
Click-Button 'OK'
for ($pass = 0; $pass -lt 3; $pass++) {
  for ($draw = 0; $draw -lt 8; $draw++) { Browser @('click', 'button[aria-label^=Stock]') | Out-Null }
  if ($pass -lt 2) { Click-Button 'Recycle waste' }
}
Assert-Page "Array.from(document.querySelectorAll('button')).some(e=>e.getAttribute('aria-label')==='Stock exhausted')" 'Vegas Draw Three stops after three passes'
Picture 'vegas-draw-three'
Open-Options
Browser @('find', 'role', 'radio', 'click', '--name', 'None') | Out-Null
Click-Button 'OK'
Assert-Page "!document.querySelector('.solitaire').textContent.includes('Score:')" 'None hides score'

Click-Button 'Game'
Browser @('find', 'role', 'menuitem', 'click', '--name', 'Deck...', '--exact') | Out-Null
Browser @('snapshot', '-i') | Out-Null
Picture 'decks'
$oldBack = Read-Page "document.querySelector('button[aria-label^=Stock] img').src"
Click-Button 'Castle'
Click-Button 'OK'
$newBack = Read-Page "document.querySelector('button[aria-label^=Stock] img').src"
if ($oldBack -eq $newBack) { throw 'Deck did not change' }
Picture 'castle-deck'
Click-Button 'Help'
Browser @('find', 'role', 'menuitem', 'click', '--name', 'About Solitaire', '--exact') | Out-Null
Assert-Page "document.querySelector('[role=dialog]').textContent.includes('Windows 95')" 'About opens'
Picture 'about'
Click-Button 'OK'

$frame = Read-Page "document.querySelector('[data-window]').getBoundingClientRect().toJSON()"
Browser @('mouse', 'move', "$($frame.right - 3)", "$($frame.bottom - 3)") | Out-Null
Browser @('mouse', 'down') | Out-Null
Browser @('mouse', 'move', "$($frame.right + 240)", "$($frame.bottom + 40)", '--steps', '16') | Out-Null
Browser @('mouse', 'up') | Out-Null
Assert-Page "document.querySelector('[data-phase]').clientWidth>800 && document.querySelector('[data-card]')?.clientWidth>=71" 'Resize scales cards'
Picture 'resized'
Click-Button 'Maximize'
Assert-Page "document.querySelector('[data-window]').getBoundingClientRect().x===0 && document.querySelector('[data-phase]').clientWidth>1000 && document.querySelector('[data-card]').clientWidth>=71" 'Maximize keeps cards legible'
Picture 'maximized'

Open-Deal 'solitaireDeal=win'
Browser @('dblclick', '[data-card=spades-13]') | Out-Null
Browser @('wait', 'canvas') | Out-Null
Browser @('wait', '1200') | Out-Null
Assert-Page "document.querySelector('[data-phase]').dataset.phase==='won' && document.querySelector('[data-foundation=spades]').dataset.count==='13' && document.querySelector('canvas').getContext('2d').getImageData(0,0,620,300).data.some((value,index)=>index%4===3 && value>0)" 'Double-click wins and canvas draws trails'
Picture 'win-cascade'
Click-Button 'Stop winning animation'
Assert-Page "document.querySelector('canvas')===null" 'Click stops the cascade'
Browser @('press', 'F2') | Out-Null
Assert-Page "document.querySelector('[data-phase]').dataset.phase==='playing' && document.querySelectorAll('[data-card]').length===28" 'F2 deals again'
Browser @('click', 'button[aria-label^=Stock]') | Out-Null
Click-Button 'Minimize'
$time = Read-Page "document.querySelector('.solitaire').textContent.match(/Time: (\d+)/)[1]"
Browser @('wait', '1200') | Out-Null
Assert-Page "document.querySelector('.solitaire').textContent.match(/Time: (\d+)/)[1]==='$time'" 'Minimize pauses the clock'
Click-Button 'Solitaire'
Picture 'finished'
Open-Deal 'solitaireDeal=win'
Browser @('dblclick', '[data-card=spades-13]') | Out-Null
Browser @('wait', 'canvas') | Out-Null
Browser @('press', 'F2') | Out-Null
Assert-Page "document.querySelector('canvas')===null && document.querySelector('[data-phase]').dataset.phase==='playing'" 'F2 stops an active cascade'
Write-Output 'All Solitaire live checks passed.'
