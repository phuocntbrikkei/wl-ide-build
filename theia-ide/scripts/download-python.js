const fs = require('fs');
const path = require('path');
const https = require('https');
const cp = require('child_process');

const targetDir = path.join(__dirname, '../applications/electron/resources');
const pythonPath = path.join(targetDir, 'python');

if (fs.existsSync(pythonPath)) {
  console.log('Portable Python already downloaded and extracted at ' + pythonPath);
  process.exit(0);
}

const platform = process.env.TARGET_PLATFORM || process.platform;
const arch = process.env.TARGET_ARCH || process.arch;
let downloadUrl = '';

if (platform === 'darwin') {
  if (arch === 'arm64') {
    downloadUrl = 'https://github.com/astral-sh/python-build-standalone/releases/download/20260623/cpython-3.10.20+20260623-aarch64-apple-darwin-install_only_stripped.tar.gz';
  } else if (arch === 'x64') {
    downloadUrl = 'https://github.com/astral-sh/python-build-standalone/releases/download/20260623/cpython-3.10.20+20260623-x86_64-apple-darwin-install_only_stripped.tar.gz';
  }
} else if (platform === 'win32') {
  if (arch === 'arm64') {
    downloadUrl = 'https://github.com/astral-sh/python-build-standalone/releases/download/20260623/cpython-3.10.20+20260623-aarch64-pc-windows-msvc-install_only_stripped.tar.gz';
  } else if (arch === 'x64') {
    downloadUrl = 'https://github.com/astral-sh/python-build-standalone/releases/download/20260623/cpython-3.10.20+20260623-x86_64-pc-windows-msvc-install_only_stripped.tar.gz';
  }
} else if (platform === 'linux') {
  if (arch === 'arm64') {
    downloadUrl = 'https://github.com/astral-sh/python-build-standalone/releases/download/20260623/cpython-3.10.20+20260623-aarch64-unknown-linux-gnu-install_only_stripped.tar.gz';
  } else if (arch === 'x64') {
    downloadUrl = 'https://github.com/astral-sh/python-build-standalone/releases/download/20260623/cpython-3.10.20+20260623-x86_64-unknown-linux-gnu-install_only_stripped.tar.gz';
  }
}

if (!downloadUrl) {
  console.error(`Unsupported platform or architecture: ${platform} ${arch}`);
  process.exit(1);
}

console.log(`System architecture: ${platform} ${arch}`);
console.log(`Downloading portable Python from: ${downloadUrl}`);

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const tempTarGz = path.join(targetDir, 'python-temp.tar.gz');

function download(url, dest, callback) {
  const file = fs.createWriteStream(dest);
  
  const request = https.get(url, (response) => {
    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
      download(response.headers.location, dest, callback);
      return;
    }
    
    if (response.statusCode !== 200) {
      callback(new Error(`Failed to download file: Status Code ${response.statusCode}`));
      return;
    }
    
    response.pipe(file);
    
    file.on('finish', () => {
      file.close(callback);
    });
  });
  
  request.on('error', (err) => {
    fs.unlink(dest, () => {});
    callback(err);
  });
}

download(downloadUrl, tempTarGz, (err) => {
  if (err) {
    console.error('Error downloading Python:', err.message);
    process.exit(1);
  }
  
  console.log('Download complete. Extracting Python archive...');
  
  try {
    cp.execSync(`tar -xf "${tempTarGz}" -C "${targetDir}"`);
    console.log('Extraction complete. Portable Python is set up.');
  } catch (extractErr) {
    console.error('Error extracting Python:', extractErr.message);
    process.exit(1);
  } finally {
    if (fs.existsSync(tempTarGz)) {
      fs.unlinkSync(tempTarGz);
    }
  }
  // Ép thoát (tránh socket https keep-alive giữ event loop -> treo trên CI).
  process.exit(0);
});
