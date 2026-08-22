[CmdletBinding()]
param(
  [string]$ApkPath = 'android/app/build/outputs/apk/debug/app-debug.apk',
  [ValidateSet('Debug', 'Production')]
  [string]$ArtifactProfile = 'Debug',
  [string[]]$ExpectedAbis = @('arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'),
  [string]$ExpectedAdmobAppId,
  [string]$ExpectedAdmobBannerId,
  [string]$ExpectedSignerSha256,
  [string]$SdkRoot,
  [string]$BuildToolsVersion = '35.0.0'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$googleTestPublisher = 'ca-app-pub-3940256099942544'
$googleTestAppId = "$googleTestPublisher~3347511713"
$googleTestBannerId = "$googleTestPublisher/9214589741"
$expectedPackage = 'com.royal.qrystudio'
$failures = New-Object 'System.Collections.Generic.List[string]'

if (-not $ExpectedAdmobAppId) { $ExpectedAdmobAppId = $env:QRY_ADMOB_APP_ID }
if (-not $ExpectedAdmobBannerId) { $ExpectedAdmobBannerId = $env:VITE_ADMOB_BANNER_ID }
if (-not $ExpectedSignerSha256) { $ExpectedSignerSha256 = $env:QRY_EXPECTED_APK_CERT_SHA256 }

function Add-Pass([string]$Message) {
  Write-Host "[PASS] $Message"
}

function Add-Failure([string]$Message) {
  $null = $failures.Add($Message)
  Write-Host "[FAIL] $Message"
}

function Resolve-AuditPath([string]$Value) {
  if ([System.IO.Path]::IsPathRooted($Value)) {
    return [System.IO.Path]::GetFullPath($Value)
  }
  return [System.IO.Path]::GetFullPath((Join-Path $projectRoot $Value))
}

function Read-ZipEntryBytes([System.IO.Compression.ZipArchiveEntry]$Entry) {
  $stream = $Entry.Open()
  $memory = New-Object System.IO.MemoryStream
  try {
    $stream.CopyTo($memory)
    return ,$memory.ToArray()
  } finally {
    $memory.Dispose()
    $stream.Dispose()
  }
}

function Read-ElfUnsigned(
  [byte[]]$Bytes,
  [long]$Offset,
  [ValidateSet(2, 4, 8)][int]$Size,
  [bool]$LittleEndian
) {
  if ($Offset -lt 0 -or $Offset + $Size -gt $Bytes.LongLength) {
    throw "ELF field at offset $Offset with size $Size is outside the file."
  }

  $segment = New-Object byte[] $Size
  [System.Array]::Copy($Bytes, $Offset, $segment, 0, $Size)
  if ([System.BitConverter]::IsLittleEndian -ne $LittleEndian) {
    [System.Array]::Reverse($segment)
  }

  switch ($Size) {
    2 { return [System.BitConverter]::ToUInt16($segment, 0) }
    4 { return [System.BitConverter]::ToUInt32($segment, 0) }
    8 { return [System.BitConverter]::ToUInt64($segment, 0) }
  }
}

function Get-Elf64Info([System.IO.Compression.ZipArchiveEntry]$Entry) {
  [byte[]]$bytes = Read-ZipEntryBytes $Entry
  if ($bytes.Length -lt 64) { throw 'ELF64 header is truncated.' }
  if ($bytes[0] -ne 0x7F -or $bytes[1] -ne 0x45 -or $bytes[2] -ne 0x4C -or $bytes[3] -ne 0x46) {
    throw 'File does not contain an ELF header.'
  }
  if ($bytes[4] -ne 2) { throw "Expected ELF64 class 2, found class $($bytes[4])." }
  if ($bytes[5] -notin @(1, 2)) { throw "Unsupported ELF byte order $($bytes[5])." }

  $littleEndian = $bytes[5] -eq 1
  [uint16]$machine = Read-ElfUnsigned $bytes 18 2 $littleEndian
  [uint64]$programHeaderOffset = Read-ElfUnsigned $bytes 32 8 $littleEndian
  [uint16]$programHeaderSize = Read-ElfUnsigned $bytes 54 2 $littleEndian
  [uint16]$programHeaderCount = Read-ElfUnsigned $bytes 56 2 $littleEndian
  if ($programHeaderSize -lt 56) { throw "ELF64 program header size $programHeaderSize is invalid." }
  if ($programHeaderCount -eq 0) { throw 'ELF64 file has no program headers.' }

  $loadSegments = New-Object 'System.Collections.Generic.List[object]'
  for ($index = 0; $index -lt $programHeaderCount; $index += 1) {
    [uint64]$headerOffset = $programHeaderOffset + ([uint64]$index * $programHeaderSize)
    if ($headerOffset + $programHeaderSize -gt [uint64]$bytes.LongLength) {
      throw "ELF64 program header $index is truncated."
    }
    [uint32]$programType = Read-ElfUnsigned $bytes ([long]$headerOffset) 4 $littleEndian
    if ($programType -eq 1) {
      $null = $loadSegments.Add([pscustomobject]@{
        Offset = [uint64](Read-ElfUnsigned $bytes ([long]($headerOffset + 8)) 8 $littleEndian)
        VirtualAddress = [uint64](Read-ElfUnsigned $bytes ([long]($headerOffset + 16)) 8 $littleEndian)
        Alignment = [uint64](Read-ElfUnsigned $bytes ([long]($headerOffset + 48)) 8 $littleEndian)
      })
    }
  }
  if ($loadSegments.Count -eq 0) { throw 'ELF64 file has no PT_LOAD segments.' }
  return [pscustomobject]@{
    Machine = $machine
    LoadSegments = @($loadSegments.ToArray())
  }
}

$resolvedApk = Resolve-AuditPath $ApkPath
if (-not (Test-Path -LiteralPath $resolvedApk -PathType Leaf)) {
  throw "APK not found: $resolvedApk"
}

$sdkCandidates = @()
if ($SdkRoot) { $sdkCandidates += $SdkRoot }
$sdkCandidates += (Join-Path $projectRoot '.tools/android-sdk')
if ($env:ANDROID_SDK_ROOT) { $sdkCandidates += $env:ANDROID_SDK_ROOT }
if ($env:ANDROID_HOME) { $sdkCandidates += $env:ANDROID_HOME }

$resolvedSdk = $null
foreach ($candidate in $sdkCandidates) {
  if (-not $candidate) { continue }
  $candidateRoot = [System.IO.Path]::GetFullPath($candidate)
  $candidateBuildTools = Join-Path $candidateRoot "build-tools/$BuildToolsVersion"
  if ((Test-Path -LiteralPath (Join-Path $candidateBuildTools 'zipalign.exe') -PathType Leaf) -and
      (Test-Path -LiteralPath (Join-Path $candidateBuildTools 'aapt.exe') -PathType Leaf) -and
      (Test-Path -LiteralPath (Join-Path $candidateBuildTools 'apksigner.bat') -PathType Leaf)) {
    $resolvedSdk = $candidateRoot
    break
  }
}
if (-not $resolvedSdk) {
  throw "Android SDK Build Tools $BuildToolsVersion with zipalign.exe, aapt.exe, and apksigner.bat were not found."
}

$buildToolsRoot = Join-Path $resolvedSdk "build-tools/$BuildToolsVersion"
$zipalign = Join-Path $buildToolsRoot 'zipalign.exe'
$aapt = Join-Path $buildToolsRoot 'aapt.exe'
$apksigner = Join-Path $buildToolsRoot 'apksigner.bat'

$jdkCandidates = @()
$workspaceJdk = Join-Path $projectRoot '.tools/jdk21'
if (Test-Path -LiteralPath $workspaceJdk -PathType Container) {
  $workspaceJavaMatches = @(Get-ChildItem -LiteralPath $workspaceJdk -Filter java.exe -Recurse -ErrorAction Stop | Where-Object { $_.FullName -match '\\bin\\java\.exe$' })
  if ($workspaceJavaMatches.Count -eq 1) {
    $jdkCandidates += (Split-Path -Parent (Split-Path -Parent $workspaceJavaMatches[0].FullName))
  }
}
if ($env:JAVA_HOME) { $jdkCandidates += $env:JAVA_HOME }
$jdkRoot = @($jdkCandidates | Where-Object { $_ } | ForEach-Object { [System.IO.Path]::GetFullPath($_) } | Where-Object { Test-Path -LiteralPath (Join-Path $_ 'bin\java.exe') -PathType Leaf } | Select-Object -First 1)
if ($jdkRoot.Count -eq 0) { throw 'A JDK was not found in .tools/jdk21 or JAVA_HOME; apksigner verification cannot run.' }
$env:JAVA_HOME = $jdkRoot[0]

Write-Host "Auditing $resolvedApk"
Write-Host "Profile: $ArtifactProfile; Build Tools: $BuildToolsVersion"

$zipalignOutput = @(& $zipalign -c -P 16 4 $resolvedApk 2>&1)
if ($LASTEXITCODE -eq 0) {
  Add-Pass 'APK native-library ZIP offsets are 16 KiB aligned.'
} else {
  Add-Failure "zipalign -c -P 16 failed: $($zipalignOutput -join ' ')"
}

$signingOutput = @(& $apksigner verify --verbose --print-certs $resolvedApk 2>&1)
$signingExitCode = $LASTEXITCODE
$signingText = $signingOutput -join "`n"
if ($signingExitCode -ne 0) {
  Add-Failure "APK signature verification failed: $($signingOutput -join ' ')"
} else {
  $v2Verified = $signingText -match '(?m)^Verified using v2 scheme \(APK Signature Scheme v2\): true\s*$'
  $v3Verified = $signingText -match '(?m)^Verified using v3 scheme \(APK Signature Scheme v3\): true\s*$'
  if ($v2Verified -or $v3Verified) { Add-Pass 'APK has a verified v2-or-newer signature.' } else { Add-Failure 'APK must have a verified v2-or-newer signature.' }

  $signerCountMatch = [regex]::Match($signingText, '(?m)^Number of signers: (\d+)\s*$')
  if ($signerCountMatch.Success -and $signerCountMatch.Groups[1].Value -eq '1') { Add-Pass 'APK has exactly one signer.' } else { Add-Failure 'APK must have exactly one signer.' }

  $certificateDigestMatches = [regex]::Matches($signingText, '(?m)^Signer #\d+ certificate SHA-256 digest: ([0-9a-fA-F]{64})\s*$')
  $certificateDnMatch = [regex]::Match($signingText, '(?m)^Signer #1 certificate DN: (.+?)\s*$')
  $certificateDigest = if ($certificateDigestMatches.Count -eq 1) { $certificateDigestMatches[0].Groups[1].Value.ToUpperInvariant() } else { $null }
  $certificateDn = if ($certificateDnMatch.Success) { $certificateDnMatch.Groups[1].Value } else { '' }
  if (-not $certificateDigest) { Add-Failure "Expected one signer certificate SHA-256 digest, found $($certificateDigestMatches.Count)." }

  if ($ArtifactProfile -eq 'Debug') {
    if ($certificateDn -match '(?:^|,)\s*CN=Android Debug(?:,|$)') { Add-Pass 'Debug APK uses an Android Debug certificate.' } else { Add-Failure "Debug APK signer must be an Android Debug certificate; found '$certificateDn'." }
  } else {
    if ($certificateDn -notmatch '(?:^|,)\s*CN=Android Debug(?:,|$)') { Add-Pass 'Production APK does not use an Android Debug certificate.' } else { Add-Failure 'Production APK must not use an Android Debug certificate.' }
    $normalizedExpectedSigner = ($ExpectedSignerSha256 -replace '[:\s]', '').ToUpperInvariant()
    if ($normalizedExpectedSigner -notmatch '^[0-9A-F]{64}$') {
      Add-Failure 'Production audit requires a 64-hex ExpectedSignerSha256 value (or QRY_EXPECTED_APK_CERT_SHA256).'
    } elseif ($certificateDigest -and $certificateDigest -eq $normalizedExpectedSigner) {
      Add-Pass 'Production signer certificate matches the pinned SHA-256 digest.'
    } else {
      Add-Failure 'Production signer certificate does not match the pinned SHA-256 digest.'
    }
  }
}

$badgingOutput = @(& $aapt dump badging $resolvedApk 2>&1)
if ($LASTEXITCODE -ne 0) { throw "aapt dump badging failed: $($badgingOutput -join ' ')" }
$badgingText = $badgingOutput -join "`n"

$packageMatch = [regex]::Match($badgingText, "(?m)^package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'[^`n]*compileSdkVersion='([^']+)'")
if (-not $packageMatch.Success) {
  Add-Failure 'Could not parse package, version, and compile SDK from APK badging.'
} else {
  $packageName = $packageMatch.Groups[1].Value
  if ($packageName -eq $expectedPackage) { Add-Pass "Package ID is $packageName." } else { Add-Failure "Expected package $expectedPackage, found $packageName." }
  if ($packageMatch.Groups[4].Value -eq '36') { Add-Pass 'Compile SDK is API 36.' } else { Add-Failure "Expected compile SDK 36, found $($packageMatch.Groups[4].Value)." }
  Write-Host "[INFO] Version $($packageMatch.Groups[3].Value) ($($packageMatch.Groups[2].Value))"
}

$minimumMatch = [regex]::Match($badgingText, "(?m)^sdkVersion:'([^']+)'")
$targetMatch = [regex]::Match($badgingText, "(?m)^targetSdkVersion:'([^']+)'")
if ($minimumMatch.Success -and $minimumMatch.Groups[1].Value -eq '24') { Add-Pass 'Minimum SDK is API 24.' } else { Add-Failure 'Expected minimum SDK API 24.' }
if ($targetMatch.Success -and $targetMatch.Groups[1].Value -eq '36') { Add-Pass 'Target SDK is API 36.' } else { Add-Failure 'Expected target SDK API 36.' }

$isDebuggable = $badgingText -match '(?m)^application-debuggable\s*$'
if ($ArtifactProfile -eq 'Debug') {
  if ($isDebuggable) { Add-Pass 'Debug artifact is debuggable.' } else { Add-Failure 'Debug artifact is not marked debuggable.' }
} else {
  if (-not $isDebuggable) { Add-Pass 'Production artifact is not debuggable.' } else { Add-Failure 'Production artifact must not be debuggable.' }
}

$manifestOutput = @(& $aapt dump xmltree $resolvedApk AndroidManifest.xml 2>&1)
if ($LASTEXITCODE -ne 0) { throw "aapt dump xmltree failed: $($manifestOutput -join ' ')" }

$manifestPermissions = New-Object 'System.Collections.Generic.List[string]'
$admobDeclarations = New-Object 'System.Collections.Generic.List[string]'
for ($index = 0; $index -lt $manifestOutput.Count; $index += 1) {
  $elementMatch = [regex]::Match($manifestOutput[$index], '^(\s*)E: ([^\s]+)\b')
  if (-not $elementMatch.Success) { continue }
  $elementIndent = $elementMatch.Groups[1].Value.Length
  $elementName = $elementMatch.Groups[2].Value
  if ($elementName -notmatch '^uses-permission(?:-sdk-\d+)?$' -and $elementName -ne 'meta-data') { continue }

  $androidName = $null
  $androidValue = $null
  for ($childIndex = $index + 1; $childIndex -lt $manifestOutput.Count; $childIndex += 1) {
    $nextElementMatch = [regex]::Match($manifestOutput[$childIndex], '^(\s*)E: ')
    if ($nextElementMatch.Success -and $nextElementMatch.Groups[1].Value.Length -le $elementIndent) { break }
    $nameMatch = [regex]::Match($manifestOutput[$childIndex], '^\s*A: android:name(?:\([^)]*\))?="([^"]+)"')
    if ($nameMatch.Success) { $androidName = $nameMatch.Groups[1].Value }
    $valueMatch = [regex]::Match($manifestOutput[$childIndex], '^\s*A: android:value(?:\([^)]*\))?="([^"]+)"')
    if ($valueMatch.Success) { $androidValue = $valueMatch.Groups[1].Value }
  }

  if ($elementName -match '^uses-permission') {
    if ($androidName) { $null = $manifestPermissions.Add($androidName) } else { Add-Failure "Merged $elementName element is missing android:name." }
  } elseif ($androidName -eq 'com.google.android.gms.ads.APPLICATION_ID') {
    $null = $admobDeclarations.Add([string]$androidValue)
  }
}

$actualPermissions = @($manifestPermissions | Sort-Object -Unique)
$expectedPermissions = @(
  'android.permission.CAMERA',
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.VIBRATE',
  'com.google.android.gms.permission.AD_ID',
  'android.permission.ACCESS_ADSERVICES_AD_ID',
  'android.permission.ACCESS_ADSERVICES_ATTRIBUTION',
  'android.permission.ACCESS_ADSERVICES_TOPICS',
  'android.permission.WAKE_LOCK',
  'android.permission.FOREGROUND_SERVICE',
  "$expectedPackage.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION"
)
$unexpectedPermissions = @($actualPermissions | Where-Object { $_ -notin $expectedPermissions })
$missingPermissions = @($expectedPermissions | Where-Object { $_ -notin $actualPermissions })
if ($unexpectedPermissions.Count -eq 0 -and $missingPermissions.Count -eq 0) {
  Add-Pass "Merged permission set matches the reviewed $($expectedPermissions.Count)-permission allowlist."
} else {
  if ($unexpectedPermissions.Count -gt 0) { Add-Failure "Unexpected merged permissions: $($unexpectedPermissions -join ', ')" }
  if ($missingPermissions.Count -gt 0) { Add-Failure "Reviewed permissions missing from the merged artifact: $($missingPermissions -join ', ')" }
}
if ($actualPermissions -contains 'com.android.vending.BILLING') {
  Add-Failure 'Google Play Billing permission is forbidden in the v1 launch artifact.'
} else {
  Add-Pass 'Google Play Billing permission is absent.'
}

$manifestAdmobId = if ($admobDeclarations.Count -eq 1) { $admobDeclarations[0] } else { $null }
if (-not $manifestAdmobId) {
  Add-Failure "Expected exactly one AdMob application-ID metadata declaration with a literal value, found $($admobDeclarations.Count)."
} elseif ($ArtifactProfile -eq 'Debug') {
  if ($manifestAdmobId -eq $googleTestAppId) { Add-Pass "Debug manifest uses Google's official test AdMob App ID ($manifestAdmobId)." } else { Add-Failure "Debug manifest must use Google's official test AdMob App ID; found $manifestAdmobId." }
} else {
  if ($ExpectedAdmobAppId -notmatch '^ca-app-pub-\d{16}~\d{10}$' -or $ExpectedAdmobAppId.StartsWith($googleTestPublisher, [System.StringComparison]::Ordinal)) {
    Add-Failure 'Production audit requires a valid non-test ExpectedAdmobAppId (or QRY_ADMOB_APP_ID).'
  } elseif ($manifestAdmobId -eq $ExpectedAdmobAppId) {
    Add-Pass "Production manifest App ID exactly matches the pinned value ($manifestAdmobId)."
  } else {
    Add-Failure "Production manifest App ID does not match the pinned value; found $manifestAdmobId."
  }
}

$archive = [System.IO.Compression.ZipFile]::OpenRead($resolvedApk)
try {
  $nativeEntries = @($archive.Entries | Where-Object { $_.FullName -match '^lib/([^/]+)/([^/]+\.so)$' })
  if ($nativeEntries.Count -eq 0) {
    Add-Failure 'APK contains no native libraries; expected ML Kit scanner libraries.'
  } else {
    $actualAbis = @($nativeEntries | ForEach-Object { ([regex]::Match($_.FullName, '^lib/([^/]+)/')).Groups[1].Value } | Sort-Object -Unique)
    $missingAbis = @($expectedAbis | Where-Object { $_ -notin $actualAbis })
    $unexpectedAbis = @($actualAbis | Where-Object { $_ -notin $expectedAbis })
    if ($missingAbis.Count -eq 0 -and $unexpectedAbis.Count -eq 0) {
      Add-Pass "Native libraries cover the reviewed ABIs: $($actualAbis -join ', ')."
    } else {
      if ($missingAbis.Count -gt 0) { Add-Failure "Missing expected native ABIs: $($missingAbis -join ', ')" }
      if ($unexpectedAbis.Count -gt 0) { Add-Failure "Unreviewed native ABIs: $($unexpectedAbis -join ', ')" }
    }

    foreach ($pair in @(@('armeabi-v7a', 'arm64-v8a'), @('x86', 'x86_64'))) {
      if ($pair[0] -in $ExpectedAbis -and $pair[1] -notin $ExpectedAbis) {
        Add-Failure "Expected ABI contract contains $($pair[0]) without its required 64-bit partner $($pair[1])."
        continue
      }
      if ($pair[0] -notin $ExpectedAbis -or $pair[1] -notin $ExpectedAbis) { continue }
      $leftNames = @($nativeEntries | Where-Object { $_.FullName -like "lib/$($pair[0])/*" } | ForEach-Object { $_.Name } | Sort-Object -Unique)
      $rightNames = @($nativeEntries | Where-Object { $_.FullName -like "lib/$($pair[1])/*" } | ForEach-Object { $_.Name } | Sort-Object -Unique)
      $missingRight = @($leftNames | Where-Object { $_ -notin $rightNames })
      $missingLeft = @($rightNames | Where-Object { $_ -notin $leftNames })
      if ($missingRight.Count -eq 0 -and $missingLeft.Count -eq 0) {
        Add-Pass "$($pair[0]) and $($pair[1]) contain matching native-library sets."
      } else {
        if ($missingRight.Count -gt 0) { Add-Failure "$($pair[1]) is missing 64-bit partners for: $($missingRight -join ', ')" }
        if ($missingLeft.Count -gt 0) { Add-Failure "$($pair[0]) is missing 32-bit partners for: $($missingLeft -join ', ')" }
      }
    }

    $compressedNative = @($nativeEntries | Where-Object { $_.CompressedLength -ne $_.Length })
    if ($compressedNative.Count -eq 0) { Add-Pass 'All native libraries are stored uncompressed for direct loading.' } else { Add-Failure "Compressed native libraries require packaging review: $($compressedNative.FullName -join ', ')" }

    foreach ($entry in $nativeEntries | Where-Object { $_.FullName -match '^lib/(arm64-v8a|x86_64)/' } | Sort-Object FullName) {
      try {
        $elfInfo = Get-Elf64Info $entry
        $abi = ([regex]::Match($entry.FullName, '^lib/([^/]+)/')).Groups[1].Value
        [uint16]$expectedMachine = if ($abi -eq 'arm64-v8a') { 183 } else { 62 }
        if ($elfInfo.Machine -eq $expectedMachine) {
          Add-Pass "$($entry.FullName) ELF e_machine matches $abi ($expectedMachine)."
        } else {
          Add-Failure "$($entry.FullName) ELF e_machine is $($elfInfo.Machine); expected $expectedMachine for $abi."
        }

        $segmentIssues = New-Object 'System.Collections.Generic.List[string]'
        foreach ($segment in $elfInfo.LoadSegments) {
          [uint64]$alignment = $segment.Alignment
          if ($alignment -lt 0x4000) { $null = $segmentIssues.Add(('p_align 0x{0:X} is below 0x4000' -f $alignment)); continue }
          if (($alignment -band ($alignment - [uint64]1)) -ne 0) { $null = $segmentIssues.Add(('p_align 0x{0:X} is not a power of two' -f $alignment)); continue }
          if (($segment.Offset % $alignment) -ne ($segment.VirtualAddress % $alignment)) {
            $null = $segmentIssues.Add(('p_offset 0x{0:X} and p_vaddr 0x{1:X} are not congruent modulo 0x{2:X}' -f $segment.Offset, $segment.VirtualAddress, $alignment))
          }
        }
        $rendered = @($elfInfo.LoadSegments | ForEach-Object { '0x{0:X}' -f $_.Alignment }) -join ', '
        if ($segmentIssues.Count -eq 0) {
          Add-Pass "$($entry.FullName) PT_LOAD segments have power-of-two 16 KiB+ alignment and congruent offsets ($rendered)."
        } else {
          Add-Failure "$($entry.FullName) has invalid PT_LOAD segments: $($segmentIssues -join '; ')."
        }
      } catch {
        Add-Failure "$($entry.FullName) could not be audited as ELF64: $($_.Exception.Message)"
      }
    }
  }

  $profileEntry = $archive.GetEntry('assets/public/qry-build-profile.json')
  if (-not $profileEntry) {
    Add-Failure 'Packaged qry-build-profile.json is missing.'
  } else {
    $reader = New-Object System.IO.StreamReader($profileEntry.Open(), [System.Text.Encoding]::UTF8)
    try { $buildProfile = ConvertFrom-Json ($reader.ReadToEnd()) } finally { $reader.Dispose() }
    if ($buildProfile.schemaVersion -eq 1 -and $buildProfile.mode -eq 'production' -and $buildProfile.cloudEnabled -eq $false) {
      Add-Pass 'Packaged build profile is production-mode and cloud-off.'
    } else {
      Add-Failure 'Packaged build profile must use schema 1, production mode, and cloud-off v1.'
    }

    $bannerId = [string]$buildProfile.admobBannerId
    $consentGeography = [string]$buildProfile.admobConsentDebugGeography
    $consentTestDevicesConfigured = $buildProfile.admobConsentTestDevicesConfigured
    if ($consentGeography -in @('DISABLED', 'EEA', 'US', 'OTHER')) {
      Add-Pass "Packaged UMP consent geography is recognized ($consentGeography)."
    } else {
      Add-Failure "Packaged UMP consent geography is invalid or missing ($consentGeography)."
    }

    if ($ArtifactProfile -eq 'Debug') {
      if ($buildProfile.admobTestMode -eq $true) { Add-Pass 'Debug web profile keeps AdMob test mode enabled.' } else { Add-Failure 'Debug web profile must keep AdMob test mode enabled.' }
      if ($buildProfile.admobBannerConfigured -eq $false -and -not $bannerId) {
        Add-Pass 'Debug web profile uses the built-in Google test banner fallback.'
      } elseif ($buildProfile.admobBannerConfigured -eq $true -and $bannerId -eq $googleTestBannerId) {
        Add-Pass "Debug web profile explicitly uses Google's official test banner ID ($bannerId)."
      } else {
        Add-Failure 'Debug web profile must use no configured banner or an official Google test banner ID.'
      }
      if ($consentGeography -eq 'DISABLED' -and $consentTestDevicesConfigured -eq $false) {
        Add-Pass 'Debug web profile does not force UMP geography or consent test devices.'
      } elseif ($consentGeography -ne 'DISABLED' -and $consentTestDevicesConfigured -eq $true) {
        Add-Pass 'Debug web profile pairs forced UMP geography with configured test devices.'
      } else {
        Add-Failure 'Forced UMP geography requires configured test devices; otherwise both debug overrides must be disabled.'
      }
    } else {
      if ($buildProfile.admobTestMode -eq $false) { Add-Pass 'Production web profile disables AdMob test mode.' } else { Add-Failure 'Production web profile must explicitly disable AdMob test mode.' }
      if ($ExpectedAdmobBannerId -notmatch '^ca-app-pub-\d{16}/\d{10}$' -or $ExpectedAdmobBannerId.StartsWith($googleTestPublisher, [System.StringComparison]::Ordinal)) {
        Add-Failure 'Production audit requires a valid non-test ExpectedAdmobBannerId (or VITE_ADMOB_BANNER_ID).'
      } elseif ($buildProfile.admobBannerConfigured -eq $true -and $bannerId -eq $ExpectedAdmobBannerId) {
        Add-Pass "Production web profile banner ID exactly matches the pinned value ($bannerId)."
      } else {
        Add-Failure "Production web profile banner ID does not match the pinned value; found $bannerId."
      }
      if ($consentGeography -eq 'DISABLED' -and $consentTestDevicesConfigured -eq $false) {
        Add-Pass 'Production web profile disables UMP debug geography and test-device overrides.'
      } else {
        Add-Failure 'Production web profile must disable UMP debug geography and test-device overrides.'
      }
      if ($manifestAdmobId -and $bannerId -and $manifestAdmobId.Contains('~') -and $bannerId.Contains('/')) {
        $appPublisher = $manifestAdmobId.Substring(0, $manifestAdmobId.IndexOf('~'))
        $bannerPublisher = $bannerId.Substring(0, $bannerId.IndexOf('/'))
        if ($appPublisher -eq $bannerPublisher) { Add-Pass 'Production AdMob App ID and banner ID use the same publisher.' } else { Add-Failure 'Production AdMob App ID and banner ID use different publishers.' }
      }
    }
  }
} finally {
  $archive.Dispose()
}

if ($failures.Count -gt 0) {
  Write-Host ''
  Write-Host "Android binary audit failed with $($failures.Count) issue(s):"
  foreach ($failure in $failures) { Write-Host " - $failure" }
  throw 'Android binary audit failed.'
}

$sha256 = [System.Security.Cryptography.SHA256]::Create()
$apkStream = [System.IO.File]::OpenRead($resolvedApk)
try {
  $hash = -join @($sha256.ComputeHash($apkStream) | ForEach-Object { $_.ToString('X2') })
} finally {
  $apkStream.Dispose()
  $sha256.Dispose()
}
Write-Host ''
Write-Host "Android binary audit passed: $resolvedApk"
Write-Host "SHA-256: $hash"
