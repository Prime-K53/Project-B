const { app, BrowserWindow, Menu, dialog, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');

const isDev = !app.isPackaged;

let mainWindow = null;
let backendProcess = null;
let backendOrigin = '';
let backendStopInProgress = false;

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
};

const getUserDataPath = () => app.getPath('userData');
const getLogDir = () => ensureDir(path.join(getUserDataPath(), 'logs'));

const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB per log file

/**
 * Write a log entry to a specific log file with rotation
 * @param {string} fileName - Log file name (main.log, backend.log, renderer.log)
 * @param {string} level - Log level (INFO, WARN, ERROR)
 * @param {string} message - Log message
 * @param {object} [extra] - Additional data to stringify
 */
const writeLog = (fileName, level, message, extra) => {
  const logFile = path.join(getLogDir(), fileName);
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${message}${extra ? ` ${JSON.stringify(extra)}` : ''}`;

  try {
    // Log rotation: rotate if file exceeds max size
    if (fs.existsSync(logFile)) {
      const stats = fs.statSync(logFile);
      if (stats.size > MAX_LOG_SIZE) {
        // Keep up to 2 old files
        const oldFile = `${logFile}.old`;
        if (fs.existsSync(oldFile)) {
          fs.unlinkSync(oldFile);
        }
        fs.renameSync(logFile, oldFile);
      }
    }
    fs.appendFileSync(logFile, `${line}\n`, 'utf8');
  } catch (error) {
    console.error(`[Electron] Failed to write ${fileName}`, error);
  }

  // Also output to console for debugging with clear prefixes
  const consolePrefixMap = {
    'main.log': '[ELECTRON]',
    'backend.log': '[BACKEND]',
    'renderer.log': '[FRONTEND]'
  };
  const prefix = consolePrefixMap[fileName] || '[SYSTEM]';
  console.log(`${prefix} ${line}`);
};

/**
 * Specialized logging functions for each log category
 */
const log = {
  main: (level, message, extra) => writeLog('main.log', level, message, extra),
  backend: (level, message, extra) => writeLog('backend.log', level, message, extra),
  renderer: (level, message, extra) => writeLog('renderer.log', level, message, extra),
};

// Convenience methods
const appendLog = (scope, message, extra) => {
  // Map scope to appropriate log file and level
  if (scope.startsWith('backend') || scope === 'startup') {
    log.backend('INFO', message, extra);
  } else if (scope === 'renderer') {
    log.renderer('INFO', message, extra);
  } else {
    log.main('INFO', message, extra);
  }
};

const getBackendRoot = () =>
  isDev
    ? path.join(__dirname, '..', 'backend')
    : path.join(__dirname, '..', '..', 'backend');

const getFrontendEntry = () =>
  isDev
    ? 'http://127.0.0.1:5173'
    : path.join(__dirname, '..', 'frontend', 'dist', 'index.html');

const getIconPath = () => path.join(__dirname, 'icon.ico');

const getBackendRuntimePaths = () => {
  const storageDir = ensureDir(path.join(getUserDataPath(), 'backend'));
  return {
    storageDir,
    backupDir: ensureDir(path.join(storageDir, 'backups')),
    tempDir: ensureDir(path.join(storageDir, 'temp')),
    secureKeysDir: ensureDir(path.join(storageDir, 'secure', 'keys')),
    dbPath: path.join(storageDir, 'database.db'),
    workspaceConfigPath: path.join(storageDir, 'workspace.json'),
    licensePath: path.join(storageDir, 'license.json'),
  };
};

const isSafeWindowTarget = (targetUrl) => {
  if (!targetUrl) return true;
  if (targetUrl === 'about:blank') return true;
  if (targetUrl.startsWith('file://')) return true;
  if (targetUrl.startsWith('data:')) return true;
  if (targetUrl.startsWith('blob:')) return true;
  if (isDev && targetUrl.startsWith('http://127.0.0.1:5173')) return true;
  if (targetUrl.startsWith(backendOrigin)) return true;
  return false;
};

const showBlockedExternalMessage = (targetUrl) => {
  appendLog('shell', 'Blocked external navigation in offline desktop mode', { url: targetUrl });

  if (mainWindow && !mainWindow.isDestroyed()) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Offline Desktop Mode',
      message: 'External internet links are disabled in this offline desktop build.',
      detail: targetUrl,
    }).catch(() => {});
  }
};

const findAvailablePort = (startPort = 39300, maxPort = 39450) =>
  new Promise((resolve, reject) => {
    const tryPort = (port) => {
      if (port > maxPort) {
        reject(new Error(`No free port found between ${startPort} and ${maxPort}`));
        return;
      }

      const server = net.createServer();
      server.once('error', () => tryPort(port + 1));
      server.once('listening', () => {
        server.close(() => resolve(port));
      });
      server.listen(port, '127.0.0.1');
    };

    tryPort(startPort);
  });

const waitForBackend = async (origin) => {
  const MAX_RETRIES = 60; // 60 attempts * 500ms = 30 seconds
  const RETRY_DELAY_MS = 500;
  const healthUrl = `${origin}/health`;

  appendLog('backend', 'Starting backend health check loop', { origin, maxAttempts: MAX_RETRIES });

  for (let attempts = 1; attempts <= MAX_RETRIES; attempts++) {
    try {
      appendLog('backend', `Health check attempt ${attempts}/${MAX_RETRIES}`, { url: healthUrl });
      
      // Use global fetch with a timeout
      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        appendLog('backend', `Backend is ready after ${attempts} attempt(s)`, { url: healthUrl });
        return; // Success
      }
      
      appendLog('backend', `Health check returned ${response.status}, retrying...`);
    } catch (err) {
      appendLog('backend', `Health check error: ${err.name === 'TimeoutError' ? 'Timeout' : err.message}`, { attempt: attempts });
    }

    if (attempts < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  throw new Error(`Failed to connect to backend after ${MAX_RETRIES} attempts (~30 seconds)`);
};

const stopBackend = (reason = 'explicit') => {
  if (!backendProcess) {
    backendStopInProgress = false;
    appendLog('backend', 'Stop requested but no backend process running', { reason });
    return;
  }

  if (backendStopInProgress) {
    appendLog('backend', 'Backend stop already in progress', { reason, pid: backendProcess.pid });
    return;
  }

  backendStopInProgress = true;

  appendLog('backend', 'Stopping backend process', { reason });

  // Remove listeners to prevent duplicate exit handling
  backendProcess.removeAllListeners('exit');

  // Kill the process with SIGTERM first, then force kill if needed
  const killProcess = (force = false) => {
    if (!backendProcess || backendProcess.killed) {
      appendLog('backend', 'Backend already terminated');
      return;
    }

    const signal = force ? 'SIGKILL' : 'SIGTERM';
    appendLog('backend', `Sending ${signal} to backend process`, { pid: backendProcess.pid });

    try {
      process.kill(backendProcess.pid, signal);
    } catch (err) {
      appendLog('backend', 'Failed to send signal to backend', { error: err.message });
    }
  };

  // Handle the exit once
  backendProcess.once('exit', (code, signal) => {
    clearTimeout(forceKillTimeout);
    const exitInfo = {
      code,
      signal,
      reason,
      pid: backendProcess.pid,
    };

    if (backendStopInProgress || code === 0 || signal === 'SIGTERM' || signal === 'SIGKILL') {
      appendLog('backend', 'Backend process terminated cleanly', exitInfo);
    } else {
      appendLog('backend', 'Backend process terminated unexpectedly', exitInfo);
    }

    backendProcess = null;
    backendStopInProgress = false;
  });

  // Set a timeout to force kill if it doesn't terminate gracefully
  const forceKillTimeout = setTimeout(() => {
    if (backendProcess && backendProcess.exitCode === null) {
      appendLog('backend', 'Backend did not terminate gracefully, forcing kill');
      killProcess(true);
    }
  }, 3000);

  // Try graceful termination after the exit handler is attached to avoid missing a fast exit.
  killProcess(false);
};

const startBackend = async () => {
  const backendRoot = getBackendRoot();
  const backendEntry = path.join(backendRoot, 'index.cjs');

  if (!fs.existsSync(backendEntry)) {
    throw new Error(`Backend entry not found at ${backendEntry}`);
  }

  // Find an available port, defaulting to 3000 but auto-incrementing if taken
  const port = await findAvailablePort(3000, 3100);
  const runtimePaths = getBackendRuntimePaths();

  backendOrigin = `http://127.0.0.1:${port}`;

  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    NODE_ENV: isDev ? 'development' : 'production',
    PRIME_ERP_DESKTOP: 'true',
    PRIME_ERP_BACKEND_PORT: String(port),
    PORT: String(port),
    PRIME_ERP_STORAGE_DIR: runtimePaths.storageDir,
    PRIME_ERP_BACKUP_DIR: runtimePaths.backupDir,
    PRIME_ERP_TEMP_DIR: runtimePaths.tempDir,
    PRIME_ERP_SECURE_KEYS_DIR: runtimePaths.secureKeysDir,
    PRIME_ERP_WORKSPACE_CONFIG: runtimePaths.workspaceConfigPath,
    PRIME_ERP_LICENSE_PATH: runtimePaths.licensePath,
    DB_PATH: runtimePaths.dbPath,
  };

  appendLog('backend', 'Starting backend process', {
    backendEntry,
    port,
    dbPath: runtimePaths.dbPath,
  });
  backendStopInProgress = false;

  backendProcess = spawn(process.execPath, [backendEntry], {
    cwd: backendRoot,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  backendProcess.stdout?.on('data', (chunk) => {
    const msg = String(chunk).trim();
    if (msg) log.backend('INFO', msg);
  });

  backendProcess.stderr?.on('data', (chunk) => {
    const msg = String(chunk).trim();
    if (msg) log.backend('WARN', msg);
  });

  backendProcess.on('exit', (code, signal) => {
    const exitInfo = { code, signal, pid: backendProcess?.pid };
    
    // Log exit event with appropriate severity
    if (code === 0) {
      log.backend('INFO', 'Backend process exited normally', exitInfo);
    } else if (signal) {
      log.backend('WARN', `Backend process terminated by signal`, exitInfo);
    } else {
      log.backend('ERROR', 'Backend process crashed or was killed', exitInfo);
    }
    
    backendProcess = null;

    // If backend crashes unexpectedly during normal operation, log and warn user
    if (mainWindow && !mainWindow.isDestroyed()) {
      log.backend('ERROR', 'Backend unavailable - application may not function correctly');
    }
  });

  backendProcess.on('error', (error) => {
    log.backend('ERROR', 'Backend process failed to start', { message: error.message });
  });

  await waitForBackend(backendOrigin);
  appendLog('backend', 'Backend is healthy', { origin: backendOrigin });
};

const createMenu = () => {
  const template = [
    {
      label: 'File',
      submenu: [{ role: 'quit', label: 'Exit' }],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        ...(isDev ? [{ role: 'toggleDevTools' }] : []),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'close' }],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

const createWindow = async () => {
  const additionalArguments = [
    `--prime-backend-origin=${backendOrigin}`,
    `--prime-offline-mode=true`,
    `--prime-app-version=${app.getVersion()}`,
    `--prime-user-data=${encodeURIComponent(getUserDataPath())}`,
  ];

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    backgroundColor: '#f3f0ec',
    icon: getIconPath(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      plugins: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, 'preload.js'),
      additionalArguments,
    },
  });

  // Security: Implement Content-Security-Policy
  const { session } = require('electron');
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    // Allow WebAssembly in both dev and production for offline desktop app
    const CSP = isDev
      ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:* data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://127.0.0.1:* http://localhost:*; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:* data: blob:; frame-src 'self' blob: data: http://127.0.0.1:* http://localhost:*; object-src 'self' blob: data:; worker-src 'self' blob:;"
      : "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:* data: blob:; frame-src 'self' blob: data: http://127.0.0.1:* http://localhost:*; object-src 'self' blob: data:; worker-src 'self' blob:;";
    
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [CSP]
      }
    });
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeWindowTarget(url)) {
      return { action: 'allow' };
    }

    showBlockedExternalMessage(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isSafeWindowTarget(url)) {
      event.preventDefault();
      showBlockedExternalMessage(url);
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    await mainWindow.loadURL(`${getFrontendEntry()}?backend=${encodeURIComponent(backendOrigin)}`);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    await mainWindow.loadFile(getFrontendEntry(), { query: { backend: backendOrigin } });
  }
};

