const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { validateUrl, validateFileSize, ALLOWED_DOMAINS, MAX_FILE_SIZE } = require('./security');
const { DEFAULT_MODS, ensureCacheFile, getCacheDir, getCachePath } = require('./appPaths');

const API_BASE = 'https://api.gamebanana.com';
const CS_GAME_ID = 4660; // CS:GO GameBanana game ID

const FIELDS = 'name,text,creator,Preview().sStructuredDataFullsizeUrl(),Url().sProfileUrl(),Url().sDownloadUrl(),date,views,likes,Files().aFiles(),Game().name,Category().name,RootCategory().name';

function ensureModsFile() {
  ensureCacheFile('mods.json', DEFAULT_MODS);
}

function getMods() {
  ensureModsFile();
  return JSON.parse(fs.readFileSync(getCachePath('mods.json'), 'utf8'));
}

function saveMods(mods) {
  fs.writeFileSync(getCachePath('mods.json'), JSON.stringify(mods, null, 2));
}

function apiRequest(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'CSGO-Mod-Manager/1.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function parseMod(id, data) {
  const files = data['Files().aFiles()'] || {};
  const firstFile = Object.values(files)[0] || {};
  return {
    id,
    name: data.name || '',
    description: (data.text || '').replace(/<[^>]*>/g, ''),
    author: data.creator || '',
    image: data['Preview().sStructuredDataFullsizeUrl()'] || '',
    downloadUrl: data['Url().sDownloadUrl()'] || `https://gamebanana.com/mods/download/${id}`,
    profileUrl: data['Url().sProfileUrl()'] || `https://gamebanana.com/mods/${id}`,
    dateAdded: data.date || 0,
    views: data.views || 0,
    likes: data.likes || 0,
    game: data['Game().name'] || '',
    category: data['Category().name'] || '',
    rootCategory: data['RootCategory().name'] || '',
    files: Object.values(files).map(f => ({
      name: f._sFile,
      size: f._nFilesize,
      url: f._sDownloadUrl
    }))
  };
}

async function fetchModData(ids) {
  const results = [];
  for (const id of ids) {
    try {
      const url = `${API_BASE}/Core/Item/Data?itemtype=Mod&itemid=${id}&fields=${FIELDS}&return_object=1`;
      const data = await apiRequest(url);
      if (data && data.name) {
        results.push(parseMod(id, data));
      }
    } catch (e) {
      console.error(`Failed to fetch mod ${id}:`, e.message);
    }
  }
  return results;
}

async function getGameBananaMaps(query = '', page = 1) {
  try {
    const url = `${API_BASE}/Core/List/New?itemtype=Mod&gameid=${CS_GAME_ID}&page=${page}`;
    const ids = await apiRequest(url);

    const modIds = (ids || []).filter(item => item[0] === 'Mod').map(item => item[1]);

    if (modIds.length === 0) return { maps: [], total: 0, page };

    const allMods = await fetchModData(modIds);
    let maps = allMods.filter(m =>
      m.rootCategory === 'Maps' || m.category === 'Maps'
    );

    if (query) {
      const q = query.toLowerCase();
      maps = maps.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q)
      );
    }

    return { maps, total: maps.length, page };
  } catch (e) {
    console.error('Maps fetch error:', e);
    return { maps: [], total: 0, page };
  }
}

async function getGameBananaSkins(query = '', page = 1) {
  try {
    const url = `${API_BASE}/Core/List/New?itemtype=Mod&gameid=${CS_GAME_ID}&page=${page}`;
    const ids = await apiRequest(url);

    const modIds = (ids || []).filter(item => item[0] === 'Mod').map(item => item[1]);

    if (modIds.length === 0) return { skins: [], total: 0, page };

    const allMods = await fetchModData(modIds);
    let skins = allMods.filter(m =>
      m.rootCategory === 'Skins' || m.category === 'Skins' ||
      m.rootCategory === 'Weps' || m.category === 'Weps'
    );

    if (query) {
      const q = query.toLowerCase();
      skins = skins.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q)
      );
    }

    return { skins, total: skins.length, page };
  } catch (e) {
    console.error('Skins fetch error:', e);
    return { skins: [], total: 0, page };
  }
}

