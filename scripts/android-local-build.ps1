param(
  [ValidateSet('clean', 'verifyDebug', 'assembleDebug', 'assembleDebugAndroidTest', 'bundleRelease', 'lintDebug', 'testDebugUnitTest')]
  [string]$Task = 'assembleDebug'
)

$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$toolsRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot '.tools'))
$workspaceJdk = Join-Path $toolsRoot 'jdk21'
$workspaceSdk = Join-Path $toolsRoot 'android-sdk'
$requiredBuildToolsVersion = '35.0.0'
$requiresBinaryAudit = $Task -eq 'verifyDebug'

$jdkRoot = $null
if (Test-Path -LiteralPath $workspaceJdk -PathType Container) {
  $jdkMatches = @(Get-ChildItem -LiteralPath $workspaceJdk -Filter javac.exe -Recurse -ErrorAction Stop | Where-Object { $_.FullName -match '\\bin\\javac\.exe$' })
  if ($jdkMatches.Count -ne 1) { throw "Expected one workspace JDK, found $($jdkMatches.Count)." }
  $jdkRoot = Split-Path -Parent (Split-Path -Parent $jdkMatches[0].FullName)
} elseif ($env:JAVA_HOME) {
  $candidateJdk = [System.IO.Path]::GetFullPath($env:JAVA_HOME)
  if (Test-Path -LiteralPath (Join-Path $candidateJdk 'bin\javac.exe') -PathType Leaf) { $jdkRoot = $candidateJdk }
}
if (-not $jdkRoot) { throw 'JDK 21 was not found in .tools or JAVA_HOME.' }
$jdkRelease = Join-Path $jdkRoot 'release'
if (-not (Test-Path -LiteralPath $jdkRelease -PathType Leaf) -or (Get-Content -LiteralPath $jdkRelease -Raw) -notmatch '(?m)^JAVA_VERSION="21(?:\.|\")') {
  throw 'QRYverse Android verification requires JDK 21.'
}

$sdkRoot = @($workspaceSdk, $env:ANDROID_SDK_ROOT, $env:ANDROID_HOME) |
  Where-Object { $_ } |
  ForEach-Object { [System.IO.Path]::GetFullPath($_) } |
  Where-Object {
    (Test-Path -LiteralPath (Join-Path $_ 'platforms\android-36\android.jar') -PathType Leaf) -and (
      -not $requiresBinaryAudit -or (
        (Test-Path -LiteralPath (Join-Path $_ "build-tools\$requiredBuildToolsVersion\zipalign.exe") -PathType Leaf) -and
        (Test-Path -LiteralPath (Join-Path $_ "build-tools\$requiredBuildToolsVersion\aapt.exe") -PathType Leaf) -and
        (Test-Path -LiteralPath (Join-Path $_ "build-tools\$requiredBuildToolsVersion\apksigner.bat") -PathType Leaf)
      )
    )
  } |
  Select-Object -First 1
if (-not $sdkRoot) {
  if ($requiresBinaryAudit) {
    throw "Android SDK API 36 and Build Tools $requiredBuildToolsVersion audit tools were not found in .tools, ANDROID_SDK_ROOT, or ANDROID_HOME."
  }
  throw 'Android SDK API 36 was not found in .tools, ANDROID_SDK_ROOT, or ANDROID_HOME.'
}

$env:JAVA_HOME = $jdkRoot
$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot

Push-Location $projectRoot
try {
  & npm.cmd run android:sync
  if ($LASTEXITCODE -ne 0) { throw "Capacitor sync failed with exit code $LASTEXITCODE." }
  Push-Location (Join-Path $projectRoot 'android')
  try {
    $appTasks = @(if ($Task -eq 'verifyDebug') {
      ':app:assembleDebug', ':app:lintDebug', ':app:testDebugUnitTest', ':app:assembleDebugAndroidTest'
    } else {
      ":app:$Task"
    })
    & .\gradlew.bat @appTasks --stacktrace
    if ($LASTEXITCODE -ne 0) { throw "Gradle $($appTasks -join ', ') failed with exit code $LASTEXITCODE." }
  } finally {
    Pop-Location
  }
  if ($Task -eq 'verifyDebug') {
    & (Join-Path $projectRoot 'scripts\android-binary-audit.ps1') -ArtifactProfile Debug -SdkRoot $sdkRoot -BuildToolsVersion $requiredBuildToolsVersion
  }
} finally {
  Pop-Location
}
