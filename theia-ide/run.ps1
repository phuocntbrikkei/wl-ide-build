# Run Rikkei Ide directly for fast testing (NO installer packaging).
# electron-main logs (e.g. [rikkei-ide-auth] ...) print to THIS terminal.
#   .\run.ps1            -> build extensions + bundle app + run (yarn start)
#   .\run.ps1 -NoBuild   -> skip build, run now
#   .\run.ps1 -Deps      -> yarn install first
param(
    [switch]$NoBuild,
    [switch]$Deps
)
Set-Location $PSScriptRoot

# [0] Restore workspace symlinks -> current location.
$wsMap = @{
    "theia-ide-browser-app"       = "applications\browser"
    "theia-ide-electron-app"      = "applications\electron"
    "theia-ide-next-electron-app" = "applications\electron-next"
    "theia-ide-launcher-ext"      = "theia-extensions\launcher"
    "theia-ide-product-ext"       = "theia-extensions\product"
    "theia-ide-updater-ext"       = "theia-extensions\updater"
}
foreach ($name in $wsMap.Keys) {
    $link = Join-Path "$PSScriptRoot\node_modules" $name
    $target = Join-Path $PSScriptRoot $wsMap[$name]
    if (-not (Test-Path (Join-Path $link "package.json"))) {
        if (Test-Path $link) { Remove-Item $link -Force -Recurse -ErrorAction SilentlyContinue }
        New-Item -ItemType Junction -Path $link -Target $target | Out-Null
        Write-Host "    + relink $name" -ForegroundColor Yellow
    }
}

if ($Deps) {
    Write-Host "[+] yarn install" -ForegroundColor Cyan
    yarn install
}
if (-not $NoBuild) {
    Write-Host "[1/2] build:extensions" -ForegroundColor Cyan
    yarn build:extensions
    if ($LASTEXITCODE -ne 0) { Write-Host "build:extensions FAILED" -ForegroundColor Red; exit 1 }
    Write-Host "[2/2] theia build (bundle)" -ForegroundColor Cyan
    Push-Location "applications\electron"
    npx theia build --app-target="electron"
    $b = $LASTEXITCODE
    Pop-Location
    if ($b -ne 0) { Write-Host "theia build FAILED" -ForegroundColor Red; exit 1 }
}

Write-Host ""
Write-Host "=== RUN Rikkei Ide (yarn start). Logs in this terminal. Ctrl+C to stop. ===" -ForegroundColor Green
Push-Location "applications\electron"
try {
    yarn start
}
finally {
    Pop-Location
}
