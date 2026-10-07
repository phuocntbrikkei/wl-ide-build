#!/usr/bin/env bash
# Rebuild Rikkei Ide (macOS/Linux) — DÙNG KHI ĐÃ CÓ node_modules + plugins + python + java.
# Bỏ qua "theia rebuild:electron" (lỗi/không cần khi native đã prebuilt) và gọi thẳng
# "theia build" + "electron-builder".
#   ./rebuild.sh                  -> build + đóng gói
#   ./rebuild.sh --deps           -> yarn install trước
#   ./rebuild.sh --full           -> tải lại plugins/python/java rồi build
#   ./rebuild.sh --native-rebuild -> chạy theia rebuild:electron (khi đổi native dep)
set -euo pipefail
cd "$(dirname "$0")"

DEPS=0; FULL=0; NATIVE_REBUILD=0; CLEAN_INSTALL=0
for a in "$@"; do
  case "$a" in
    --deps) DEPS=1 ;;
    --full) FULL=1; DEPS=1 ;;
    --native-rebuild) NATIVE_REBUILD=1 ;;
    # Xoá node_modules cũ rồi cài lại — DÙNG KHI MANG FOLDER TỪ WINDOWS SANG macOS/Linux
    # (node_modules chứa native module theo nền tảng, không mang chéo được).
    --clean-install) CLEAN_INSTALL=1; DEPS=1 ;;
    *) echo "Tham số không rõ: $a"; exit 1 ;;
  esac
done

echo "=== Rebuild Rikkei Ide ==="

if [ "$CLEAN_INSTALL" = 1 ]; then
  echo "[clean] Xoá node_modules (root + applications/*) để cài lại cho đúng nền tảng"
  rm -rf node_modules applications/*/node_modules theia-extensions/*/node_modules
fi

# [0] Tự khôi phục symlink workspace -> trỏ đúng vị trí hiện tại (phòng khi di chuyển thư mục).
# Dùng 2 mảng song song (KHÔNG dùng associative array) để chạy được cả bash 3.2 mặc
# định của macOS. Chỉ sửa khi node_modules đã có (folder mới sẽ do yarn install tạo link).
echo "[0] Kiểm tra liên kết workspace"
WS_NAMES=(theia-ide-browser-app theia-ide-electron-app theia-ide-next-electron-app theia-ide-launcher-ext theia-ide-product-ext theia-ide-updater-ext)
WS_PATHS=(applications/browser applications/electron applications/electron-next theia-extensions/launcher theia-extensions/product theia-extensions/updater)
if [ -d node_modules ]; then
  for i in "${!WS_NAMES[@]}"; do
    name="${WS_NAMES[$i]}"
    target="${WS_PATHS[$i]}"
    link="node_modules/$name"
    if [ ! -f "$link/package.json" ]; then
      rm -rf "$link"
      ln -sfn "$(pwd)/$target" "$link"
      echo "    + tạo lại link $name"
    fi
  done
else
  echo "    (chưa có node_modules — yarn install sẽ tự tạo link workspace)"
fi

if [ "$DEPS" = 1 ]; then echo "[+] yarn install"; yarn install; fi
if [ "$FULL" = 1 ]; then
  echo "[+] Tải plugins / python / java"
  yarn download:plugins
  yarn download:python
  yarn download:java
fi

echo "[1/3] Biên dịch extensions (yarn build:extensions)"
yarn build:extensions

cd applications/electron
if [ "$NATIVE_REBUILD" = 1 ]; then
  echo "[2/3] theia rebuild:electron (native)"
  yarn rebuild
else
  echo "[2/3] BỎ QUA theia rebuild:electron (dùng native prebuilt trong lib/backend/native)"
fi

echo "[2b] Bundle app (theia build --app-target=electron)"
npx theia build --app-target="electron"

echo "[3/3] Đóng gói electron-builder"
yarn clean:dist
npx electron-builder -c.mac.identity=null --publish never
cd - >/dev/null

DIST="$(pwd)/applications/electron/dist"
echo "=== Xong! File build ở: $DIST ==="
ls -1 "$DIST" 2>/dev/null | grep -E '\.(exe|zip|dmg|AppImage|deb)$' | sed 's/^/  - /' || true
