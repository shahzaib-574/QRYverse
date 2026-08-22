[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string[]]$ArtifactPath,

  [string]$OutputDirectory = 'output/ci-artifact-evidence',

  [switch]$RequireCleanTrackedTree
)

$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$projectRootWithSeparator = $projectRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar

function Resolve-ProjectPath([string]$Value, [switch]$RequireLeaf) {
  $resolved = if ([System.IO.Path]::IsPathRooted($Value)) {
    [System.IO.Path]::GetFullPath($Value)
  } else {
    [System.IO.Path]::GetFullPath((Join-Path $projectRoot $Value))
  }

  if (-not $resolved.StartsWith($projectRootWithSeparator, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Path must stay inside the project root: $Value"
  }
  if ($RequireLeaf -and -not (Test-Path -LiteralPath $resolved -PathType Leaf)) {
    throw "Artifact was not found: $resolved"
  }
  return $resolved
}

function Get-ProjectRelativePath([string]$ResolvedPath) {
  return $ResolvedPath.Substring($projectRootWithSeparator.Length).Replace([System.IO.Path]::DirectorySeparatorChar, '/')
}

function Get-Sha256([string]$ResolvedPath) {
  return (Get-FileHash -LiteralPath $ResolvedPath -Algorithm SHA256).Hash.ToUpperInvariant()
}

function Invoke-Git([string[]]$Arguments) {
  # Avoid machine-global excludes so provenance depends only on repository state.
  $output = @(& git.exe -c 'core.excludesFile=' @Arguments 2>&1)
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Arguments -join ' ') failed: $($output -join ' ')"
  }
  return @($output)
}

Push-Location $projectRoot
try {
  $trackedStatus = @(Invoke-Git @('status', '--porcelain=v1', '--untracked-files=no'))
  $trackedTreeClean = $trackedStatus.Count -eq 0
  if ($RequireCleanTrackedTree -and -not $trackedTreeClean) {
    throw "Tracked files changed during verification:`n$($trackedStatus -join [Environment]::NewLine)"
  }

  $revisionOutput = @(Invoke-Git @('rev-parse', '--verify', 'HEAD'))
  $treeOutput = @(Invoke-Git @('rev-parse', '--verify', 'HEAD^{tree}'))
  $revision = [string]$revisionOutput[0]
  $tree = [string]$treeOutput[0]

  $artifactEntries = New-Object 'System.Collections.Generic.List[object]'
  $seenPaths = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
  foreach ($value in $ArtifactPath) {
    $resolvedArtifact = Resolve-ProjectPath $value -RequireLeaf
    $relativeArtifact = Get-ProjectRelativePath $resolvedArtifact
    if (-not $seenPaths.Add($relativeArtifact)) {
      throw "Artifact path was supplied more than once: $relativeArtifact"
    }
    $file = Get-Item -LiteralPath $resolvedArtifact -ErrorAction Stop
    $null = $artifactEntries.Add([ordered]@{
      path = $relativeArtifact
      bytes = [long]$file.Length
      sha256 = Get-Sha256 $resolvedArtifact
    })
  }

  $inputPaths = @(
    'package-lock.json'
    'requirements-ci.txt'
    'android/gradle/wrapper/gradle-wrapper.properties'
    'android/gradle/wrapper/gradle-wrapper.jar'
  )
  $inputEntries = New-Object 'System.Collections.Generic.List[object]'
  foreach ($value in $inputPaths) {
    $resolvedInput = Resolve-ProjectPath $value -RequireLeaf
    $input = Get-Item -LiteralPath $resolvedInput -ErrorAction Stop
    $null = $inputEntries.Add([ordered]@{
      path = Get-ProjectRelativePath $resolvedInput
      bytes = [long]$input.Length
      sha256 = Get-Sha256 $resolvedInput
    })
  }

  $nodeVersion = [string](& node.exe --version)
  if ($LASTEXITCODE -ne 0) { throw 'Could not determine the Node.js version.' }
  $npmVersion = [string](& npm.cmd --version)
  if ($LASTEXITCODE -ne 0) { throw 'Could not determine the npm version.' }

  $evidence = [ordered]@{
    schemaVersion = 1
    source = [ordered]@{
      revision = $revision.Trim()
      tree = $tree.Trim()
      trackedTreeClean = $trackedTreeClean
    }
    toolchain = [ordered]@{
      node = $nodeVersion.Trim()
      npm = $npmVersion.Trim()
      operatingSystem = [System.Environment]::OSVersion.VersionString
      processArchitecture = [System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture.ToString()
    }
    buildInputs = @($inputEntries.ToArray())
    artifacts = @($artifactEntries.ToArray())
    github = [ordered]@{
      workflow = [string]$env:GITHUB_WORKFLOW
      runId = [string]$env:GITHUB_RUN_ID
      runAttempt = [string]$env:GITHUB_RUN_ATTEMPT
      ref = [string]$env:GITHUB_REF
    }
  }

  $resolvedOutput = Resolve-ProjectPath $OutputDirectory
  $null = New-Item -ItemType Directory -Path $resolvedOutput -Force
  $jsonPath = Join-Path $resolvedOutput 'artifact-evidence.json'
  $sumsPath = Join-Path $resolvedOutput 'SHA256SUMS.txt'
  $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
  $json = $evidence | ConvertTo-Json -Depth 8
  [System.IO.File]::WriteAllText($jsonPath, $json + [Environment]::NewLine, $utf8WithoutBom)

  $sumLines = @($artifactEntries | Sort-Object { $_.path } | ForEach-Object { "$($_.sha256)  $($_.path)" })
  [System.IO.File]::WriteAllText($sumsPath, ($sumLines -join [Environment]::NewLine) + [Environment]::NewLine, $utf8WithoutBom)

  $roundTrip = Get-Content -LiteralPath $jsonPath -Raw | ConvertFrom-Json
  if ($roundTrip.schemaVersion -ne 1 -or @($roundTrip.artifacts).Count -ne $artifactEntries.Count) {
    throw 'Artifact evidence JSON did not survive round-trip validation.'
  }

  Write-Host "Artifact evidence written to $(Get-ProjectRelativePath $jsonPath)"
  foreach ($artifact in $artifactEntries) {
    Write-Host "[SHA-256] $($artifact.sha256)  $($artifact.path)"
  }
} finally {
  Pop-Location
}
