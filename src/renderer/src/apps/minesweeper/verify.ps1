param(
  [string]$Url = 'http://localhost:5402',
  [string]$Session = 'minesweeper',
  [string]$ProofDir = 'D:\codes\worktrees\windows-95-web\proof\minesweeper'
)

$ErrorActionPreference = 'Stop'

function Browser {
  $result = & agent-browser --session $Session --json @args | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0 -or -not $result.success) { throw ($result | ConvertTo-Json -Depth 8) }
  return $result.data
}

function Evaluate([string]$Code) {
  $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Code))
  return (Browser eval -b $encoded).result
}

function Assert([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw $Message }
  Write-Output "PASS $Message"
}

function Capture([string]$Name) {
  Browser screenshot (Join-Path $ProofDir "$Name.png") | Out-Null
}

function Menu([string]$Item) {
  Browser find role button click --name Game --exact | Out-Null
  Browser find role menuitem click --name $Item --exact | Out-Null
}

function Cell([int]$Index) { return ".mine-cell[data-cell='$Index']" }

function RightClick([int]$Index) {
  Browser hover (Cell $Index) | Out-Null
  Browser mouse down right | Out-Null
  Browser mouse up right | Out-Null
}

function Launch {
  Browser wait '[role=listbox]' | Out-Null
  $snapshot = Browser snapshot -i
  $icon = $snapshot.refs.PSObject.Properties | Where-Object { $_.Value.role -eq 'option' -and $_.Value.name -eq 'Minesweeper' } | Select-Object -First 1
  if (-not $icon) { throw 'Minesweeper desktop shortcut is missing' }
  Browser dblclick "@$($icon.Name)" | Out-Null
}

