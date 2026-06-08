const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  detectCSGOPath: () => ipcRenderer.invoke('detect-csgo-path'),
  validateCSGOPath: (path) => ipcRenderer.invoke('validate-csgo-path', path),
  selectCSGOPath: () => ipcRenderer.invoke('select-csgo-path'),
  saveCSGOPath: (path) => ipcRenderer.invoke('save-csgo-path', path),
  loadConfig: () => ipcRenderer.invoke('load-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  fetchGameBananaMaps: (query, page) => ipcRenderer.invoke('fetch-gamebanana-maps', query, page),
  fetchGameBananaSkins: (query, page) => ipcRenderer.invoke('fetch-gamebanana-skins', query, page),
  downloadMap: (map) => ipcRenderer.invoke('download-map', map),
  downloadSkin: (skin) => ipcRenderer.invoke('download-skin', skin),
  installMap: (mapPath) => ipcRenderer.invoke('install-map', mapPath),
  getInstalledMods: () => ipcRenderer.invoke('get-installed-mods'),
  removeMod: (modId, modType) => ipcRenderer.invoke('remove-mod', modId, modType),
  createVMT: (vtfPath, skinName) => ipcRenderer.invoke('create-vmt', vtfPath, skinName),
  createVPK: (folderPath) => ipcRenderer.invoke('create-vpk', folderPath),
  installSkin: (skinData) => ipcRenderer.invoke('install-skin', skinData),
  getLocalIP: () => ipcRenderer.invoke('get-local-ip'),
  startServer: (config) => ipcRenderer.invoke('start-server', config),
  stopServer: () => ipcRenderer.invoke('stop-server'),
  getServerStatus: () => ipcRenderer.invoke('get-server-status'),
  launchCSGO: (flags) => ipcRenderer.invoke('launch-csgo', flags),
  fetchPlayerStats: (steamId, apiKey) => ipcRenderer.invoke('fetch-player-stats', steamId, apiKey),
  fetchPlayerProfile: (steamId, apiKey) => ipcRenderer.invoke('fetch-player-profile', steamId, apiKey),
  parseStats: (rawStats) => ipcRenderer.invoke('parse-stats', rawStats),
  getCachedStats: () => ipcRenderer.invoke('get-cached-stats'),
  saveStats: (stats) => ipcRenderer.invoke('save-stats', stats),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  installDedicatedServer: () => ipcRenderer.invoke('install-dedicated-server'),
  findDedicatedServer: () => ipcRenderer.invoke('find-dedicated-server'),
  startBroadcast: (serverInfo) => ipcRenderer.invoke('start-broadcast', serverInfo),
  stopBroadcast: () => ipcRenderer.invoke('stop-broadcast'),
  startListening: () => ipcRenderer.invoke('start-listening'),
  stopListening: () => ipcRenderer.invoke('stop-listening'),
  onServerFound: (callback) => {
    ipcRenderer.on('server-found', (_, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('server-found');
  },
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (_, data) => callback(data)),
  onServerOutput: (callback) => ipcRenderer.on('server-output', (_, data) => callback(data)),
  onToast: (callback) => ipcRenderer.on('toast', (_, data) => callback(data))
});
