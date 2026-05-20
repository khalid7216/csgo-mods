const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { detectCSGOPath, saveCSGOPath, loadCSGOPath } = require('../utils/csgoPath');
const { getGameBananaMaps, downloadMap, installMap, getInstalledMods, removeMod } = require('../utils/modManager');
const { createVMT, createVPK, installSkin } = require('../utils/skinManager');
const { getLocalIP, startServer, stopServer, getServerStatus, launchCSGO } = require('../utils/lanServer');
const { fetchPlayerStats, parseStats, getCachedStats } = require('../utils/statsParser');

const CONFIG_PATH = path.join(__dirname, '../../mods-cache/config.json');
const MODS_PATH = path.join(__dirname, '../../mods-cache/mods.json');
const STATS_PATH = path.join(__dirname, '../../mods-cache/stats.json');

let mainWindow;
let serverProcess = null;

function ensureCacheDir() {
  const cacheDir = path.join(__dirname, '../../mods-cache');
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ csgoPath: '', steamApiKey: '', serverConfig: { port: 27015, maxPlayers: 16, hostname: 'CSGO Mod Manager Server' } }, null, 2));
  }
  if (!fs.existsSync(MODS_PATH)) {
    fs.writeFileSync(MODS_PATH, JSON.stringify({ maps: [], skins: [] }, null, 2));
  }
  if (!fs.existsSync(STATS_PATH)) {
    fs.writeFileSync(STATS_PATH, JSON.stringify({}, null, 2));
  }
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return { csgoPath: '', steamApiKey: '', serverConfig: { port: 27015, maxPlayers: 16, hostname: 'CSGO Mod Manager Server' } };
  }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
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
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../../public/icon.ico'),
    title: 'CSGO Mod Manager'
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../src/renderer/dist/index.html'));
  }
}

app.whenReady().then(() => {
  ensureCacheDir();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) stopServer(serverProcess);
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('detect-csgo-path', async () => {
  return await detectCSGOPath();
});

ipcMain.handle('select-csgo-path', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select CSGO Folder',
    properties: ['openDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('save-csgo-path', async (_, csgoPath) => {
  const config = loadConfig();
  config.csgoPath = csgoPath;
  saveConfig(config);
  return true;
});

ipcMain.handle('load-config', () => loadConfig());

ipcMain.handle('save-config', (_, config) => {
  saveConfig(config);
  return true;
});

ipcMain.handle('fetch-gamebanana-maps', async (_, query = '', page = 1) => {
  return await getGameBananaMaps(query, page);
});

ipcMain.handle('download-map', async (_, map) => {
  const config = loadConfig();
  if (!config.csgoPath) throw new Error('CSGO path not set');
  return await downloadMap(map, config.csgoPath, (progress) => {
    mainWindow.webContents.send('download-progress', progress);
  });
});

ipcMain.handle('install-map', async (_, mapPath) => {
  const config = loadConfig();
  if (!config.csgoPath) throw new Error('CSGO path not set');
  return await installMap(mapPath, config.csgoPath);
});

ipcMain.handle('get-installed-mods', () => getInstalledMods());

ipcMain.handle('remove-mod', async (_, modId, modType) => {
  return await removeMod(modId, modType);
});

ipcMain.handle('create-vmt', async (_, vtfPath, skinName) => {
  return await createVMT(vtfPath, skinName);
});

ipcMain.handle('create-vpk', async (_, folderPath) => {
  return await createVPK(folderPath);
});

ipcMain.handle('install-skin', async (_, skinData) => {
  const config = loadConfig();
  if (!config.csgoPath) throw new Error('CSGO path not set');
  return await installSkin(skinData, config.csgoPath);
});

ipcMain.handle('get-local-ip', () => getLocalIP());

ipcMain.handle('start-server', async (_, config) => {
  const csgoConfig = loadConfig();
  if (!csgoConfig.csgoPath) throw new Error('CSGO path not set');
  serverProcess = await startServer(csgoConfig.csgoPath, config, (data) => {
    mainWindow.webContents.send('server-output', data.toString());
  });
  return true;
});

ipcMain.handle('stop-server', async () => {
  if (serverProcess) {
    stopServer(serverProcess);
    serverProcess = null;
  }
  return true;
});

ipcMain.handle('get-server-status', () => getServerStatus(serverProcess));

ipcMain.handle('launch-csgo', async (_, flags) => {
  const config = loadConfig();
  if (!config.csgoPath) throw new Error('CSGO path not set');
  return await launchCSGO(config.csgoPath, flags);
});

ipcMain.handle('fetch-player-stats', async (_, steamId, apiKey) => {
  return await fetchPlayerStats(steamId, apiKey);
});

ipcMain.handle('parse-stats', async (_, rawStats) => {
  return parseStats(rawStats);
});

ipcMain.handle('get-cached-stats', () => getCachedStats());

ipcMain.handle('save-stats', async (_, stats) => {
  fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2));
  return true;
});

ipcMain.handle('open-external', (_, url) => shell.openExternal(url));

ipcMain.handle('show-toast', (_, message, type = 'info') => {
  mainWindow.webContents.send('toast', { message, type });
});
