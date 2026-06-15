$backendDir = ".\backend"

# Check if backend directory exists
if (-Not (Test-Path $backendDir)) {
    Write-Host "Backend directory not found at $backendDir" -ForegroundColor Red
    exit 1
}

# Get all directories in the backend folder
$services = Get-ChildItem -Path $backendDir -Directory

foreach ($service in $services) {
    $servicePath = $service.FullName
    $reqPath = Join-Path -Path $servicePath -ChildPath "requirements.txt"
    $venvPython = Join-Path -Path $servicePath -ChildPath "venv\Scripts\python.exe"

    Write-Host "Checking service: $($service.Name)" -ForegroundColor Cyan

    if (Test-Path $reqPath) {
        if (Test-Path $venvPython) {
            Write-Host "  [INSTALL] Installing dependencies from requirements.txt..." -ForegroundColor Green
            
            # Change to service directory
            Push-Location -Path $servicePath
            try {
                # We use the python executable inside the venv directly
                & $venvPython -m pip install -r requirements.txt
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "  [SUCCESS] Successfully installed dependencies." -ForegroundColor Green
                } else {
                    Write-Host "  [ERROR] Failed to install dependencies." -ForegroundColor Red
                }
            } catch {
                Write-Host "  [ERROR] Exception installing dependencies: $_" -ForegroundColor Red
            } finally {
                Pop-Location
            }
        } else {
            Write-Host "  [ERROR] Virtual environment python not found at $venvPython. Please create the venv first." -ForegroundColor Red
        }
    } else {
        Write-Host "  [SKIP] No requirements.txt found." -ForegroundColor Yellow
    }
}

Write-Host "`nFinished installing dependencies for all backend services." -ForegroundColor Cyan
