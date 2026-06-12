const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const WebSocket = require('ws');
const { detectCSGOPath, validateCSGOPath, saveCSGOPath, loadCSGOPath } = require('../utils/csgoPath');
const { getGameBananaMaps, getGameBananaSkins, downloadMap, downloadSkin, installMap, getInstalledMods, removeMod } = require('../utils/modManager');
const { createVMT, createVPK, installSkin } = require('../utils/skinManager');
const { getLocalIP, startServer, stopServer, getServerStatus, launchCSGO, installDedicatedServer, findDedicatedServer, startListening, stopListening } = require('../utils/lanServer');
const { fetchPlayerStats, fetchPlayerProfile, parseStats, getCachedStats } = require('../utils/statsParser');
const { DEFAULT_CONFIG, DEFAULT_MODS, DEFAULT_STATS, ensureCacheFile, getCachePath } = require('../utils/appPaths');
const { createApiServer } = require('../platform/apiServer');
const {
  validatePath,
  validateUrl,
  validateSteamId,
  validateApiKey,
  validatePort,
  validatePageSize,
  validateQuery,
  sanitizeFileName,
  validateModType,
  isSafePath
} = require('../utils/security');

let mainWindow;
let platformApi;

function ensureCacheDir() {
  ensureCacheFile('config.json', DEFAULT_CONFIG);
  ensureCacheFile('mods.json', DEFAULT_MODS);
  ensureCacheFile('stats.json', DEFAULT_STATS);
}

function loadConfig() {
  try {
    const loadedConfig = JSON.parse(fs.readFileSync(getCachePath('config.json'), 'utf8'));
    return {
      ...DEFAULT_CONFIG,
      ...loadedConfig,
      serverConfig: {
        ...DEFAULT_CONFIG.serverConfig,
        ...(loadedConfig.serverConfig || {})
      }
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(config) {
  fs.writeFileSync(getCachePath('config.json'), JSON.stringify(config, null, 2));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false
    },
    icon: path.join(__dirname, '../../public/icon.ico'),
    title: 'CSGO Mod Manager'
  });

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline'; " +
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
          "img-src 'self' data: https: blob:; " +
          "media-src 'self' https://res.cloudinary.com; " +
          "connect-src 'self' http://localhost:4180 http://127.0.0.1:4180 https://api.gamebanana.com https://gamebanana.com https://api.steampowered.com https://res.cloudinary.com; " +
          "font-src 'self' https://fonts.gstatic.com;"
        ]
      }
    });
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const validation = validateUrl(url);
    if (validation.valid) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/dist/index.html'));
  }

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key === 'I') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
    if (input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });
}

async function startPlatformApi() {
  platformApi = createApiServer();
  try {
    await platformApi.start();
  } catch (error) {
    if (error && error.code !== 'EADDRINUSE') {
      console.warn('Faceit MVP API failed to start:', error.message);
    }
  }
}

