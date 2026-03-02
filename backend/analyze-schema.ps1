# PowerShell script to run the database schema analyzer
# This script navigates to the backend directory, activates the virtual environment,
# and runs the analyze_schema.py script

$ErrorActionPreference = "Stop"

# Get the script directory (backend folder)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = $ScriptDir
$VenvActivateScript = Join-Path $BackendDir ".venv\Scripts\Activate.ps1"
$PythonScript = Join-Path $BackendDir "analyze_schema.py"

# Check if we're already in the backend directory
$CurrentDir = Get-Location
if ($CurrentDir.Path -ne $BackendDir) {
    Write-Host "Navigating to backend directory: $BackendDir" -ForegroundColor Cyan
    Set-Location $BackendDir
}

# Check if virtual environment exists
if (-not (Test-Path $VenvActivateScript)) {
    Write-Error "Virtual environment not found at: $VenvActivateScript`nPlease create the virtual environment first."
    exit 1
}

# Check if Python script exists
if (-not (Test-Path $PythonScript)) {
    Write-Error "Python script not found at: $PythonScript"
    exit 1
}

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Cyan
& $VenvActivateScript

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to activate virtual environment"
    exit 1
}

# Run the Python script
Write-Host "Running database schema analyzer..." -ForegroundColor Cyan
Write-Host ""
python analyze_schema.py

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to run analyze_schema.py"
    exit 1
}

Write-Host ""
Write-Host "Schema analysis complete!" -ForegroundColor Green

