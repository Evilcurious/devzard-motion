const { app, BrowserWindow, dialog, shell, utilityProcess } = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const MAX_SERVER_OUTPUT = 12_000;
let serverProcess;
let serverExitCode;
let serverError;
let serverOutput = '';
let appWindow;
let quitting = false;

function captureServerOutput(stream, label) {
  if (!stream) return;
  stream.on('data', (chunk) => {
    serverOutput = `${serverOutput}[${label}] ${chunk.toString()}`.slice(-MAX_SERVER_OUTPUT);
  });
}

function serverDiagnostics() {
  const details = [];
  if (serverExitCode !== undefined) details.push(`Exit code: ${serverExitCode}`);
  if (serverError) details.push(`Process error: ${serverError}`);
  if (serverOutput.trim()) details.push(`Last service output:\n${serverOutput.trim()}`);
  return details.length ? `\n\n${details.join('\n\n')}` : '';
}

function persistentSessionSecret() {
  const secretPath = path.join(app.getPath('userData'), 'relay-session-secret');
  try {
    const secret = fs.readFileSync(secretPath, 'utf8').trim();
    if (secret.length >= 32) return secret;
  } catch {
    // First launch: create a machine-local key so encrypted provider credentials survive restarts.
  }
  fs.mkdirSync(path.dirname(secretPath), { recursive: true });
  const secret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(secretPath, `${secret}\n`, { mode: 0o600 });
  return secret;
}

function reserveLoopbackPort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Could not reserve a local Relay port.')));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function desktopEnvironment(port) {
  const env = {
    NODE_ENV: app.isPackaged ? 'production' : 'development',
    HOSTNAME: '127.0.0.1',
    PORT: String(port),
    APP_URL: `http://127.0.0.1:${port}`,
    SESSION_SECRET: persistentSessionSecret(),
    NEXT_TELEMETRY_DISABLED: '1',
  };
  // Keep only OS runtime paths; do not inherit server/database/API credentials from the shell.
  for (const key of [
    'PATH',
    'SYSTEMROOT',
    'WINDIR',
    'TEMP',
    'TMP',
    'HOME',
    'USERPROFILE',
    'APPDATA',
    'LOCALAPPDATA',
  ]) {
    const actualKey = Object.keys(process.env).find((candidate) => candidate.toUpperCase() === key);
    if (actualKey && process.env[actualKey]) env[key] = process.env[actualKey];
  }
  return env;
}

function launchServer(port) {
  let entry;
  let args;
  let cwd;
  if (app.isPackaged) {
    entry = path.join(process.resourcesPath, 'relay-server', 'server.js');
    args = [];
    cwd = path.dirname(entry);
  } else {
    const root = path.resolve(__dirname, '..');
    entry = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
    args = ['dev', '--hostname', '127.0.0.1', '--port', String(port)];
    cwd = root;
  }
  if (!fs.existsSync(entry)) throw new Error(`Relay server files are missing: ${entry}`);

  // utilityProcess runs Node directly and avoids relying on Electron's RunAsNode fuse.
  serverProcess = utilityProcess.fork(entry, args, {
    cwd,
    env: desktopEnvironment(port),
    serviceName: 'Relay local service',
    stdio: 'pipe',
  });
  captureServerOutput(serverProcess.stdout, 'stdout');
  captureServerOutput(serverProcess.stderr, 'stderr');
  serverProcess.once('error', (type, location, report) => {
    serverError = [type, location, report].filter(Boolean).join(' ');
  });
  serverProcess.once('exit', (code) => {
    serverExitCode = code;
    serverProcess = undefined;
    if (!quitting && appWindow && !appWindow.isDestroyed()) {
      dialog.showErrorBox(
        'Relay stopped',
        `The local Relay service exited (code ${code}). Restart the app to try again.${serverDiagnostics()}`,
      );
      app.quit();
    }
  });
}

async function waitForServer(port, timeoutMs = 45_000) {
  const url = `http://127.0.0.1:${port}/`;
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (!serverProcess || serverExitCode !== undefined) {
      throw new Error(
        `The local Relay service exited before it finished starting.${serverDiagnostics()}`,
      );
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1200) });
      if (response.status < 500) return url;
    } catch {
      // Next.js is still booting; poll briefly on loopback only.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Relay did not finish starting. Try launching it again.${serverDiagnostics()}`);
}

function showStartupError(error) {
  dialog.showErrorBox(
    'Could not start Relay',
    `${error instanceof Error ? error.message : 'The local Relay service could not start.'}\n\nReinstall Relay or contact support if this continues.`,
  );
  app.quit();
}

function createWindow(url) {
  appWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 920,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f4f1e9',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  appWindow.webContents.setWindowOpenHandler(({ url: requestedUrl }) => {
    if (requestedUrl.startsWith('https://')) void shell.openExternal(requestedUrl);
    return { action: 'deny' };
  });
  appWindow.webContents.on('will-navigate', (event, requestedUrl) => {
    if (new URL(requestedUrl).origin !== new URL(url).origin) event.preventDefault();
  });
  appWindow.once('ready-to-show', () => appWindow?.show());
  appWindow.on('closed', () => {
    appWindow = undefined;
  });
  void appWindow.loadURL(url);
}

const hasSingleInstance = app.requestSingleInstanceLock();
if (!hasSingleInstance) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (appWindow) {
      if (appWindow.isMinimized()) appWindow.restore();
      appWindow.focus();
    }
  });
  app.whenReady().then(async () => {
    try {
      const port = await reserveLoopbackPort();
      launchServer(port);
      createWindow(await waitForServer(port));
    } catch (error) {
      showStartupError(error);
    }
  });
  app.on('before-quit', () => {
    quitting = true;
    if (serverProcess) serverProcess.kill();
  });
  app.on('window-all-closed', () => app.quit());
}
