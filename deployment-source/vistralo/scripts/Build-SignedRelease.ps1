param(
  [Parameter(Mandatory = $true)][string]$CertificateThumbprint,
  [Parameter(Mandatory = $true)][string]$TimestampUrl
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Invoke-Checked([string]$Command, [string[]]$Arguments) {
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Command failed with exit code $LASTEXITCODE" }
}

$thumbprint = $CertificateThumbprint.Replace(' ', '').ToUpperInvariant()
if ($thumbprint -notmatch '^[0-9A-F]{40}$') { throw 'Specify a 40-character certificate thumbprint.' }
if ($TimestampUrl -notmatch '^https?://') { throw 'Specify an RFC 3161 timestamp URL.' }
$certificate = Get-Item "Cert:\CurrentUser\My\$thumbprint" -ErrorAction Stop
$expectedPublisher = 'Dynamix LTD'
if (-not $certificate.HasPrivateKey) { throw 'The selected certificate has no private signing key.' }
if ($certificate.NotAfter -le (Get-Date)) { throw 'The selected signing certificate has expired.' }
if ($certificate.Subject -notmatch [regex]::Escape($expectedPublisher)) {
  throw "The certificate subject does not identify $expectedPublisher. Verify the legal publisher identity before release."
}
$codeSigningOid = '1.3.6.1.5.5.7.3.3'
$codeSigning = @($certificate.EnhancedKeyUsageList | Where-Object { $_.ObjectId -eq $codeSigningOid })
if ($codeSigning.Count -eq 0) { throw 'The selected certificate is not valid for code signing.' }

$signTool = (Get-Command signtool.exe -ErrorAction Stop).Source
$appRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location $appRoot
try {
  Invoke-Checked 'npm' @('ci')
  Invoke-Checked 'npm' @('test')
  Invoke-Checked 'npm' @('run', 'build:server')
  Invoke-Checked 'npm' @('audit', '--omit=dev')
  Invoke-Checked 'npm' @('run', 'package:win')

  $unpacked = Join-Path $appRoot 'dist\win-unpacked'
  $appExe = Join-Path $unpacked 'Vistralo.exe'
  if (-not (Test-Path $appExe)) { throw 'The Vistralo.exe package is missing.' }
  $binaries = @(Get-ChildItem $unpacked -Recurse -File | Where-Object { $_.Extension -in @('.exe', '.dll', '.node') })
  foreach ($binary in $binaries) {
    $status = (Get-AuthenticodeSignature -FilePath $binary.FullName).Status
    if ($status -eq 'NotSigned') {
      Invoke-Checked $signTool @('sign', '/s', 'My', '/sha1', $thumbprint, '/fd', 'SHA256', '/tr', $TimestampUrl, '/td', 'SHA256', $binary.FullName)
    } elseif ($status -ne 'Valid') {
      throw "Invalid existing signature on $($binary.FullName): $status"
    }
    Invoke-Checked $signTool @('verify', '/pa', '/tw', $binary.FullName)
  }
  $appSignature = Get-AuthenticodeSignature -FilePath $appExe
  if ($appSignature.Status -ne 'Valid' -or $appSignature.SignerCertificate.Thumbprint -ne $thumbprint) {
    throw 'The packaged Vistralo.exe is not validly signed by the selected publisher.'
  }

  Invoke-Checked 'npm' @('run', 'installer:custom')
  $version = (Get-Content (Join-Path $appRoot 'package.json') -Raw | ConvertFrom-Json).version
  $installer = Join-Path $appRoot "dist\Vistralo-$version-Setup.exe"
  if (-not (Test-Path $installer)) { throw 'The installer was not produced.' }
  # The structural verifier checks NSIS payload and CRC before Authenticode appends a signature.
  Invoke-Checked 'python' @('scripts/verify-installer.py')
  Invoke-Checked $signTool @('sign', '/s', 'My', '/sha1', $thumbprint, '/fd', 'SHA256', '/tr', $TimestampUrl, '/td', 'SHA256', $installer)
  Invoke-Checked $signTool @('verify', '/pa', '/tw', $installer)
  $signature = Get-AuthenticodeSignature -FilePath $installer
  if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Thumbprint -ne $thumbprint) {
    throw 'Installer Authenticode verification failed or the signing publisher changed.'
  }
  $hash = (Get-FileHash -Algorithm SHA256 -Path $installer).Hash.ToLowerInvariant()
  Set-Content -Path "$installer.sha256" -Value "$hash  $(Split-Path $installer -Leaf)" -Encoding ascii
  Write-Host "Signed release: $installer"
  Write-Host "SHA-256: $hash"
  Write-Host "Publisher: $($signature.SignerCertificate.Subject)"
} finally {
  Pop-Location
}