async function getGameBananaItem(itemid) {
  try {
    const url = `${API_BASE}/Core/Item/Data?itemtype=Mod&itemid=${itemid}&fields=${FIELDS}&return_object=1`;
    const data = await apiRequest(url);
    return parseMod(itemid, data);
  } catch (e) {
    console.error('Item fetch error:', e);
    return null;
  }
}

async function downloadFile(item, csgoPath, onProgress, type = 'map') {
  return new Promise((resolve, reject) => {
    const dir = type === 'map'
      ? path.join(csgoPath, 'maps')
      : path.join(csgoPath, 'csgo', 'materials', 'models', 'weapons', 'custom');

    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const fileName = `${item.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${item.id}`;
    const filePath = path.join(dir, fileName);

    const downloadUrl = item.files?.[0]?.url || item.downloadUrl;

    const urlValidation = validateUrl(downloadUrl);
    if (!urlValidation.valid) {
      reject(new Error(`Invalid download URL: ${urlValidation.error}`));
      return;
    }

    const client = downloadUrl.startsWith('https') ? https : http;

    const req = client.get(downloadUrl, { headers: { 'User-Agent': 'CSGO-Mod-Manager/1.0' } }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        const redirectUrl = res.headers.location;
        const redirectValidation = validateUrl(redirectUrl);
        if (!redirectValidation.valid) {
          reject(new Error(`Invalid redirect URL: ${redirectValidation.error}`));
          return;
        }
        downloadFile({ ...item, downloadUrl: redirectUrl }, csgoPath, onProgress, type).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`Download failed with status ${res.statusCode}`));
        return;
      }

      const totalSize = parseInt(res.headers['content-length'], 10);
      if (totalSize) {
        const sizeValidation = validateFileSize(totalSize);
        if (!sizeValidation.valid) {
          reject(new Error(sizeValidation.error));
          return;
        }
      }

      let downloaded = 0;
      const fileStream = fs.createWriteStream(filePath);

      res.on('data', (chunk) => {
        downloaded += chunk.length;
        if (downloaded > MAX_FILE_SIZE) {
          fileStream.destroy();
          reject(new Error('File size exceeds maximum limit'));
          return;
        }
        if (onProgress && totalSize) {
          onProgress({ percent: Math.round((downloaded / totalSize) * 100), downloaded, total: totalSize });
        }
      });

      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        const mods = getMods();
        const modType = type === 'map' ? 'maps' : 'skins';
        mods[modType].push({
          id: item.id,
          name: item.name,
          fileName,
          filePath,
          profileUrl: item.profileUrl,
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

async function downloadMap(map, csgoPath, onProgress) {
  return downloadFile(map, csgoPath, onProgress, 'map');
}

async function downloadSkin(skin, csgoPath, onProgress) {
  return downloadFile(skin, csgoPath, onProgress, 'skin');
}

async function installMap(mapPath, csgoPath) {
  const mapsDir = path.join(csgoPath, 'maps');
  if (!fs.existsSync(mapsDir)) fs.mkdirSync(mapsDir, { recursive: true });

  const fileName = path.basename(mapPath);
  const destPath = path.join(mapsDir, fileName);

  const resolvedDest = path.resolve(destPath);
  const resolvedMapsDir = path.resolve(mapsDir);
  if (!resolvedDest.startsWith(resolvedMapsDir)) {
    throw new Error('Path traversal detected');
  }

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
    const resolvedPath = path.resolve(mod.filePath);
    const resolvedModDir = path.resolve(getCacheDir());
    if (resolvedPath.startsWith(resolvedModDir)) {
      fs.unlinkSync(mod.filePath);
    }
  }
  mods[modType].splice(index, 1);
  saveMods(mods);
  return { success: true };
}

module.exports = {
  getGameBananaMaps,
  getGameBananaSkins,
  getGameBananaItem,
  downloadMap,
  downloadSkin,
  installMap,
  getInstalledMods,
  removeMod
};
