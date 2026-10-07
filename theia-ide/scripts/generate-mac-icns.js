const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const logoPath = path.resolve(__dirname, '../logo.jpeg');
const targetIconsDir = path.resolve(__dirname, '../applications/electron/resources/icons/MacLauncherIcons');
const targetIconPath = path.join(targetIconsDir, 'icon.icns');
const rootIconPath = path.resolve(__dirname, '../applications/electron/resources/icon.icns');

const windowIconPath = path.resolve(__dirname, '../applications/electron/resources/icons/WindowIcon/512-512.png');
const rootPngIconPath = path.resolve(__dirname, '../applications/electron/resources/icons/512x512.png');

if (!fs.existsSync(logoPath)) {
  console.error('logo.jpeg not found!');
  process.exit(1);
}

// Generate the 512x512 PNG icons
console.log('Generating 512x512 PNG icons...');
cp.execSync(`sips -s format png -z 512 512 "${logoPath}" --out "${windowIconPath}"`, { stdio: 'ignore' });
cp.execSync(`sips -s format png -z 512 512 "${logoPath}" --out "${rootPngIconPath}"`, { stdio: 'ignore' });
console.log('PNG icons updated.');

const iconsetDir = path.join(__dirname, '../icon.iconset');
if (fs.existsSync(iconsetDir)) {
  fs.rmSync(iconsetDir, { recursive: true, force: true });
}
fs.mkdirSync(iconsetDir, { recursive: true });

const sizes = [
  { name: 'icon_16x16.png', size: 16 },
  { name: 'icon_16x16@2x.png', size: 32 },
  { name: 'icon_32x32.png', size: 32 },
  { name: 'icon_32x32@2x.png', size: 64 },
  { name: 'icon_128x128.png', size: 128 },
  { name: 'icon_128x128@2x.png', size: 256 },
  { name: 'icon_256x256.png', size: 256 },
  { name: 'icon_256x256@2x.png', size: 512 },
  { name: 'icon_512x512.png', size: 512 },
  { name: 'icon_512x512@2x.png', size: 1024 }
];

console.log('Generating PNG assets for iconset...');
for (const { name, size } of sizes) {
  const dest = path.join(iconsetDir, name);
  cp.execSync(`sips -s format png -z ${size} ${size} "${logoPath}" --out "${dest}"`, { stdio: 'ignore' });
}

console.log('Compiling iconset to icns using iconutil...');
try {
  cp.execSync(`iconutil -c icns "${iconsetDir}" -o "${targetIconPath}"`);
  console.log(`Successfully generated: ${targetIconPath}`);
  
  fs.copyFileSync(targetIconPath, rootIconPath);
  console.log(`Successfully copied to: ${rootIconPath}`);
} catch (err) {
  console.error('Error compiling icns:', err.message);
} finally {
  fs.rmSync(iconsetDir, { recursive: true, force: true });
}
