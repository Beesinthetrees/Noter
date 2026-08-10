<#
Sets up a fresh Windows machine to build/run Noter after a git clone.
Installs: Node.js LTS, Rust (via rustup, MSVC toolchain), VS Build Tools (C++ workload),
WebView2 runtime, then runs `npm install`.

Usage: open PowerShell in the repo root and run:
    .\setup.ps1

Some installs need an elevated (Run as Administrator) PowerShell. If a step fails
with an access-denied error, re-run this script as Administrator.
#>

$ErrorActionPreference = "Stop"

function Test-Command($name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

if (-not (Test-Command "winget")) {
    Write-Host "winget not found. Install 'App Installer' from the Microsoft Store, then re-run this script." -ForegroundColor Red
    exit 1
}

Write-Host "== Node.js ==" -ForegroundColor Cyan
if (Test-Command "node") {
    Write-Host "node already installed: $(node --version)"
} else {
    winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements
}

Write-Host "== Rust (rustup) ==" -ForegroundColor Cyan
if (Test-Command "rustc") {
    Write-Host "rustc already installed: $(rustc --version)"
} else {
    winget install --id Rustlang.Rustup -e --source winget --accept-package-agreements --accept-source-agreements
    Write-Host "Rust just installed - you'll need a NEW terminal window before 'cargo'/'rustc' resolve on PATH." -ForegroundColor Yellow
}

Write-Host "== Visual Studio Build Tools (C++ workload, required by Tauri) ==" -ForegroundColor Cyan
$vsInstalled = winget list --id Microsoft.VisualStudio.2022.BuildTools -e 2>$null | Select-String "Microsoft.VisualStudio.2022.BuildTools"
if ($vsInstalled) {
    Write-Host "VS Build Tools already installed."
} else {
    winget install --id Microsoft.VisualStudio.2022.BuildTools -e --source winget `
        --accept-package-agreements --accept-source-agreements `
        --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
}

Write-Host "== WebView2 Runtime ==" -ForegroundColor Cyan
winget install --id Microsoft.EdgeWebView2Runtime -e --source winget --accept-package-agreements --accept-source-agreements

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
