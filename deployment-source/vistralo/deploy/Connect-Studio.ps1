param(
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-zA-Z0-9.-]+$')][string]$ServerHost,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-zA-Z0-9_.-]+$')][string]$Username,
  [ValidateRange(1,65535)][int]$Port = 22
)
$ErrorActionPreference = 'Stop'
Get-Command ssh -ErrorAction Stop | Out-Null
Write-Host 'Keep the SSH window open while using the studio. Verify the host fingerprint on first connection.'
Start-Process ssh -ArgumentList @('-N','-T','-o','ExitOnForwardFailure=yes','-o','ServerAliveInterval=30','-p',"$Port",'-L','127.0.0.1:8787:127.0.0.1:8787',"$Username@$ServerHost")
Start-Process 'http://127.0.0.1:8787'
Write-Host 'If the page opens before SSH connects, refresh it after signing in to SSH.'
