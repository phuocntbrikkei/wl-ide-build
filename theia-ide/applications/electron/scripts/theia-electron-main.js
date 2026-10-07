const path = require('path');
const fs = require('fs');
const os = require('os');
const { copyBundledPlugins } = require('./appimage-helpers');
const { handleVersionAndHelp } = require('./cli-usage');

// Handle --version and --help early, before loading the full electron stack.
const packageJsonPath = path.resolve(__dirname, '../', 'package.json');
handleVersionAndHelp(packageJsonPath);

// Update to override the supported VS Code API version.
// process.env.VSCODE_API_VERSION = '1.50.0'

// Detect if running as AppImage
const isAppImage = !!process.env.APPIMAGE;

// When packaged with asar, __dirname is inside app.asar (e.g., .../app.asar/scripts)
// but plugins are in extraResources at .../app/plugins (outside the asar)
const isInsideAsar = __dirname.includes('.asar');
const bundledPluginsDir = isInsideAsar
    ? path.join(process.resourcesPath, 'app', 'plugins')
    : path.resolve(__dirname, '../', 'plugins');

// Setup bundled Python environment if available
const bundledPythonDir = isInsideAsar
    ? path.join(process.resourcesPath, 'app', 'python')
    : path.resolve(__dirname, '../', 'resources', 'python');

const pythonBinDir = process.platform === 'win32'
    ? bundledPythonDir
    : path.join(bundledPythonDir, 'bin');

const pythonExeName = process.platform === 'win32' ? 'python.exe' : 'python3';
const pythonExePath = path.join(pythonBinDir, pythonExeName);

if (fs.existsSync(pythonExePath)) {
    const sep = process.platform === 'win32' ? ';' : ':';
    process.env.PATH = pythonBinDir + sep + process.env.PATH;

    // For non-Windows platforms, ensure a "python" symlink/executable exists pointing to "python3"
    if (process.platform !== 'win32') {
        const legacyPythonPath = path.join(pythonBinDir, 'python');
        if (!fs.existsSync(legacyPythonPath)) {
            try {
                fs.symlinkSync(pythonExeName, legacyPythonPath);
            } catch (err) {
                // Ignore failure if running from read-only package
            }
        }
    }
}

// Setup bundled Java environment if available
const bundledJavaDir = isInsideAsar
    ? path.join(process.resourcesPath, 'app', 'java')
    : path.resolve(__dirname, '../', 'resources', 'java');

const javaBinDir = path.join(bundledJavaDir, 'bin');
const javaExeName = process.platform === 'win32' ? 'java.exe' : 'java';
const javaExePath = path.join(javaBinDir, javaExeName);

if (fs.existsSync(javaExePath)) {
    const sep = process.platform === 'win32' ? ';' : ':';
    process.env.PATH = javaBinDir + sep + process.env.PATH;
    process.env.JAVA_HOME = bundledJavaDir;
}

if (isAppImage) {
    // When running as AppImage, use a user-writable directory for the built-in plugins
    // The AppImage mount point (/tmp/.mount_*) is read-only
    const configDir = process.env.THEIA_CONFIG_DIR || path.join(os.homedir(), '.theia-ide');
    const userPluginsDir = path.join(configDir, 'builtInPlugins');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const currentVersion = packageJson.version;

    // Copy bundled plugins to user directory if needed (first run or version update)
    const useUserDir = copyBundledPlugins(bundledPluginsDir, userPluginsDir, currentVersion);
    // If copying fails, fall back to the read-only bundled directory (will be improved in follow up of GH-630)
    process.env.THEIA_DEFAULT_PLUGINS = `local-dir:${useUserDir ? userPluginsDir : bundledPluginsDir}`;

} else {
    // Use a set of builtin plugins in our application.
    process.env.THEIA_DEFAULT_PLUGINS = `local-dir:${bundledPluginsDir}`;
}

// Handover to the auto-generated electron application handler.
// Set Windows AppUserModelId early so the taskbar does not use Electron's identity/icon.
try {
    const { app, nativeImage } = require('electron');
    if (process.platform === 'win32') {
        app.setAppUserModelId('com.resc.ide');
    } else if (process.platform === 'darwin') {
        const iconPath = path.resolve(__dirname, '../resources/icons/MacLauncherIcons/icon.icns');
        if (fs.existsSync(iconPath)) {
            app.dock.setIcon(nativeImage.createFromPath(iconPath));
        }
    }
} catch (err) {
    // Ignore if electron is unavailable in non-electron contexts.
}
require('../lib/backend/electron-main.js');
