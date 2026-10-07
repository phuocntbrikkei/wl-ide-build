const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const patchesDir = path.join(__dirname, '..', 'patches');

if (!fs.existsSync(patchesDir)) {
  console.log('No patches directory found.');
  process.exit(0);
}

const patchFiles = fs.readdirSync(patchesDir).filter(file => file.endsWith('.patch'));
const disabledPatches = [];

for (const file of patchFiles) {
  // Find the last '+' in the filename (which separates the package name from version)
  const lastPlusIndex = file.lastIndexOf('+');
  if (lastPlusIndex === -1) continue;
  
  const pkgNameWithPluses = file.substring(0, lastPlusIndex);
  // Scoped packages like @vscode+windows-ca-certs become @vscode/windows-ca-certs
  const pkgName = pkgNameWithPluses.replace('+', '/');
  
  const pkgPath = path.join(__dirname, '..', 'node_modules', pkgName);
  if (!fs.existsSync(pkgPath)) {
    console.log(`Package ${pkgName} is not installed. Temporarily disabling patch ${file}...`);
    const oldPath = path.join(patchesDir, file);
    const newPath = path.join(patchesDir, file + '.disabled');
    fs.renameSync(oldPath, newPath);
    disabledPatches.push({ oldPath, newPath });
  }
}

let patchError = null;
try {
  cp.execSync('npx patch-package --patch-dir patches', { stdio: 'inherit' });
} catch (error) {
  patchError = error;
} finally {
  for (const { oldPath, newPath } of disabledPatches) {
    if (fs.existsSync(newPath)) {
      fs.renameSync(newPath, oldPath);
    }
  }
}

if (patchError) {
  process.exit(patchError.status || 1);
}
