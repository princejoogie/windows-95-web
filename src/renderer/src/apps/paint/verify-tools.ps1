param(
  [string]$Session = 'accessories',
  [string]$Proof = 'D:\codes\worktrees\windows-95-web\proof\accessories'
)
. (Join-Path $PSScriptRoot 'verify.ps1') -Session $Session -Proof $Proof
function Undo-ToArt([string]$Behavior) {
  if ((Read-Canvas) -ceq $art) { throw "$Behavior did not change any pixels" }
  Invoke-Browser screenshot (Join-Path $Proof "paint-$Behavior.png") | Out-Null
  Invoke-Browser press Control+z | Out-Null
  Assert-Equal (Read-Canvas) $art "$Behavior is undoable"
}
function Set-Background([string]$Color) {
  $script = '(() => { const b = Array.from(document.querySelectorAll("button")).find(b => b.getAttribute("aria-label") === "Color COLOR").getBoundingClientRect(); return { x:b.x+7,y:b.y+7 } })()'.Replace('COLOR', $Color)
  $point = Read-JavaScript $script
  Invoke-Browser mouse move $point.x $point.y | Out-Null
  Invoke-Browser mouse down right | Out-Null
  Invoke-Browser mouse up right | Out-Null
}
Set-Background '#00ff00'
Assert-Equal (Read-JavaScript 'document.querySelector("[role=img][aria-label^=Foreground]").getAttribute("aria-label")') 'Foreground #000000, background #00ff00' 'Right-click changes the background color'
Assert-Draws Eraser 30 25 60 40
Undo-ToArt eraser
Set-Background '#ffffff'
Click-Button 'Pick Color'
Draw-Stroke 280 50 280 50
Assert-Equal (Read-JavaScript 'document.querySelector("[role=img][aria-label^=Foreground]").getAttribute("aria-label")') 'Foreground #ffff00, background #ffffff' 'Pick Color samples the yellow fill'
Click-Button 'Color #000000'
Assert-Draws Airbrush 30 140 100 160
Undo-ToArt airbrush
Assert-Draws 'Rounded Rectangle' 260 140 400 220
Undo-ToArt rounded
Click-Button Select
Draw-Stroke 258 18 402 102
Assert-Equal (Read-Canvas) $art 'Selecting does not alter pixels'
Draw-Stroke 280 50 290 160
Undo-ToArt selection
Click-Button 'Free-Form Select'
$box = (Invoke-Browser get box canvas --json | ConvertFrom-Json).data
Invoke-Browser mouse move ($box.x + 15) ($box.y + 15) | Out-Null
Invoke-Browser mouse down | Out-Null
foreach ($point in @(@(120,15),@(120,80),@(15,80),@(15,15))) {
  Invoke-Browser mouse move ($box.x + $point[0]) ($box.y + $point[1]) --steps 8 | Out-Null
}
Invoke-Browser mouse up | Out-Null
Draw-Stroke 30 30 40 170
Undo-ToArt free-selection
Click-Button Magnifier
Click-Button '4x zoom'
Assert-Equal ((Invoke-Browser get box canvas --json | ConvertFrom-Json).data.width) 1760 'Magnifier enlarges the view four times'
Assert-Equal (Read-Canvas) $art 'Magnifier preserves image pixels'
Click-Button '1x zoom'
Click-Button Text
Draw-Stroke 20 210 20 210
Invoke-Browser find role textbox fill --name 'Text to draw' 'Windows 95' | Out-Null
Click-Button OK
Undo-ToArt text
Click-Button Image
Invoke-Browser find role menuitem click --name 'Flip/Rotate...' --exact | Out-Null
Invoke-Browser find role radio click --name 'Rotate by angle 90' | Out-Null
Click-Button OK
Assert-Equal (Read-JavaScript '[document.querySelector("canvas").width,document.querySelector("canvas").height].join("x")') '280x440' 'Rotation swaps image dimensions'
Undo-ToArt rotation
Click-Button Image
Invoke-Browser find role menuitem click --name 'Invert Colors' --exact | Out-Null
Undo-ToArt invert
Click-Button Image
Invoke-Browser find role menuitem click --name 'Attributes...' --exact | Out-Null
Invoke-Browser find role spinbutton fill --name Width '320' | Out-Null
Invoke-Browser find role spinbutton fill --name Height '240' | Out-Null
Click-Button OK
Assert-Equal (Read-JavaScript '[document.querySelector("canvas").width,document.querySelector("canvas").height].join("x")') '320x240' 'Attributes changes canvas size'
Undo-ToArt attributes
Click-Button Image
Invoke-Browser find role menuitem click --name 'Clear Image' --exact | Out-Null
Assert-Equal (Read-JavaScript 'Array.from(document.querySelector("canvas").getContext("2d").getImageData(0,0,440,280).data).every(channel => channel === 255)') $true 'Clear Image fills the background'
Undo-ToArt clear
