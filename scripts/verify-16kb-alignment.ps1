<#
.SYNOPSIS
    Verifies that all native .so libraries in an Android build are aligned to 16 KB page boundaries.

.DESCRIPTION
    Android 15 (Pixel 9 Pro, etc.) uses 16 KB memory pages. Every .so shipped in an APK must have
    ELF LOAD segments aligned to at least 0x4000 (16384 bytes). Libraries aligned only to 0x1000
    (4 KB) trigger compatibility warnings and will be rejected by the Play Store starting Nov 2025.

    This script locates llvm-readelf.exe from the Android NDK, walks every architecture subdirectory
    in the merged_native_libs build output, parses each .so's program headers, and reports any
    LOAD segment with an alignment less than 0x4000.

    Specific "tracked culprit" libraries (the originally flagged offenders) are highlighted in the
    per-arch output so you can scan results quickly.

.PARAMETER Variant
    Build variant to verify. Defaults to 'debug'. Use 'release' after a release build.

.PARAMETER LibPath
    Optional explicit path to the merged_native_libs lib directory. Overrides Variant when set.

.EXAMPLE
    .\verify-16kb-alignment.ps1
    Verifies the debug build at the default merged_native_libs location.

.EXAMPLE
    .\verify-16kb-alignment.ps1 -Variant release
    Verifies the release build.

.EXAMPLE
    .\verify-16kb-alignment.ps1 -LibPath 'D:\my-build\lib'
    Verifies an arbitrary lib directory containing arch subfolders.

.NOTES
    Exit codes:
        0 - all libraries pass
        1 - one or more libraries fail
        2 - llvm-readelf.exe not found
        3 - native libs directory not found
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$Variant = 'debug',

    [Parameter(Mandatory = $false)]
    [string]$LibPath
)

$ErrorActionPreference = 'Stop'

# -------------------------------------------------------------------------------------------------
# Constants
# -------------------------------------------------------------------------------------------------

$ProjectRoot       = Split-Path -Parent $PSScriptRoot  # scripts/ -> repo root
$RequiredAlignment = 0x4000  # 16 KB

# Google's 16 KB requirement applies only to 64-bit ABIs. 32-bit devices use 4 KB
# pages and are unaffected, so misalignments on these are reported as informational
# and do not affect the exit code.
$SixtyFourBitArchs = @('arm64-v8a', 'x86_64')

# Libraries originally flagged by the Play Store warning panel — highlighted in output.
$TrackedCulprits = @(
    'libargon2native.so',
    'libargon2jni.so',
    'libworklets.so',
    'libmapbox-common.so',
    'libmapbox-maps.so',
    'libnative-filters.so',
    'libreact_codegen_rnsvg.so',
    'libavif_android.so',
    'libexpo-modules-core.so',
    'libappmodules.so',
    'libreactnative.so',
    'libhermestooling.so',
    'libc++_shared.so'
)

# -------------------------------------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------------------------------------

function Compare-SemverFolder {
    <#
        Sort key for NDK version folders such as "27.2.12479018" or "26.1.10909125".
        Returns a [version]-compatible object so Sort-Object descending picks the highest.
    #>
    param([string]$Name)

    $parts = $Name -split '\.'
    $padded = @()
    foreach ($p in $parts) {
        $n = 0
        if ([int]::TryParse($p, [ref]$n)) {
            $padded += $n
        } else {
            $padded += 0
        }
    }
    while ($padded.Count -lt 4) { $padded += 0 }
    return [version]::new($padded[0], $padded[1], $padded[2], $padded[3])
}

