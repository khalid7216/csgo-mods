const DEFAULT_CONFIG = {
  csgoPath: '',
  steamApiKey: '',
  serverConfig: {
    port: 27015,
    maxPlayers: 16,
    hostname: 'CSGO Mod Manager Server'
  }
};

const DEFAULT_MODS = { maps: [], skins: [] };
const DEFAULT_STATS = {};
const STORAGE_KEYS = {
  config: 'csgo-mod-manager:config',
  mods: 'csgo-mod-manager:mods',
  stats: 'csgo-mod-manager:stats'
};

const API_BASE = 'https://api.gamebanana.com';
const CS_GAME_ID = 4660;
const FIELDS = 'name,text,creator,Preview().sStructuredDataFullsizeUrl(),Url().sProfileUrl(),Url().sDownloadUrl(),date,views,likes,Files().aFiles(),Game().name,Category().name,RootCategory().name';

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseMod(id, data) {
  const files = data['Files().aFiles()'] || {};
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
    files: Object.values(files).map((file) => ({
      name: file._sFile,
      size: file._nFilesize,
      url: file._sDownloadUrl
    }))
  };
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }
  return response.json();
}

async function fetchGameBananaDirect(type, query, page) {
  const list = await fetchJson(`${API_BASE}/Core/List/New?itemtype=Mod&gameid=${CS_GAME_ID}&page=${page}`);
  const ids = (Array.isArray(list) ? list : [])
    .filter((item) => item[0] === 'Mod')
    .map((item) => item[1])
    .slice(0, 15);

  const mods = await Promise.all(ids.map(async (id) => {
    try {
      const url = `${API_BASE}/Core/Item/Data?itemtype=Mod&itemid=${id}&fields=${encodeURIComponent(FIELDS)}&return_object=1`;
      const data = await fetchJson(url);
      return data && data.name ? parseMod(id, data) : null;
    } catch {
      return null;
    }
  }));

  const normalizedQuery = String(query || '').toLowerCase();
  const filtered = mods
    .filter(Boolean)
    .filter((mod) => {
      if (type === 'skins') {
        return ['Skins', 'Weps'].includes(mod.rootCategory) || ['Skins', 'Weps'].includes(mod.category);
      }

      return mod.rootCategory === 'Maps' || mod.category === 'Maps';
    })
    .filter((mod) => {
      if (!normalizedQuery) return true;
      return mod.name.toLowerCase().includes(normalizedQuery) || mod.description.toLowerCase().includes(normalizedQuery);
    });

  return {
    [type]: filtered,
    total: filtered.length,
    page
  };
}

async function fetchGameBanana(type, query, page) {
  const params = new URLSearchParams({
    type,
    query: query || '',
    page: String(page || 1)
  });

  try {
    return await fetchJson(`/api/gamebanana?${params.toString()}`);
  } catch {
    return fetchGameBananaDirect(type, query, page);
  }
}

function desktopOnly(feature) {
  return Promise.reject(new Error(`${feature} is available in the Windows desktop app only.`));
}

function parseStats(rawStats) {
  if (!rawStats || !rawStats.stats) return null;

  const stats = {};
  for (const stat of rawStats.stats) {
    stats[stat.name] = stat.value;
  }

  const kills = stats.total_kills || 0;
  const deaths = stats.total_deaths || 1;
  const headshots = stats.total_kills_headshots || 0;
  const mvps = stats.total_mvps || 0;
  const pistolKills = stats.total_kills_pistol || 0;
  const wins = stats.total_wins || 0;
  const shotsFired = stats.total_shots_fired || 0;
  const shotsHit = stats.total_hits || 0;
  const roundsPlayed = stats.total_rounds_played || 0;
  const matchesPlayed = stats.total_matches_played || 0;
  const damageDone = stats.total_damage_done || 0;
  const moneyEarned = stats.total_money_earned || 0;
  const enemiesFlashed = stats.total_enemies_flashed || 0;
  const knifeKills = stats.total_kills_knife || 0;
  const taserKills = stats.total_kills_taser || 0;

  return {
    kills,
    deaths,
    kdRatio: (kills / deaths).toFixed(2),
    headshots,
    hsPercentage: kills > 0 ? ((headshots / kills) * 100).toFixed(1) : 0,
    mvps,
    pistolKills,
    wins,
    shotsFired,
    shotsHit,
    accuracy: shotsFired > 0 ? ((shotsHit / shotsFired) * 100).toFixed(1) : 0,
    roundsPlayed,
    matchesPlayed,
    winRate: matchesPlayed > 0 ? ((wins / matchesPlayed) * 100).toFixed(1) : 0,
    damageDone,
    avgDamagePerRound: roundsPlayed > 0 ? (damageDone / roundsPlayed).toFixed(0) : 0,
    moneyEarned,
    enemiesFlashed,
    knifeKills,
    taserKills,
    closeRangeKills: pistolKills + knifeKills + taserKills
  };
}

