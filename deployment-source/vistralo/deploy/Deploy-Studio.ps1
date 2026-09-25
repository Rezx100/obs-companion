param(
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-zA-Z0-9.-]+$')][string]$ServerHost,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-zA-Z0-9_.-]+$')][string]$Username,
  [ValidateRange(1,65535)][int]$Port = 22
)
$ErrorActionPreference = 'Stop'
foreach ($tool in @('ssh','scp','tar')) { Get-Command $tool -ErrorAction Stop | Out-Null }
$sourceRoot = Split-Path -Parent $PSScriptRoot
$releaseName = 'vistralo-' + [Guid]::NewGuid().ToString('N')
$archive = Join-Path ([IO.Path]::GetTempPath()) ($releaseName + '.tar.gz')
$target = "$Username@$ServerHost"
try {
  # Build an explicit source-only payload. Never transmit server login credentials.
  & tar -czf $archive -C $sourceRoot --exclude=runtime.env --exclude=image-receipt.json --exclude=.env --exclude=.env.* package.json package-lock.json LICENSE src server-ui deploy docs
  if ($LASTEXITCODE -ne 0) { throw 'Could not package source.' }
  & ssh -p $Port $target 'test ! -e vistralo-server && test ! -e obs-companion-server || { echo "vistralo-server already exists; refusing to overwrite it"; exit 1; }; command -v docker >/dev/null && docker compose version >/dev/null'
  if ($LASTEXITCODE -ne 0) { throw 'Server preflight failed. No existing deployment was changed.' }
  & scp -P $Port $archive "${target}:${releaseName}.tar.gz"
  if ($LASTEXITCODE -ne 0) { throw 'Upload failed.' }
  # Inputs interpolated below are a generated alphanumeric release name only.
  $remoteCommand = "set -eu; mkdir vistralo-server; tar -xzf $releaseName.tar.gz -C vistralo-server; rm $releaseName.tar.gz; bash vistralo-server/deploy/install.sh"
  & ssh -t -p $Port $target $remoteCommand
  if ($LASTEXITCODE -ne 0) { throw 'Installation did not pass. Inspect the server output; source files remain for diagnosis.' }
  Write-Host 'Installation command succeeded. Native OBS recording and workload checks still need verification.'
  Write-Host 'Retrieve VISTRALO_TOKEN privately from ~/vistralo-server/deploy/runtime.env, then use Connect-Studio.ps1.'
} finally {
  Remove-Item -LiteralPath $archive -Force -ErrorAction SilentlyContinue
}
