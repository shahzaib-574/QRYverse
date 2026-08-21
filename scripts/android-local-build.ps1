param(
  [ValidateSet('assembleDebug', 'bundleRelease')]
  [string]$Task = 'assembleDebug'
)

$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$toolsRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot '.tools'))
$sdkRoot = Join-Path $toolsRoot 'android-sdk'
$jdkMatches = @(Get-ChildItem -LiteralPath (Join-Path $toolsRoot 'jdk21') -Filter javac.exe -Recurse -ErrorAction Stop | Where-Object { $_.FullName -match '\\bin\\javac\.exe$' })

if ($jdkMatches.Count -ne 1) { throw "Expected one workspace JDK, found $($jdkMatches.Count)." }
$jdkRoot = Split-Path -Parent (Split-Path -Parent $jdkMatches[0].FullName)
if (-not (Test-Path -LiteralPath (Join-Path $sdkRoot 'platforms\android-36\android.jar'))) { throw 'Workspace Android API 36 is not installed.' }
if (-not $jdkRoot.StartsWith($toolsRoot, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected JDK path.' }
if (-not $sdkRoot.StartsWith($toolsRoot, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected Android SDK path.' }

$env:JAVA_HOME = $jdkRoot
$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot

Push-Location $projectRoot
try {
  & npm.cmd run android:sync
  if ($LASTEXITCODE -ne 0) { throw "Capacitor sync failed with exit code $LASTEXITCODE." }
  Push-Location (Join-Path $projectRoot 'android')
  try {
    & .\gradlew.bat $Task --stacktrace
    if ($LASTEXITCODE -ne 0) { throw "Gradle $Task failed with exit code $LASTEXITCODE." }
  } finally {
    Pop-Location
  }
} finally {
  Pop-Location
}
