const fs = require('fs');
const path = require('path');
const https = require('https');
const cp = require('child_process');

const targetDir = path.join(__dirname, '../applications/electron/resources');
const javaPath = path.join(targetDir, 'java');

if (fs.existsSync(javaPath)) {
  console.log('Portable Java already downloaded and extracted at ' + javaPath);
  process.exit(0);
}

const platform = process.env.TARGET_PLATFORM || process.platform;
const arch = process.env.TARGET_ARCH || process.arch;
let downloadUrl = '';

let osName = '';
if (platform === 'darwin') {
  osName = 'mac';
} else if (platform === 'win32') {
  osName = 'windows';
} else if (platform === 'linux') {
  osName = 'linux';
}

let archName = '';
if (arch === 'arm64') {
  archName = 'aarch64';
} else if (arch === 'x64') {
  archName = 'x64';
}

if (osName && archName) {
  downloadUrl = `https://api.adoptium.net/v3/binary/latest/21/ga/${osName}/${archName}/jdk/hotspot/normal/eclipse`;
}

if (!downloadUrl) {
  console.error(`Unsupported platform or architecture: ${platform} ${arch}`);
  process.exit(1);
}

console.log(`System architecture: ${platform} ${arch}`);
console.log(`Downloading portable Java JDK 21 from: ${downloadUrl}`);

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const tempTarGz = path.join(targetDir, 'java-temp.tar.gz');
const tempExtractDir = path.join(targetDir, 'java-temp-extract');

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
    console.error('Error downloading Java:', err.message);
    process.exit(1);
  }
  
  console.log('Download complete. Extracting Java archive...');
  
  try {
    if (!fs.existsSync(tempExtractDir)) {
      fs.mkdirSync(tempExtractDir, { recursive: true });
    }
    
    cp.execSync(`tar -xf "${tempTarGz}" -C "${tempExtractDir}"`);
    
    const dirs = fs.readdirSync(tempExtractDir).filter(name => !name.startsWith('.'));
    if (dirs.length === 0) {
      throw new Error('No files extracted');
    }
    
    const extractedJdkDir = path.join(tempExtractDir, dirs[0]);
    
    if (platform === 'darwin') {
      const homeDir = path.join(extractedJdkDir, 'Contents/Home');
      if (!fs.existsSync(homeDir)) {
        throw new Error(`Expected Contents/Home structure inside extracted JDK, but not found at ${homeDir}`);
      }
      fs.renameSync(homeDir, javaPath);
    } else {
      fs.renameSync(extractedJdkDir, javaPath);
    }
    console.log('Extraction and normalization complete. Portable Java JDK 21 is set up.');
  } catch (extractErr) {
    console.error('Error extracting Java:', extractErr.message);
    process.exit(1);
  } finally {
    if (fs.existsSync(tempTarGz)) {
      fs.unlinkSync(tempTarGz);
    }
    if (fs.existsSync(tempExtractDir)) {
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
    }
  }
  // Ép thoát: sau redirect, socket https keep-alive có thể giữ event loop khiến
  // node không tự thoát (treo trên CI). Việc đã xong nên exit(0) an toàn.
  process.exit(0);
});
