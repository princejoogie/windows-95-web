param(
  [string]$Session = 'accessories',
  [string]$Proof = 'D:\codes\worktrees\windows-95-web\proof\accessories'
)
$ErrorActionPreference = 'Stop'
function Invoke-Browser {
  & agent-browser --session $Session @args
  if ($LASTEXITCODE -ne 0) { throw "agent-browser failed: $args" }
}
function Read-JavaScript([string]$Script) {
  $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Script))
  $response = Invoke-Browser eval -b $encoded --json | ConvertFrom-Json
  return $response.data.result
}
function Read-Canvas { Read-JavaScript 'document.querySelector("canvas").toDataURL()' }
function Wait-JavaScript([string]$Script) {
  $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Script))
  Invoke-Browser wait --fn "eval(atob('$encoded'))" | Out-Null
}
function Click-Button([string]$Name) { Invoke-Browser find role button click --name $Name --exact | Out-Null }
function Draw-Stroke([int]$X1, [int]$Y1, [int]$X2, [int]$Y2) {
  $box = (Invoke-Browser get box canvas --json | ConvertFrom-Json).data
  Invoke-Browser mouse move ($box.x + $X1) ($box.y + $Y1) | Out-Null
  Invoke-Browser mouse down | Out-Null
  Invoke-Browser mouse move ($box.x + $X2) ($box.y + $Y2) --steps 12 | Out-Null
  Invoke-Browser mouse up | Out-Null
}
function Assert-Equal($Actual, $Expected, [string]$Message) {
  if ($Actual -cne $Expected) { throw $Message }
  Write-Output "PASS $Message"
}
function Assert-Draws([string]$Tool, [int]$X1, [int]$Y1, [int]$X2, [int]$Y2) {
  $before = Read-Canvas
  Click-Button $Tool
  Draw-Stroke $X1 $Y1 $X2 $Y2
  if ((Read-Canvas) -ceq $before) { throw "$Tool did not change any pixels" }
  Write-Output "PASS $Tool draws"
}
New-Item -ItemType Directory -Force -Path $Proof | Out-Null
Click-Button File
Invoke-Browser find role menuitem click --name 'New Ctrl+N' --exact | Out-Null
if (Read-JavaScript 'Array.from(document.querySelectorAll("button")).some(b => b.textContent === "No")') { Click-Button No }
Click-Button 'Color #000000'
Click-Button 'Width 3'
Assert-Draws Pencil 20 20 110 60
Click-Button 'Color #0000ff'
Click-Button 'Width 8'
Assert-Draws Brush 20 80 115 110
Click-Button 'Color #800000'
Click-Button 'Width 3'
Assert-Draws Line 145 20 230 100
Click-Button 'Color #000000'
Assert-Draws Rectangle 260 20 400 100
Click-Button 'Color #ff0000'
Assert-Draws Ellipse 145 125 240 205
Click-Button 'Color #ffff00'
Assert-Draws 'Fill With Color' 280 50 280 50
Invoke-Browser screenshot (Join-Path $Proof 'paint-drawing.png') | Out-Null
$art = Read-Canvas
Click-Button File
Invoke-Browser find role menuitem click --name 'Save As...' --exact | Out-Null
Invoke-Browser find role textbox fill --name 'File name:' 'art.bmp' | Out-Null
Click-Button Save
if (Read-JavaScript 'Array.from(document.querySelectorAll("button")).some(b => b.textContent === "Yes")') { Click-Button Yes }
Wait-JavaScript 'document.querySelector("[role=application]").getAttribute("aria-label") === "art.bmp - Paint"'
Wait-JavaScript 'Object.values(JSON.parse(localStorage.getItem("w95.fs.v1")).nodes).find(n => n.name === "art.bmp")?.content === document.querySelector("canvas").toDataURL()'
$stored = Read-JavaScript 'Object.values(JSON.parse(localStorage.getItem("w95.fs.v1")).nodes).find(n => n.name === "art.bmp")?.content'
Assert-Equal $stored $art 'Saved PNG data URL equals the drawn canvas'
Invoke-Browser screenshot (Join-Path $Proof 'paint-saved.png') | Out-Null
Click-Button Close
Click-Button Start
Invoke-Browser find role menuitem hover --name Programs --exact | Out-Null
Invoke-Browser wait --text Accessories | Out-Null
Invoke-Browser find role menuitem hover --name Accessories --exact | Out-Null
Invoke-Browser wait --text Paint | Out-Null
Invoke-Browser find role menuitem click --name Paint --exact | Out-Null
Click-Button File
Invoke-Browser find role menuitem click --name 'Open... Ctrl+O' --exact | Out-Null
Invoke-Browser find role textbox fill --name 'File name:' 'art.bmp' | Out-Null
Click-Button Open
Wait-JavaScript 'document.querySelector("[role=application]").getAttribute("aria-label") === "art.bmp - Paint"'
Assert-Equal (Read-Canvas) $art 'Reopened canvas data URL equals saved image'
Invoke-Browser screenshot (Join-Path $Proof 'paint-reopened.png') | Out-Null
Click-Button Pencil
Click-Button 'Color #000000'
$steps = @($art)
for ($i = 0; $i -lt 3; $i++) {
  Draw-Stroke (20 + $i * 30) 230 (30 + $i * 30) 250
  $steps += Read-Canvas
}
for ($i = 2; $i -ge 0; $i--) {
  Invoke-Browser press Control+z | Out-Null
  Assert-Equal (Read-Canvas) $steps[$i] "Undo restores stroke state $i exactly"
  Invoke-Browser screenshot (Join-Path $Proof "paint-undo-$i.png") | Out-Null
}
for ($i = 1; $i -le 3; $i++) {
  Invoke-Browser press Control+y | Out-Null
  Assert-Equal (Read-Canvas) $steps[$i] "Repeat restores stroke state $i exactly"
}
for ($i = 0; $i -lt 3; $i++) { Invoke-Browser press Control+z | Out-Null }
Assert-Equal (Read-Canvas) $art 'Verification leaves the saved image intact'