function Find-LlvmReadelf {
    <#
        Locate llvm-readelf.exe by searching:
          1. $env:ANDROID_NDK_HOME\toolchains\llvm\prebuilt\windows-x86_64\bin\
          2. $env:ANDROID_HOME\ndk\<highest-version>\toolchains\llvm\prebuilt\windows-x86_64\bin\
          3. $env:PATH lookup of llvm-readelf.exe
        Returns the resolved absolute path or $null.
    #>
    $relativeBin = Join-Path 'toolchains' (Join-Path 'llvm' (Join-Path 'prebuilt' (Join-Path 'windows-x86_64' (Join-Path 'bin' 'llvm-readelf.exe'))))

    # 1. ANDROID_NDK_HOME
    if ($env:ANDROID_NDK_HOME) {
        $candidate = Join-Path $env:ANDROID_NDK_HOME $relativeBin
        if (Test-Path -LiteralPath $candidate) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    # 2. ANDROID_HOME\ndk\<version>\...
    if ($env:ANDROID_HOME) {
        $ndkRoot = Join-Path $env:ANDROID_HOME 'ndk'
        if (Test-Path -LiteralPath $ndkRoot) {
            $versionDirs = Get-ChildItem -LiteralPath $ndkRoot -Directory -ErrorAction SilentlyContinue |
                Sort-Object -Property @{ Expression = { Compare-SemverFolder -Name $_.Name } } -Descending

            foreach ($vd in $versionDirs) {
                $candidate = Join-Path $vd.FullName $relativeBin
                if (Test-Path -LiteralPath $candidate) {
                    return (Resolve-Path -LiteralPath $candidate).Path
                }
            }
        }
    }

    # 3. PATH
    $cmd = Get-Command 'llvm-readelf.exe' -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }

    return $null
}

function Get-LoadAlignments {
    <#
        Run llvm-readelf -l on the given .so and parse out the Align column for every LOAD
        program header. Returns @{ Alignments = @(<uint64>...); Error = $null } on success or
        @{ Alignments = @(); Error = '<reason>' } on failure.

        llvm-readelf -l output for each segment looks like:

            Type           Offset   VirtAddr           PhysAddr           FileSiz  MemSiz   Flg Align
            LOAD           0x000000 0x0000000000000000 0x0000000000000000 0x12a3c4 0x12a3c4 R   0x4000
            LOAD           0x12b000 0x000000000012f000 0x000000000012f000 0x05a210 0x05a210 R E 0x4000
            ...

        Multiple lines can be LOAD segments; flags column (Flg) is space-separated and variable
        in width, so we treat the LAST whitespace-delimited token on a LOAD line as the alignment.
    #>
    param(
        [Parameter(Mandatory = $true)][string]$ReadelfPath,
        [Parameter(Mandatory = $true)][string]$SoPath
    )

    $alignments = @()
    try {
        # Call llvm-readelf; capture both streams so a parse failure surfaces.
        $output = & $ReadelfPath -l $SoPath 2>&1
        if ($LASTEXITCODE -ne 0) {
            return @{
                Alignments = @()
                Error      = "llvm-readelf exited with code $LASTEXITCODE"
            }
        }

        foreach ($line in $output) {
            $text = [string]$line
            # Match LOAD program-header rows. Anchor on the word LOAD with surrounding whitespace
            # to avoid catching e.g. PT_GNU_RELRO mentions in other tools.
            if ($text -match '^\s*LOAD\b') {
                $tokens = ($text -split '\s+') | Where-Object { $_ -ne '' }
                if ($tokens.Count -lt 2) { continue }

                # The Align column is always the last hex token on the row.
                $alignToken = $tokens[-1]
                if ($alignToken -match '^0x[0-9a-fA-F]+$') {
                    $alignValue = [Convert]::ToUInt64($alignToken.Substring(2), 16)
                    $alignments += $alignValue
                }
            }
        }

        if ($alignments.Count -eq 0) {
            return @{
                Alignments = @()
                Error      = 'no LOAD segments parsed from llvm-readelf output'
            }
        }

        return @{ Alignments = $alignments; Error = $null }
    } catch {
        return @{
            Alignments = @()
            Error      = $_.Exception.Message
        }
    }
}

function Format-Hex {
    param([Parameter(Mandatory = $true)][uint64]$Value)
    return ('0x{0:x}' -f $Value)
}

