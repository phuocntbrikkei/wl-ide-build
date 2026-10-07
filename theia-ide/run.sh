#!/usr/bin/env bash
# Chạy Rikkei Ide TRỰC TIẾP để test nhanh (không đóng gói). Log electron-main ở terminal.
#   ./run.sh            -> build extensions + bundle + chạy
#   ./run.sh --no-build -> chạy luôn (chưa đổi code)
#   ./run.sh --deps     -> yarn install trước
set -euo pipefail
cd "$(dirname "$0")"

NO_BUILD=0; DEPS=0
for a in "$@"; do case "$a" in
  --no-build) NO_BUILD=1 ;; --deps) DEPS=1 ;;
  *) echo "Tham số không rõ: $a"; exit 1 ;;
esac; done

# [0] symlink workspace — 2 mảng song song (bash 3.2 macOS không có associative array)
WS_NAMES=(theia-ide-browser-app theia-ide-electron-app theia-ide-next-electron-app theia-ide-launcher-ext theia-ide-product-ext theia-ide-updater-ext)
WS_PATHS=(applications/browser applications/electron applications/electron-next theia-extensions/launcher theia-extensions/product theia-extensions/updater)
if [ -d node_modules ]; then
  for i in "${!WS_NAMES[@]}"; do
    name="${WS_NAMES[$i]}"
    [ -f "node_modules/$name/package.json" ] || { rm -rf "node_modules/$name"; ln -sfn "$(pwd)/${WS_PATHS[$i]}" "node_modules/$name"; echo "  + link $name"; }
  done
fi

[ "$DEPS" = 1 ] && { echo "[+] yarn install"; yarn install; } || true
if [ "$NO_BUILD" = 0 ]; then
  echo "[1/2] build:extensions"; yarn build:extensions
  echo "[2/2] theia build"; ( cd applications/electron && npx theia build --app-target="electron" )
fi

echo "=== CHẠY Rikkei Ide (yarn start) — log ở terminal. Ctrl+C để dừng. ==="
cd applications/electron
yarn start
