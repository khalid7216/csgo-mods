const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const MODS_PATH = path.join(__dirname, '../../mods-cache/mods.json');

function ensureModsFile() {
  if (!fs.existsSync(MODS_PATH)) {
    fs.writeFileSync(MODS_PATH, JSON.stringify({ maps: [], skins: [] }, null, 2));
  }
}

function getMods() {
  ensureModsFile();
  return JSON.parse(fs.readFileSync(MODS_PATH, 'utf8'));
}

function saveMods(mods) {
  fs.writeFileSync(MODS_PATH, JSON.stringify(mods, null, 2));
}

async function getGameBananaMaps(query = '', page = 1) {
  return new Promise((resolve, reject) => {
    const searchQuery = query ? `&search_term=${encodeURIComponent(query)}` : '';
    const url = `https://gamebanana.com/apiv11/Update/All?_nPerPage=20&_nPage=${page}&_aGameRow=Games& _idGameRow=4&_sSortBy=DateAdded${searchQuery}`;

    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'CSGO-Mod-Manager/1.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const maps = (parsed.records || []).map((item) => ({
            id: item._idRow,
            name: item._sName,
            description: item._sText,
            author: item._sSubmitterName,
            image: item._aAttachments?.[0]?._sUrl620Auto || '',
            downloadUrl: `https://gamebanana.com/download/${item._idRow}`,
            dateAdded: item._tsDateAdded
          }));
          resolve({ maps, total: parsed._nRecordCount || 0, page });
        } catch (e) {
          resolve({ maps: [], total: 0, page });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function downloadMap(map, csgoPath, onProgress) {
  return new Promise((resolve, reject) => {
    const mapsDir = path.join(csgoPath, 'maps');
    if (!fs.existsSync(mapsDir)) fs.mkdirSync(mapsDir, { recursive: true });

    const fileName = `${map.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.bsp`;
    const filePath = path.join(mapsDir, fileName);

    const url = map.downloadUrl;
    const client = url.startsWith('https') ? https : http;

    const req = client.get(url, { headers: { 'User-Agent': 'CSGO-Mod-Manager/1.0' } }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        downloadMap({ ...map, downloadUrl: res.headers.location }, csgoPath, onProgress).then(resolve).catch(reject);
        return;
      }

      const totalSize = parseInt(res.headers['content-length'], 10);
      let downloaded = 0;
      const fileStream = fs.createWriteStream(filePath);

      res.on('data', (chunk) => {
        downloaded += chunk.length;
        if (onProgress && totalSize) {
          onProgress({ percent: Math.round((downloaded / totalSize) * 100), downloaded, total: totalSize });
        }
      });

      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        const mods = getMods();
        mods.maps.push({
          id: map.id,
          name: map.name,
          fileName,
          filePath,
          installedAt: new Date().toISOString()
        });
        saveMods(mods);
        resolve({ success: true, filePath, fileName });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function installMap(mapPath, csgoPath) {
  const mapsDir = path.join(csgoPath, 'maps');
  if (!fs.existsSync(mapsDir)) fs.mkdirSync(mapsDir, { recursive: true });

  const fileName = path.basename(mapPath);
  const destPath = path.join(mapsDir, fileName);
  fs.copyFileSync(mapPath, destPath);

  const mods = getMods();
  mods.maps.push({
    id: Date.now(),
    name: fileName.replace('.bsp', ''),
    fileName,
    filePath: destPath,
    installedAt: new Date().toISOString()
  });
  saveMods(mods);
  return { success: true, filePath: destPath };
}

async function getInstalledMods() {
  return getMods();
}

async function removeMod(modId, modType) {
  const mods = getMods();
  const index = mods[modType].findIndex((m) => m.id === modId);
  if (index === -1) return { success: false, error: 'Mod not found' };

  const mod = mods[modType][index];
  if (mod.filePath && fs.existsSync(mod.filePath)) {
    fs.unlinkSync(mod.filePath);
  }
  mods[modType].splice(index, 1);
  saveMods(mods);
  return { success: true };
}

module.exports = { getGameBananaMaps, downloadMap, installMap, getInstalledMods, removeMod };