ipcMain.on('renderer-log', (_event, payload) => {
  appendLog('renderer', payload?.message || 'Renderer log', payload);
});

ipcMain.handle('desktop:get-runtime', () => ({
  appVersion: app.getVersion(),
  backendUrl: backendOrigin,
  isElectron: true,
  offlineMode: true,
  userDataPath: getUserDataPath(),
}));

app.whenReady().then(async () => {
  app.setAppUserModelId('com.primeerp.workspace');
  createMenu();

  try {
    await startBackend();
    await createWindow();

    // Register Ctrl+Shift+I global shortcut to open dev tools
    const devToolsShortcutRegistered = globalShortcut.register('CommandOrControl+Shift+I', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools();
        } else {
          mainWindow.webContents.openDevTools({ mode: 'detach' });
        }
      }
    });

    if (!devToolsShortcutRegistered) {
      appendLog('main', 'Failed to register Ctrl+Shift+I dev tools shortcut');
    } else {
      appendLog('main', 'Ctrl+Shift+I dev tools shortcut registered successfully');
    }
  } catch (error) {
    const errorDetails = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };
    log.main('ERROR', 'Desktop startup failed', errorDetails);

    await dialog.showMessageBox({
      type: 'error',
      title: 'Prime ERP failed to start',
      message: 'The offline desktop services could not start.',
      detail: error instanceof Error ? error.stack || error.message : String(error),
    });

    stopBackend('startup-failed');
    app.quit();
  }

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('before-quit', (event) => {
  appendLog('app', 'App is preparing to quit');
  // Unregister all global shortcuts
  globalShortcut.unregisterAll();
  stopBackend('before-quit');
});

