<#
Sets up a fresh Windows machine to build/run Noter after a git clone.
Installs: Node.js LTS, Rust (via rustup, MSVC toolchain), VS Build Tools (C++ workload),
WebView2 runtime, then runs `npm install`.

Usage: open PowerShell in the repo root and run:
    .\setup.ps1

Requires an elevated (Run as Administrator) PowerShell — the VS Build Tools
installer needs to self-elevate, and a non-admin terminal can't show the UAC
prompt it waits on, which makes the script hang indefinitely.
#>

$ErrorActionPreference = "Stop"

function Test-Command($name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

# Runs a background job and prints an elapsed-time heartbeat, since installers
# (winget, the VS Build Tools bootstrapper, vs_installer repair) print nothing
# to the terminal for long stretches. ScriptBlock must return an object with
# Output and ExitCode properties.
function Invoke-JobWithHeartbeat($Activity, [scriptblock]$ScriptBlock, $ArgumentList) {
    $job = Start-Job -ScriptBlock $ScriptBlock -ArgumentList $ArgumentList

    $start = Get-Date
    while ($job.State -eq "Running") {
        $elapsed = (Get-Date) - $start
        Write-Host ("`r{0}: {1:hh\:mm\:ss} elapsed (still working, this can take a while)   " -f $Activity, $elapsed) -NoNewline -ForegroundColor DarkGray
        Start-Sleep -Seconds 5
    }
    Write-Host ""

    $result = Receive-Job -Job $job
    Remove-Job -Job $job
    return $result
}

function Invoke-WingetInstall($Activity, [string[]]$WingetArgs) {
    $result = Invoke-JobWithHeartbeat $Activity {
        param($wingetArgs)
        $output = & winget @wingetArgs 2>&1 | Out-String
        [PSCustomObject]@{ Output = $output; ExitCode = $LASTEXITCODE }
    } (, $WingetArgs)

    if ($result.ExitCode -ne 0) {
        if ($result.Output -match "No applicable update found|No available upgrade found") {
            Write-Host "$Activity - already installed via winget, nothing newer available." -ForegroundColor Yellow
            return
        }
        Write-Host $result.Output
        Write-Host "$Activity failed (exit code $($result.ExitCode))." -ForegroundColor Red
        exit $result.ExitCode
    }
}

if (-not (Test-Command "winget")) {
    Write-Host "winget not found. Install 'App Installer' from the Microsoft Store, then re-run this script." -ForegroundColor Red
    exit 1
}

$isElevated = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isElevated) {
    Write-Host "This script must run in an elevated (Run as Administrator) PowerShell." -ForegroundColor Red
    Write-Host "The VS Build Tools installer needs to elevate itself, and it will hang indefinitely waiting on a UAC prompt that a non-admin terminal can't show." -ForegroundColor Red
    exit 1
}

Write-Host "== Node.js ==" -ForegroundColor Cyan
if (Test-Command "node") {
    Write-Host "node already installed: $(node --version)"
} else {
    Invoke-WingetInstall "Installing Node.js" @(
        "install", "--id", "OpenJS.NodeJS.LTS", "-e", "--source", "winget",
        "--accept-package-agreements", "--accept-source-agreements"
    )
}

Write-Host "== Rust (rustup) ==" -ForegroundColor Cyan
if (Test-Command "rustc") {
    Write-Host "rustc already installed: $(rustc --version)"
} else {
    Invoke-WingetInstall "Installing Rust (rustup)" @(
        "install", "--id", "Rustlang.Rustup", "-e", "--source", "winget",
        "--accept-package-agreements", "--accept-source-agreements"
    )
    Write-Host "Rust just installed - you'll need a NEW terminal window before 'cargo'/'rustc' resolve on PATH." -ForegroundColor Yellow
}

Write-Host "== Visual Studio Build Tools (C++ workload, required by Tauri) ==" -ForegroundColor Cyan
# Check for an actual link.exe under the instance's VCTools install, not just
# whether vswhere/winget metadata says the workload is "installed" - a prior
# interrupted install can leave the workload marked as selected while its
# files never finished copying, which would otherwise false-positive forever.
$vswhere = "C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe"
$vsInstallPath = $null
if (Test-Path $vswhere) {
    $vsInstallPath = & $vswhere -products * -requires Microsoft.VisualStudio.Workload.VCTools -property installationPath | Select-Object -First 1
}
$linkExe = $null
if ($vsInstallPath) {
    $linkExe = Get-ChildItem -Path (Join-Path $vsInstallPath "VC\Tools\MSVC\*\bin\Hostx64\x64\link.exe") -ErrorAction SilentlyContinue | Select-Object -First 1
}

if ($linkExe) {
    Write-Host "VS Build Tools C++ workload already installed ($($linkExe.FullName))."
} else {
    if ($vsInstallPath) {
        Write-Host "VS instance found at $vsInstallPath but link.exe is missing." -ForegroundColor Yellow
    }
    Write-Host "This is the big one - a few GB, typically 10-30 min depending on your connection." -ForegroundColor DarkGray
    Write-Host "A separate VS installer window with its own progress bar should also appear (check your taskbar if you don't see it)." -ForegroundColor DarkGray
    # includeRecommended matters here: the actual compiler/linker toolset
    # (Microsoft.VisualStudio.Component.VC.Tools.x86.x64, which is what
    # contains link.exe) ships as a *recommended* component of the VCTools
    # workload, not a required one - --add alone silently installs everything
    # else (IDE shell, SDKs, extensions) but skips the compiler itself.
    Invoke-WingetInstall "Installing VS Build Tools" @(
        "install", "--id", "Microsoft.VisualStudio.2022.BuildTools", "-e", "--source", "winget",
        "--accept-package-agreements", "--accept-source-agreements", "--force",
        "--override", "--passive --wait --norestart --add Microsoft.VisualStudio.Workload.VCTools;includeRecommended"
    )
}

Write-Host "== WebView2 Runtime ==" -ForegroundColor Cyan
Invoke-WingetInstall "Installing WebView2 Runtime" @(
    "install", "--id", "Microsoft.EdgeWebView2Runtime", "-e", "--source", "winget",
    "--accept-package-agreements", "--accept-source-agreements"
)

Write-Host "== npm install ==" -ForegroundColor Cyan
if (Test-Command "npm") {
    npm install
} else {
    Write-Host "npm not on PATH yet - open a new terminal window and run 'npm install' in this folder." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Setup complete." -ForegroundColor Green
Write-Host "If Node/Rust were freshly installed, close this terminal, open a new one, cd into the repo, and run:" -ForegroundColor Yellow
Write-Host "    npm install   (if it didn't run above)"
Write-Host "    npm run tauri:dev"
