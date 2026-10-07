# Build Rikkei Ide từ đầu (Windows): cài deps + tải plugins/python/java + biên dịch + đóng gói.
# Thực chất gọi rebuild.ps1 -Full (đã: tự khôi phục symlink workspace, BỎ QUA bước
# theia rebuild:electron bị lỗi trên Windows, bundle bằng theia build + đóng gói electron-builder).
# Muốn build nhanh khi đã cài sẵn: chạy .\rebuild.ps1 (không cờ).
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
& (Join-Path $PSScriptRoot "rebuild.ps1") -Full
exit $LASTEXITCODE
