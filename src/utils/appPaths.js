const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG = {
  csgoPath: '',
  steamId: '',
  steamApiKey: '',
  serverConfig: {
    map: 'de_dust2',
    gameMode: 'casual',
    botsEnabled: false,
    freezeTime: false,
    skipWarmup: true,
    friendlyFire: true,
    port: 27015,
    maxPlayers: 16,
    hostname: 'CSGO Mod Manager Server',
    rconPassword: 'changeme',
    customCommands: ''
  }
};

const DEFAULT_MODS = { maps: [], skins: [] };
const DEFAULT_STATS = {};

function getElectronApp() {
  try {
    const electron = require('electron');
    if (electron && electron.app && typeof electron.app.getPath === 'function') {
      return electron.app;
    }
  } catch {}

  return null;
}

function getProjectRoot() {
  return path.resolve(__dirname, '..', '..');
}

function getCacheDir() {
  const electronApp = getElectronApp();
  if (electronApp && electronApp.isPackaged) {
    return path.join(electronApp.getPath('userData'), 'mods-cache');
  }

  return path.join(getProjectRoot(), 'mods-cache');
}

function ensureCacheDir() {
  const cacheDir = getCacheDir();
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  return cacheDir;
}

function getCachePath(fileName) {
  return path.join(getCacheDir(), fileName);
}

function ensureCacheFile(fileName, fallbackValue) {
  ensureCacheDir();
  const filePath = getCachePath(fileName);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallbackValue, null, 2));
  }
  return filePath;
}

module.exports = {
  DEFAULT_CONFIG,
  DEFAULT_MODS,
  DEFAULT_STATS,
  ensureCacheDir,
  ensureCacheFile,
  getCacheDir,
  getCachePath
};
