#!/usr/bin/env bash
# Build Rikkei Ide bản Mac INTEL (x64) trên máy Apple Silicon bằng cách CHẠY TOÀN
# BỘ BUILD DƯỚI ROSETTA (node x64). Nhờ vậy toolchain + native module + ffmpeg đều
# là x64 đồng nhất -> không còn lỗi "incompatible architecture" khi theia build nạp
# native.
#
# YÊU CẦU: có Rosetta + một Node chạy được ở chế độ x64 (Node universal từ
# nodejs.org .pkg là đủ; Node arm-only cài qua brew/nvm sẽ KHÔNG chạy x64 -> khi đó
# build trên máy Mac Intel thật, hoặc CI GitHub Actions macos-13).
set -euo pipefail
cd "$(dirname "$0")"

if [ "$(uname)" != "Darwin" ]; then echo "[-] Chi chay tren macOS."; exit 1; fi

# --- Nếu đang là arm64 -> re-exec toàn bộ script dưới Rosetta x86_64 ---
if [ "$(uname -m)" = "arm64" ] && [ "${RE_EXEC_X64:-}" != "1" ]; then
  echo "[*] May Apple Silicon -> chay lai toan bo build duoi Rosetta (x86_64)..."
  if ! /usr/bin/arch -x86_64 /usr/bin/true 2>/dev/null; then
    echo "[-] Chua co Rosetta. Cai: softwareupdate --install-rosetta --agree-to-license"
    exit 1
  fi
  if ! /usr/bin/arch -x86_64 node -v >/dev/null 2>&1; then
    echo "[-] Node hien tai KHONG chay duoc o che do x64 (co le la ban arm-only qua brew/nvm)."
    echo "    Cach 1: cai Node UNIVERSAL tu https://nodejs.org (goi .pkg) roi chay lai."
    echo "    Cach 2 (chac an nhat): build tren mot may Mac INTEL that -> ./build.sh"
    echo "    Cach 3: dung CI GitHub Actions runner 'macos-13' (Intel) chay ./build.sh"
    exit 1
  fi
  exec /usr/bin/arch -x86_64 env RE_EXEC_X64=1 TARGET_PLATFORM=darwin TARGET_ARCH=x64 "$0" "$@"
fi

echo "=== Build Rikkei Ide -> Mac INTEL (x64), node $(node -v) arch=$(node -p 'process.arch') ==="
if [ "$(node -p 'process.arch')" != "x64" ]; then
  echo "[-] Node dang chay khong phai x64 (dang $(node -p 'process.arch')). Dung."; exit 1
fi

# Dọn artefact theo-arch cũ để cài/biên dịch lại cho x64.
echo "[clean] Xoa node_modules / plugin redhat.java / JRE / Python / lib / dist (arch cu)"
rm -rf node_modules applications/*/node_modules theia-extensions/*/node_modules
rm -rf plugins/redhat.java
rm -rf applications/electron/resources/java applications/electron/resources/python
rm -rf applications/electron/lib applications/electron/dist

echo "[1/5] yarn install (native + ripgrep build cho x64 duoi Rosetta)"
yarn install

echo "[2/5] Tai plugins / python / java ban x64"
yarn download:plugins   # resolver -> redhat.java darwin-x64
yarn download:python
yarn download:java

echo "[3/5] Bien dich extensions"
yarn build:extensions

echo "[4/5] Bundle app (theia build)"
( cd applications/electron && npx theia build --app-target="electron" )

echo "[5/5] Dong goi DMG x64"
( cd applications/electron && yarn clean:dist || true; npx electron-builder --mac --x64 -c.mac.identity=null --publish never )

DIST="$(pwd)/applications/electron/dist"
echo "=== Xong! File build x64 o: $DIST ==="
ls -1 "$DIST" 2>/dev/null | grep -E '\.(dmg|zip)$' | sed 's/^/  - /' || true
echo ""
echo "LUU Y: thu muc dang o trang thai x64. Muon build lai ban arm64:"
echo "  ./rebuild.sh --clean-install --full"
