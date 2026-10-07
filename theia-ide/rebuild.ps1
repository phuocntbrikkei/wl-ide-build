# Rebuild Rikkei Ide (Windows) — DÙNG KHI ĐÃ CÓ node_modules + plugins + python + java.
#
# Vì sao không dùng "yarn build" / "yarn package:applications" thẳng:
#   Script gốc của Theia chạy "theia rebuild:electron" (build lại native cho Electron)
#   TRƯỚC khi build/đóng gói. Bước đó đang lỗi trên máy này (thiếu native
#   find-git-repositories) -> chặn cả build lẫn package. Native đã có sẵn trong
#   applications/electron/lib/backend/native nên ta BỎ QUA bước rebuild và gọi thẳng
#   "theia build" + "electron-builder".
#
#   .\rebuild.ps1                 -> build + đóng gói (installer + zip)
#   .\rebuild.ps1 -Deps           -> yarn install trước (khi đổi dependency)
#   .\rebuild.ps1 -Full           -> tải lại plugins/python/java rồi build
#   .\rebuild.ps1 -NativeRebuild  -> chạy theia rebuild:electron (chỉ khi đã sửa được
#                                    toolchain native và ĐỔI native dep)
param(
    [switch]$Deps,
    [switch]$Full,
    [switch]$NativeRebuild
)
Set-Location $PSScriptRoot

function Assert-LastExit($step) {
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n!!! LỖI ở bước: $step (exit $LASTEXITCODE)" -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

Write-Host "=== Rebuild Rikkei Ide ===" -ForegroundColor Green

# [0] Tự khôi phục symlink workspace trong node_modules -> trỏ đúng vị trí HIỆN TẠI.
# (Khi di chuyển thư mục dự án, các junction cũ trỏ sai đường và yarn install không tự sửa,
#  làm "theia build" không resolve được extension + native rebuild ENOENT.)
Write-Host "`n[0] Kiểm tra liên kết workspace" -ForegroundColor Cyan
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
    $ok = $false
    if (Test-Path (Join-Path $link "package.json")) { $ok = $true }
    if (-not $ok) {
        if (Test-Path $link) { Remove-Item $link -Force -Recurse -ErrorAction SilentlyContinue }
        New-Item -ItemType Junction -Path $link -Target $target | Out-Null
        Write-Host "    + tạo lại link $name" -ForegroundColor Yellow
    }
}

if ($Deps -or $Full) {
    Write-Host "`n[+] yarn install" -ForegroundColor Cyan
    yarn install; Assert-LastExit "yarn install"
}
if ($Full) {
    Write-Host "`n[+] Tải plugins / python / java" -ForegroundColor Cyan
    yarn download:plugins; Assert-LastExit "download:plugins"
    yarn download:python;  Assert-LastExit "download:python"
    yarn download:java;    Assert-LastExit "download:java"
}

Write-Host "`n[1/3] Biên dịch extensions (yarn build:extensions)" -ForegroundColor Cyan
yarn build:extensions; Assert-LastExit "build:extensions"

Push-Location "applications\electron"
try {
    if ($NativeRebuild) {
        Write-Host "`n[2/3] theia rebuild:electron (native)" -ForegroundColor Cyan
        yarn rebuild; Assert-LastExit "theia rebuild:electron"
    } else {
        Write-Host "`n[2/3] BỎ QUA theia rebuild:electron (dùng native prebuilt trong lib/backend/native)" -ForegroundColor DarkYellow
    }

    Write-Host "`n[2b] Bundle app (theia build --app-target=electron)" -ForegroundColor Cyan
    npx theia build --app-target="electron"; Assert-LastExit "theia build"

    Write-Host "`n[3/3] Đóng gói electron-builder (nsis + zip)" -ForegroundColor Cyan
    yarn clean:dist; Assert-LastExit "clean:dist"
    # Windows: không cần -c.mac.identity=null (chỉ dành cho mac) và PowerShell tách cờ đó
    # sai khiến electron-builder tưởng ".mac.identity=null" là file config -> ENOENT.
    npx electron-builder --win --publish never; Assert-LastExit "electron-builder"
}
finally {
    Pop-Location
}

$dist = Join-Path $PSScriptRoot "applications\electron\dist"
Write-Host "`n=== Xong! File build ở: $dist ===" -ForegroundColor Green
if (Test-Path $dist) {
    Get-ChildItem $dist -File | Where-Object { $_.Name -match '\.exe$|\.zip$' } | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor Yellow }
}