# -------------------------------------------------------------------------------------------------
# Main
# -------------------------------------------------------------------------------------------------

Write-Host ''
Write-Host '=== Android 16 KB Page Alignment Verification ===' -ForegroundColor Cyan
Write-Host ''

# Step 1: locate llvm-readelf
$readelf = Find-LlvmReadelf
if (-not $readelf) {
    Write-Host '[FAIL] Could not locate llvm-readelf.exe.' -ForegroundColor Red
    Write-Host ''
    Write-Host 'Install the Android NDK and either:' -ForegroundColor Yellow
    Write-Host '  - Set $env:ANDROID_NDK_HOME to the NDK root, or'
    Write-Host '  - Set $env:ANDROID_HOME so <ANDROID_HOME>\ndk\<version>\toolchains\llvm\prebuilt\windows-x86_64\bin\llvm-readelf.exe exists, or'
    Write-Host '  - Place llvm-readelf.exe on your PATH.'
    exit 2
}
Write-Host ('Using llvm-readelf : {0}' -f $readelf) -ForegroundColor DarkGray

# Step 2: locate merged_native_libs directory
# AGP 8.x layout: intermediates/merged_native_libs/<variant>/merge<Variant>NativeLibs/out/lib
# AGP 7.x layout: intermediates/merged_native_libs/<variant>/out/lib
# We try the AGP 8.x path first, fall back to AGP 7.x.
$variantTitle = if ($Variant.Length -gt 0) {
    $Variant.Substring(0, 1).ToUpperInvariant() + $Variant.Substring(1)
} else {
    'Debug'
}

if (-not $LibPath) {
    $intermediatesRoot = Join-Path $ProjectRoot (Join-Path 'android' (Join-Path 'app' (Join-Path 'build' (Join-Path 'intermediates' 'merged_native_libs'))))
    $agp8Path = Join-Path $intermediatesRoot (Join-Path $Variant (Join-Path "merge${variantTitle}NativeLibs" (Join-Path 'out' 'lib')))
    $agp7Path = Join-Path $intermediatesRoot (Join-Path $Variant (Join-Path 'out' 'lib'))
    if (Test-Path -LiteralPath $agp8Path) {
        $LibPath = $agp8Path
    } elseif (Test-Path -LiteralPath $agp7Path) {
        $LibPath = $agp7Path
    } else {
        $LibPath = $agp8Path  # used for the failure message
    }
}

if (-not (Test-Path -LiteralPath $LibPath)) {
    Write-Host ('[FAIL] Native libs directory not found: {0}' -f $LibPath) -ForegroundColor Red
    Write-Host ''
    Write-Host 'Build the Android project first, e.g.:' -ForegroundColor Yellow
    Write-Host '  npx expo run:android'
    Write-Host '  # or:'
    Write-Host ('  cd android; .\gradlew assemble{0}' -f $variantTitle)
    exit 3
}

$resolvedLibPath = (Resolve-Path -LiteralPath $LibPath).Path
Write-Host ('Scanning lib path  : {0}' -f $resolvedLibPath) -ForegroundColor DarkGray
Write-Host ('Variant            : {0}' -f $Variant) -ForegroundColor DarkGray
Write-Host ('Required alignment : {0} ({1} KB)' -f (Format-Hex -Value ([uint64]$RequiredAlignment)), ($RequiredAlignment / 1024)) -ForegroundColor DarkGray
Write-Host ''

# Step 3: walk arch subdirectories
$archDirs = Get-ChildItem -LiteralPath $resolvedLibPath -Directory -ErrorAction SilentlyContinue
if (-not $archDirs -or $archDirs.Count -eq 0) {
    Write-Host ('[FAIL] No architecture subdirectories found in {0}' -f $resolvedLibPath) -ForegroundColor Red
    exit 3
}

