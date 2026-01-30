# Node.js packaging script

Write-Host "Packaging Chrome extension with Node.js..." -ForegroundColor Green

# Check if Node.js is installed
$nodeInstalled = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeInstalled) {
    Write-Error "Node.js is not installed. Please install Node.js first."
    Write-Host "Visit https://nodejs.org to download and install." -ForegroundColor Yellow
    exit 1
}

# Check if package.json exists in the parent directory
$parentDir = Split-Path -Parent $PSScriptRoot
$packageJsonPath = Join-Path $parentDir "package.json"

if (!(Test-Path $packageJsonPath)) {
    Write-Error "package.json file not found in project root."
    exit 1
}

Write-Host "Installing project dependencies..." -ForegroundColor Yellow
Push-Location $parentDir
try {
    npm install
    Write-Host "Starting to package Chrome extension..." -ForegroundColor Yellow
    npm run build
} finally {
    Pop-Location
}

Write-Host "Node.js packaging completed!" -ForegroundColor Green
Write-Host "Output files are in pack/out directory" -ForegroundColor Cyan