app.whenReady().then(async () => {
  ensureCacheDir();
  await startPlatformApi();
  createWindow();
  startListening((serverData) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server-found', serverData);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopServer();
  if (platformApi) {
    platformApi.close().catch(() => {});
  }
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('detect-csgo-path', async () => {
  return await detectCSGOPath();
});

ipcMain.handle('validate-csgo-path', async (_, csgoPath) => {
  return validateCSGOPath(csgoPath);
});

ipcMain.handle('select-csgo-path', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select CSGO Folder',
    properties: ['openDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const selectedPath = result.filePaths[0];
    if (isSafePath(selectedPath)) {
      return selectedPath;
    }
  }
  return null;
});

ipcMain.handle('save-csgo-path', async (_, csgoPath) => {
  if (!isSafePath(csgoPath)) {
    throw new Error('Invalid path');
  }
  const config = loadConfig();
  config.csgoPath = csgoPath;
  saveConfig(config);
  return true;
});

ipcMain.handle('load-config', () => loadConfig());

ipcMain.handle('save-config', (_, config) => {
  if (!config || typeof config !== 'object') {
    throw new Error('Invalid config');
  }
  saveConfig(config);
  return true;
});

ipcMain.handle('fetch-gamebanana-maps', async (_, query = '', page = 1) => {
  const queryValidation = validateQuery(query);
  if (!queryValidation.valid) {
    throw new Error(queryValidation.error);
  }
  const pageValidation = validatePageSize(page);
  if (!pageValidation.valid) {
    throw new Error(pageValidation.error);
  }
  return await getGameBananaMaps(queryValidation.query, pageValidation.page);
});

ipcMain.handle('fetch-gamebanana-skins', async (_, query = '', page = 1) => {
  const queryValidation = validateQuery(query);
  if (!queryValidation.valid) {
    throw new Error(queryValidation.error);
  }
  const pageValidation = validatePageSize(page);
  if (!pageValidation.valid) {
    throw new Error(pageValidation.error);
  }
  return await getGameBananaSkins(queryValidation.query, pageValidation.page);
});

ipcMain.handle('download-map', async (_, map) => {
  if (!map || !map.id || !map.name) {
    throw new Error('Invalid map data');
  }
  const config = loadConfig();
  if (!config.csgoPath) throw new Error('CSGO path not set');
  const pathValidation = validatePath(config.csgoPath, path.resolve(config.csgoPath));
  if (!pathValidation.valid) {
    throw new Error(pathValidation.error);
  }
  return await downloadMap(map, config.csgoPath, (progress) => {
    mainWindow.webContents.send('download-progress', progress);
  });
});

ipcMain.handle('download-skin', async (_, skin) => {
  if (!skin || !skin.id || !skin.name) {
    throw new Error('Invalid skin data');
  }
  const config = loadConfig();
  if (!config.csgoPath) throw new Error('CSGO path not set');
  const pathValidation = validatePath(config.csgoPath, path.resolve(config.csgoPath));
  if (!pathValidation.valid) {
    throw new Error(pathValidation.error);
  }
  return await downloadSkin(skin, config.csgoPath, (progress) => {
    mainWindow.webContents.send('download-progress', progress);
  });
});

ipcMain.handle('install-map', async (_, mapPath) => {
  if (!isSafePath(mapPath)) {
    throw new Error('Invalid path');
  }
  const config = loadConfig();
  if (!config.csgoPath) throw new Error('CSGO path not set');
  return await installMap(mapPath, config.csgoPath);
});

ipcMain.handle('get-installed-mods', () => getInstalledMods());

ipcMain.handle('remove-mod', async (_, modId, modType) => {
  const modTypeValidation = validateModType(modType);
  if (!modTypeValidation.valid) {
    throw new Error(modTypeValidation.error);
  }
  return await removeMod(modId, modTypeValidation.modType);
});

ipcMain.handle('create-vmt', async (_, vtfPath, skinName) => {
  if (!isSafePath(vtfPath)) {
    throw new Error('Invalid path');
  }
  if (!skinName || typeof skinName !== 'string' || skinName.length > 100) {
    throw new Error('Invalid skin name');
  }
  return await createVMT(vtfPath, skinName);
});

ipcMain.handle('create-vpk', async (_, folderPath) => {
  if (!isSafePath(folderPath)) {
    throw new Error('Invalid path');
  }
  return await createVPK(folderPath);
});

ipcMain.handle('install-skin', async (_, skinData) => {
  if (!skinData || !skinData.name) {
    throw new Error('Invalid skin data');
  }
  const config = loadConfig();
  if (!config.csgoPath) throw new Error('CSGO path not set');
  return await installSkin(skinData, config.csgoPath);
});

ipcMain.handle('get-local-ip', () => getLocalIP());

ipcMain.handle('install-dedicated-server', async () => {
  return await installDedicatedServer((data) => {
    mainWindow.webContents.send('server-output', data.toString());
  });
});

ipcMain.handle('find-dedicated-server', () => {
  return !!findDedicatedServer();
});

ipcMain.handle('start-server', async (_, config) => {
  if (!config || typeof config !== 'object') {
    throw new Error('Invalid config');
  }
  const portValidation = validatePort(config.port);
  if (!portValidation.valid) {
    throw new Error(portValidation.error);
  }
  const csgoConfig = loadConfig();
  if (!csgoConfig.csgoPath) throw new Error('CSGO path not set');
  return await startServer(csgoConfig.csgoPath, { ...config, port: portValidation.port }, (data) => {
    mainWindow.webContents.send('server-output', data.toString());
  });
});

ipcMain.handle('stop-server', async () => {
  return stopServer();
});

ipcMain.handle('get-server-status', () => getServerStatus());

ipcMain.handle('launch-csgo', async (_, flags) => {
  const config = loadConfig();
  if (!config.csgoPath) throw new Error('CSGO path not set');
  
  const validation = validateCSGOPath(config.csgoPath);
  if (!validation.valid) throw new Error('Invalid CSGO path');
  
  // Accept both string and array formats
  let flagArray = [];
  if (typeof flags === 'string') {
    flagArray = flags.split(' ').filter(f => f);
  } else if (Array.isArray(flags)) {
    flagArray = flags;
  }
  
  return await launchCSGO(config.csgoPath, flagArray);
});

ipcMain.handle('fetch-player-stats', async (_, steamId, apiKey) => {
  const steamIdValidation = validateSteamId(steamId);
  if (!steamIdValidation.valid) {
    throw new Error(steamIdValidation.error);
  }
  const apiKeyValidation = validateApiKey(apiKey);
  if (!apiKeyValidation.valid) {
    throw new Error(apiKeyValidation.error);
  }
  return await fetchPlayerStats(steamIdValidation.steamId, apiKeyValidation.apiKey);
});

ipcMain.handle('fetch-player-profile', async (_, steamId, apiKey) => {
  const steamIdValidation = validateSteamId(steamId);
  if (!steamIdValidation.valid) {
    throw new Error(steamIdValidation.error);
  }
  const apiKeyValidation = validateApiKey(apiKey);
  if (!apiKeyValidation.valid) {
    throw new Error(apiKeyValidation.error);
  }
  return await fetchPlayerProfile(steamIdValidation.steamId, apiKeyValidation.apiKey);
});

ipcMain.handle('parse-stats', async (_, rawStats) => {
  if (!rawStats || typeof rawStats !== 'object') {
    throw new Error('Invalid stats data');
  }
  return parseStats(rawStats);
});

ipcMain.handle('get-cached-stats', () => getCachedStats());

ipcMain.handle('save-stats', async (_, stats) => {
  if (!stats || typeof stats !== 'object') {
    throw new Error('Invalid stats data');
  }
  fs.writeFileSync(getCachePath('stats.json'), JSON.stringify(stats, null, 2));
  return true;
});

ipcMain.handle('open-external', (_, url) => {
  const validation = validateUrl(url);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  return shell.openExternal(validation.url);
});

ipcMain.handle('launch-steam-game', (_, steamUrl) => {
  if (!steamUrl || typeof steamUrl !== 'string' || !steamUrl.startsWith('steam://')) {
    throw new Error('Invalid Steam URL');
  }
  return shell.openExternal(steamUrl);
});

let wss = null;
let discoveryData = null;

function addFirewallRule() {
  return new Promise((resolve) => {
    const ruleName = 'CSGO WS Discovery 27016';
    exec(`netsh advfirewall firewall show rule name="${ruleName}"`, (err, stdout) => {
      if (!err && stdout.includes(ruleName)) {
        console.log('[firewall] rule already exists');
        return resolve(true);
      }
      console.log('[firewall] rule not found, requesting UAC elevation...');
      const tmpFile = path.join(os.tmpdir(), 'fw-rule-' + Date.now() + '.vbs');
      const vbsContent = `CreateObject("Shell.Application").ShellExecute "netsh", "advfirewall firewall add rule name=""${ruleName}"" dir=in action=allow protocol=TCP localport=27016", "", "runas", 0`;
      try {
        fs.writeFileSync(tmpFile, vbsContent, 'utf-8');
        exec(`cscript //Nologo "${tmpFile}"`, { timeout: 30000 }, (e) => {
          try { fs.unlinkSync(tmpFile); } catch {}
          if (e) {
            console.log('[firewall] UAC denied or failed:', e.message);
            resolve(false);
          } else {
            console.log('[firewall] rule added via UAC');
            resolve(true);
          }
        });
      } catch (e) {
        console.log('[firewall] failed to write vbs:', e.message);
        resolve(false);
      }
    });
  });
}

ipcMain.handle('start-broadcast', async (e, serverInfo) => {
  if (wss) {
    wss.close();
    wss = null;
  }
  discoveryData = serverInfo;
  try {
    wss = new WebSocket.Server({ port: 27016 });
    wss.on('connection', (ws) => {
      ws.send(JSON.stringify({
        type: 'CSGO_MOD_MANAGER_SERVER',
        ...discoveryData
      }));
    });
    wss.on('error', (err) => {
      console.error('[ws-server] error:', err.message);
    });
  } catch (err) {
    console.error('[ws-server] failed to start:', err.message);
  }
  console.log('[ws-server] started on port 27016');
  addFirewallRule().then(firewallOk => {
    if (!firewallOk) {
      mainWindow?.webContents?.send('toast', { message: 'Players cannot connect? Port 27016 blocked by Windows Firewall. Add rule manually.', type: 'warning' });
    }
  });
  return { ok: true, adminIP: serverInfo.ip };
});

ipcMain.handle('stop-broadcast', () => {
  if (wss) {
    wss.close();
    wss = null;
  }
  discoveryData = null;
  return true;
});

ipcMain.handle('start-listening', () => {
  startListening((serverData) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server-found', serverData);
    }
  });
  return true;
});

ipcMain.handle('stop-listening', () => {
  stopListening();
  return true;
});

ipcMain.handle('show-toast', (_, message, type = 'info') => {
  if (!message || typeof message !== 'string' || message.length > 500) {
    return;
  }
  mainWindow.webContents.send('toast', { message, type });
});
