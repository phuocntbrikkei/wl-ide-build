#!/usr/bin/env bash
# Build Rikkei Ide từ đầu (macOS/Linux): cài deps + tải runtime + biên dịch + đóng gói.
# Gọi rebuild.sh --full (đã tự khôi phục symlink workspace, bỏ qua theia rebuild:electron,
# bundle bằng theia build + đóng gói electron-builder). Build nhanh: ./rebuild.sh
set -euo pipefail
cd "$(dirname "$0")"
exec ./rebuild.sh --full
