// Chọn đúng bản redhat.java theo NỀN TẢNG đang build rồi ghi lại URL trong
// package.json (theiaPlugins), vì `theia download:plugins` tải y nguyên URL trong
// map — không tự đổi theo OS/arch. Chạy TRƯỚC download:plugins.
//
// Hỗ trợ cross-build: đặt TARGET_PLATFORM (win32|darwin|linux) + TARGET_ARCH (x64|arm64)
// để build cho nền tảng khác máy hiện tại (ví dụ dựng bản Intel trên máy Apple Silicon).
const fs = require('fs');
const path = require('path');

const platform = process.env.TARGET_PLATFORM || process.platform; // win32 | darwin | linux
const arch = process.env.TARGET_ARCH || process.arch;             // x64 | arm64

let target = '';
if (platform === 'win32') {
    target = 'win32-x64';
} else if (platform === 'darwin') {
    target = arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
} else if (platform === 'linux') {
    target = arch === 'arm64' ? 'linux-arm64' : 'linux-x64';
}
if (!target) {
    console.warn(`[resolve-platform-plugins] Bỏ qua: không rõ nền tảng ${platform}/${arch}`);
    process.exit(0);
}

const VER = '1.55.0';
const url = `https://open-vsx.org/api/redhat/java/${target}/${VER}/file/redhat.java-${VER}@${target}.vsix`;

const pkgPath = path.join(__dirname, '..', 'package.json');
const raw = fs.readFileSync(pkgPath, 'utf8');
// Chỉ thay đúng dòng redhat.java, giữ nguyên phần còn lại của file.
const re = /("redhat\.java":\s*")https:\/\/open-vsx\.org\/api\/redhat\/java\/[^"]+(")/;
if (!re.test(raw)) {
    console.warn('[resolve-platform-plugins] Không tìm thấy mục redhat.java trong theiaPlugins');
    process.exit(0);
}
const next = raw.replace(re, `$1${url}$2`);
if (next !== raw) {
    fs.writeFileSync(pkgPath, next);
    console.log(`[resolve-platform-plugins] redhat.java -> ${target}`);
} else {
    console.log(`[resolve-platform-plugins] redhat.java đã đúng (${target})`);
}