function createBrowserApi() {
  const listeners = {
    toast: new Set(),
    downloadProgress: new Set(),
    serverOutput: new Set()
  };

  return {
    detectCSGOPath: () => Promise.resolve(null),
    validateCSGOPath: (csgoPath) => Promise.resolve(
      csgoPath
        ? { valid: false, error: 'Path validation requires the Windows desktop app' }
        : { valid: false, error: 'Path is empty' }
    ),
    selectCSGOPath: () => Promise.resolve(null),
    saveCSGOPath: (csgoPath) => {
      const config = readJson(STORAGE_KEYS.config, clone(DEFAULT_CONFIG));
      const nextConfig = { ...config, csgoPath };
      writeJson(STORAGE_KEYS.config, nextConfig);
      return Promise.resolve(true);
    },
    loadConfig: () => Promise.resolve({
      ...clone(DEFAULT_CONFIG),
      ...readJson(STORAGE_KEYS.config, clone(DEFAULT_CONFIG))
    }),
    saveConfig: (config) => {
      writeJson(STORAGE_KEYS.config, {
        ...clone(DEFAULT_CONFIG),
        ...config
      });
      return Promise.resolve(true);
    },
    fetchGameBananaMaps: (query, page) => fetchGameBanana('maps', query, page),
    fetchGameBananaSkins: (query, page) => fetchGameBanana('skins', query, page),
    downloadMap: () => desktopOnly('Map install'),
    downloadSkin: () => desktopOnly('Skin install'),
    installMap: () => desktopOnly('Map install'),
    getInstalledMods: () => Promise.resolve(readJson(STORAGE_KEYS.mods, clone(DEFAULT_MODS))),
    removeMod: (modId, modType) => {
      const mods = readJson(STORAGE_KEYS.mods, clone(DEFAULT_MODS));
      mods[modType] = (mods[modType] || []).filter((mod) => mod.id !== modId);
      writeJson(STORAGE_KEYS.mods, mods);
      return Promise.resolve({ success: true });
    },
    createVMT: () => desktopOnly('VMT creation'),
    createVPK: () => desktopOnly('VPK creation'),
    installSkin: () => desktopOnly('Skin install'),
    getLocalIP: () => Promise.resolve('127.0.0.1'),
    startServer: () => desktopOnly('LAN server'),
    stopServer: () => Promise.resolve(false),
    getServerStatus: () => Promise.resolve({ running: false }),
    launchCSGO: () => desktopOnly('CSGO launch'),
    fetchPlayerStats: async (steamId, apiKey) => {
      const url = `https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v0002/?appid=730&key=${encodeURIComponent(apiKey)}&steamid=${encodeURIComponent(steamId)}`;
      const data = await fetchJson(url);
      return data.playerstats?.error ? { error: data.playerstats.error } : data.playerstats;
    },
    parseStats: (rawStats) => Promise.resolve(parseStats(rawStats)),
    getCachedStats: () => Promise.resolve(readJson(STORAGE_KEYS.stats, clone(DEFAULT_STATS))),
    saveStats: (stats) => {
      writeJson(STORAGE_KEYS.stats, stats);
      return Promise.resolve(true);
    },
    openExternal: (url) => {
      window.open(url, '_blank', 'noopener,noreferrer');
      return Promise.resolve(true);
    },
    installDedicatedServer: () => desktopOnly('Dedicated server install'),
    findDedicatedServer: () => Promise.resolve(false),
    onDownloadProgress: (callback) => {
      listeners.downloadProgress.add(callback);
      return () => listeners.downloadProgress.delete(callback);
    },
    onServerOutput: (callback) => {
      listeners.serverOutput.add(callback);
      return () => listeners.serverOutput.delete(callback);
    },
    onToast: (callback) => {
      listeners.toast.add(callback);
      return () => listeners.toast.delete(callback);
    },
    showToast: (message, type = 'info') => {
      listeners.toast.forEach((callback) => callback({ message, type }));
      return Promise.resolve(true);
    }
  };
}

if (typeof window !== 'undefined' && !window.electronAPI) {
  window.electronAPI = createBrowserApi();
}
