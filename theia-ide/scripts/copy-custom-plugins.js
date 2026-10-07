const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'vscode-extensions/sample-snippets');
const destDir = path.join(__dirname, '..', 'plugins/sample-snippets');

if (!fs.existsSync(srcDir)) {
  console.error(`Source directory not found: ${srcDir}`);
  process.exit(1);
}

const pluginsDir = path.dirname(destDir);
if (!fs.existsSync(pluginsDir)) {
  fs.mkdirSync(pluginsDir, { recursive: true });
}

if (fs.existsSync(destDir)) {
  fs.rmSync(destDir, { recursive: true, force: true });
}

fs.cpSync(srcDir, destDir, { recursive: true });
console.log(`Successfully copied custom extension to ${destDir}`);