app.on('will-quit', () => {
  appendLog('app', 'App will quit');
  stopBackend('will-quit');
});

app.on('window-all-closed', () => {
  appendLog('app', 'All windows closed');
  stopBackend('window-all-closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle uncaught exceptions in the main process
process.on('uncaughtException', (error) => {
  log.main('ERROR', 'Uncaught exception in main process', {
    message: error.message,
    stack: error.stack,
  });
  stopBackend('uncaught-exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log.main('WARN', 'Unhandled promise rejection in main process', {
    reason: String(reason),
  });
});

// Handle OS signals to ensure clean shutdown
const setupSignalHandlers = () => {
  const shutdownSignal = (signal) => {
    appendLog('process', `Received ${signal}, shutting down gracefully`);
    stopBackend(signal);
    // Give the backend time to clean up, then exit
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  };

  // Handle Ctrl+C and terminal close
  if (process.platform !== 'win32') {
    process.on('SIGINT', () => shutdownSignal('SIGINT'));
    process.on('SIGTERM', () => shutdownSignal('SIGTERM'));
  }

  // On Windows, Electron handles these differently
  process.on('exit', (code) => {
    appendLog('process', `Node process exiting with code ${code}`);
    if (backendProcess && !backendProcess.killed) {
      appendLog('process', 'Force killing backend on process exit');
      try {
        process.kill(backendProcess.pid, 'SIGKILL');
      } catch (e) {
        // Ignore - process may already be dead
      }
    }
  });
};

setupSignalHandlers();