$totalChecked  = 0
$totalPassed   = 0   # OK on any arch
$totalIgnored  = 0   # 4 KB on 32-bit arch (not subject to Google's rule)
$failedLibs    = @()  # 4 KB on 64-bit arch (real failures)

foreach ($archDir in $archDirs) {
    $is64Bit = $SixtyFourBitArchs -contains $archDir.Name
    $archLabel = if ($is64Bit) { '64-bit, enforced' } else { '32-bit, informational' }
    Write-Host ('--- {0}  ({1}) ---' -f $archDir.Name, $archLabel) -ForegroundColor Cyan

    $soFiles = Get-ChildItem -LiteralPath $archDir.FullName -Filter '*.so' -File -ErrorAction SilentlyContinue |
        Sort-Object Name

    if (-not $soFiles -or $soFiles.Count -eq 0) {
        Write-Host '  (no .so files)' -ForegroundColor DarkGray
        Write-Host ''
        continue
    }

    foreach ($so in $soFiles) {
        $totalChecked++
        $isTracked = $TrackedCulprits -contains $so.Name
        $trackedTag = if ($isTracked) { ' [tracked culprit]' } else { '' }

        $result = Get-LoadAlignments -ReadelfPath $readelf -SoPath $so.FullName

        if ($result.Error) {
            $msg = '  [FAIL] {0}{1}  (parse error: {2})' -f $so.Name, $trackedTag, $result.Error
            Write-Host $msg -ForegroundColor Red
            if ($is64Bit) { $failedLibs += $so.FullName }
            continue
        }

        $alignList = $result.Alignments
        $offending = $alignList | Where-Object { $_ -lt [uint64]$RequiredAlignment }
        $alignDisplay = ($alignList | ForEach-Object { Format-Hex -Value $_ }) -join ', '

        if ($offending -and $offending.Count -gt 0) {
            $badDisplay = ($offending | ForEach-Object { Format-Hex -Value $_ }) -join ', '
            if ($is64Bit) {
                $failedLibs += $so.FullName
                $msg = '  [FAIL] {0}{1}  LOAD aligns=[{2}]  offending=[{3}]' -f $so.Name, $trackedTag, $alignDisplay, $badDisplay
                Write-Host $msg -ForegroundColor Red
            } else {
                $totalIgnored++
                $msg = '  [INFO] {0}{1}  LOAD aligns=[{2}]  (32-bit, not enforced)' -f $so.Name, $trackedTag, $alignDisplay
                Write-Host $msg -ForegroundColor DarkGray
            }
        } else {
            $totalPassed++
            $msg = '  [OK]   {0}{1}  LOAD aligns=[{2}]' -f $so.Name, $trackedTag, $alignDisplay
            $color = if ($isTracked) { 'Cyan' } else { 'Green' }
            Write-Host $msg -ForegroundColor $color
        }
    }

    Write-Host ''
}

# Step 4: summary
$totalFailed = $failedLibs.Count

Write-Host '=== Summary ===' -ForegroundColor Cyan
Write-Host ('  Libraries checked : {0}' -f $totalChecked)
Write-Host ('  Passed            : {0}' -f $totalPassed) -ForegroundColor Green
if ($totalIgnored -gt 0) {
    Write-Host ('  Ignored (32-bit)  : {0}' -f $totalIgnored) -ForegroundColor DarkGray
}
if ($totalFailed -gt 0) {
    Write-Host ('  Failed (64-bit)   : {0}' -f $totalFailed) -ForegroundColor Red
    Write-Host ''
    Write-Host 'Failed libraries (64-bit only):' -ForegroundColor Red
    foreach ($f in $failedLibs) {
        Write-Host ('  - {0}' -f $f) -ForegroundColor Red
    }
    Write-Host ''
    exit 1
} else {
    Write-Host ('  Failed (64-bit)   : 0') -ForegroundColor Green
    Write-Host ''
    Write-Host '[OK] All 64-bit native libraries are aligned to 16 KB or greater.' -ForegroundColor Green
    exit 0
}