New-Item -ItemType Directory -Force $ProofDir | Out-Null
Browser open $Url | Out-Null
Evaluate "localStorage.removeItem('win95.minesweeper')" | Out-Null
Browser reload | Out-Null
Launch
Evaluate 'Math.random = () => 42 / 4294967296' | Out-Null
Browser click '.mine-face' | Out-Null
Capture 'beginner'
Browser click (Cell 40) | Out-Null
Assert ((Browser get count '.mine-open').count -eq 63) 'Seed 42 first click opens 63 safe cells'
Capture 'opened-region'
RightClick 1
Browser hover (Cell 2) | Out-Null
Browser mouse down middle | Out-Null
Assert ((Browser get attr '.mine-face' aria-label).value -match 'surprised') 'Holding a chord shows the surprised face'
Capture 'chord-held'
Browser mouse up middle | Out-Null
Assert ((Browser get attr (Cell 10) aria-label).value -eq 'Row 2, column 2, 3') 'Middle click opens a numbered neighbor'
Capture 'chord-open'
RightClick 9
RightClick 18
Browser hover (Cell 10) | Out-Null
Browser mouse down left | Out-Null
Browser mouse down right | Out-Null
Browser mouse up left | Out-Null
Browser mouse up right | Out-Null
Assert ((Browser get attr (Cell 0) aria-label).value -eq 'Row 1, column 1, 2') 'Left and right buttons together chord'
foreach ($index in @(7,8,17,27,36)) { Browser click (Cell $index) | Out-Null }
Assert ((Browser get attr '.mine-face' aria-label).value -match 'sunglasses') 'Win shows sunglasses'
Assert ((Browser get count ".mine-cell[aria-label$='flag']").count -eq 10) 'Win flags every mine'
Assert ((Browser get count "[role='dialog']").count -eq 1) 'Win asks for the player name'
Assert (Evaluate "document.querySelector('[role=dialog]').getBoundingClientRect().left >= 0") 'Name dialog stays inside the viewport'
Capture 'win-name'
Browser find role textbox fill --name Name Ada | Out-Null
Browser find role button click --name OK --exact | Out-Null
Capture 'win'
Assert (Evaluate "JSON.parse(localStorage.getItem('win95.minesweeper')).records.beginner.name === 'Ada'") 'Best time saves the player name'
$timer = Evaluate "document.querySelectorAll('output')[1].getAttribute('aria-label')"
Evaluate 'new Promise(resolve => setTimeout(resolve, 1200))' | Out-Null
Assert ((Evaluate "document.querySelectorAll('output')[1].getAttribute('aria-label')") -eq $timer) 'Timer stops after a win'
Browser reload | Out-Null
Launch
Assert (Evaluate "JSON.parse(localStorage.getItem('win95.minesweeper')).records.beginner.name === 'Ada'") 'Best time survives reload and relaunch'
Menu 'Best Times...'
Capture 'best-times'
Browser find role button click --name 'Reset Scores' --exact | Out-Null
Assert (Evaluate "Object.values(JSON.parse(localStorage.getItem('win95.minesweeper')).records).every(r=>r.seconds===999 && r.name==='Anonymous')") 'Reset Scores resets all three records'
Browser find role button click --name OK --exact | Out-Null
Evaluate 'Math.random = () => 42 / 4294967296' | Out-Null
Browser press F2 | Out-Null
Assert ((Browser get count '.mine-open').count -eq 0) 'F2 starts a fresh board'
Browser click (Cell 40) | Out-Null
Evaluate 'new Promise(resolve => setTimeout(resolve, 1200))' | Out-Null
$timer = Evaluate "document.querySelectorAll('output')[1].getAttribute('aria-label')"
Assert ($timer -ne 'Time: 0') 'Timer starts after the first reveal'
Browser find role button click --name Minimize --exact | Out-Null
Evaluate 'new Promise(resolve => setTimeout(resolve, 1200))' | Out-Null
Assert ((Evaluate "document.querySelectorAll('output')[1].getAttribute('aria-label')") -eq $timer) 'Timer pauses while minimized'
Browser find role button click --name Minesweeper --exact | Out-Null
Evaluate 'new Promise(resolve => setTimeout(resolve, 1200))' | Out-Null
Assert ((Evaluate "document.querySelectorAll('output')[1].getAttribute('aria-label')") -ne $timer) 'Timer resumes with the window'
Capture 'timer-resumed'
RightClick 0
Browser click (Cell 1) | Out-Null
Assert ((Browser get count '.mine-exploded').count -eq 1) 'Loss highlights the exploded mine'
Assert ((Browser get count ".mine-cell[aria-label$='wrong flag']").count -eq 1) 'Loss crosses out a wrong flag'
Assert ((Browser get count ".mine-cell[aria-label$='mine']").count -eq 10) 'Loss reveals all mines'
Assert ((Browser get attr '.mine-face' aria-label).value -match 'dead') 'Loss shows the dead face'
$timer = Evaluate "document.querySelectorAll('output')[1].getAttribute('aria-label')"
Evaluate 'new Promise(resolve => setTimeout(resolve, 1200))' | Out-Null
Assert ((Evaluate "document.querySelectorAll('output')[1].getAttribute('aria-label')") -eq $timer) 'Timer stops after loss'
Capture 'loss'
Menu Expert
Assert ((Browser get count '.mine-cell').count -eq 480) 'Expert has 30 by 16 cells'
Capture 'expert'
Browser reload | Out-Null
Launch
Assert ((Browser get count '.mine-cell').count -eq 480) 'Expert survives reload and relaunch'
Capture 'expert-restarted'
Menu Intermediate
Assert ((Browser get count '.mine-cell').count -eq 256) 'Intermediate has 16 by 16 cells'
Menu 'Custom...'
Browser find role textbox fill --name Height 99 | Out-Null
Browser find role textbox fill --name Width 99 | Out-Null
Browser find role textbox fill --name Mines 999 | Out-Null
Browser find role button click --name OK --exact | Out-Null
Assert (Evaluate "const p=JSON.parse(localStorage.getItem('win95.minesweeper')); p.custom.width===30 && p.custom.height===24 && p.custom.mines===667") 'Custom clamps to 30 by 24 with 667 mines'
Capture 'custom-clamped'
Menu Beginner
foreach ($index in 0..10) { RightClick $index }
Assert (Evaluate "document.querySelector('output').getAttribute('aria-label') === 'Mines left: -1'") 'Mine counter can go negative'
Capture 'negative-counter'
RightClick 0
Assert ((Browser get attr (Cell 0) aria-label).value -match 'question') 'A flag cycles to a question mark'
Capture 'question-mark'
RightClick 0
Assert ((Browser get attr (Cell 0) aria-label).value -match 'hidden') 'A question mark cycles to blank'
Menu 'Marks (?)'
RightClick 1
Assert ((Browser get attr (Cell 1) aria-label).value -match 'hidden') 'Disabling Marks skips the question mark'
Menu Color
Assert ((Browser get count '.mine-monochrome').count -eq 1) 'Color toggles monochrome mode'
Capture 'monochrome'
Browser find role button click --name Help --exact | Out-Null
Browser find role menuitem click --name 'About Minesweeper' --exact | Out-Null
Capture 'about'
Browser find role button click --name OK --exact | Out-Null
Menu Exit
Assert ((Browser get count '.minesweeper').count -eq 0) 'Exit closes Minesweeper'
