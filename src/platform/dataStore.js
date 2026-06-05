const crypto = require('crypto');
const fs = require('fs');
const { DEFAULT_CONFIG, ensureCacheDir, getCachePath } = require('../utils/appPaths');
const { hashPassword } = require('./auth');

const DATA_FILE = 'platform-data.json';

function nowIso() {
  return new Date().toISOString();
}

function createStats() {
  return {
    elo: 1000,
    level: 1,
    matches: 0,
    wins: 0,
    losses: 0,
    kills: 0,
    deaths: 0,
    assists: 0,
    headshots: 0
  };
}

function createProfile(user, patch = {}) {
  return {
    userId: user.id,
    displayName: user.username,
    country: '',
    avatarUrl: '',
    bio: '',
    steamId: '',
    steamPersonaName: '',
    steamProfileUrl: '',
    steamConnectedAt: null,
    ...patch
  };
}

function createSeedData() {
  const createdAt = nowIso();
  const adminId = crypto.randomUUID();
  const playerId = crypto.randomUUID();

  return {
    version: 1,
    settings: {
      tokenSecret: crypto.randomBytes(32).toString('hex')
    },
    users: [
      {
        id: adminId,
        email: 'admin@faceit.local',
        username: 'Admin',
        role: 'admin',
        status: 'active',
        passwordHash: hashPassword(process.env.FACEIT_ADMIN_PASSWORD || 'Admin@12345'),
        createdAt,
        lastLoginAt: null
      },
      {
        id: playerId,
        email: 'player@faceit.local',
        username: 'DemoPlayer',
        role: 'player',
        status: 'active',
        passwordHash: hashPassword('Player@12345'),
        createdAt,
        lastLoginAt: null
      }
    ],
    profiles: {
      [adminId]: createProfile({ id: adminId, username: 'Admin' }, {
        country: 'PK',
        bio: 'Platform administrator'
      }),
      [playerId]: createProfile({ id: playerId, username: 'DemoPlayer' }, {
        country: 'PK',
        bio: 'Ready to queue'
      })
    },
    stats: {
      [adminId]: createStats(),
      [playerId]: {
        ...createStats(),
        elo: 1125,
        level: 3,
        matches: 12,
        wins: 7,
        losses: 5,
        kills: 224,
        deaths: 178,
        assists: 48,
        headshots: 91
      }
    },
    servers: [
      {
        id: 'local-csgo',
        name: 'Local CSGO Server',
        region: 'LAN',
        ip: '127.0.0.1',
        port: DEFAULT_CONFIG.serverConfig.port,
        status: 'offline',
        lastCommandAt: null,
        config: {
          ...DEFAULT_CONFIG.serverConfig,
          hostname: 'Faceit MVP Server',
          gameMode: 'competitive',
          botsEnabled: false,
          friendlyFire: true
        }
      }
    ],
    matches: [],
    loginLogs: []
  };
}

function ensureDataFile() {
  ensureCacheDir();
  const filePath = getCachePath(DATA_FILE);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(createSeedData(), null, 2));
  }
  return filePath;
}

function readData() {
  const filePath = ensureDataFile();
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const normalized = normalizeData(data);
    if (JSON.stringify(data) !== JSON.stringify(normalized)) {
      fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2));
    }
    return normalized;
  } catch {
    const seedData = createSeedData();
    fs.writeFileSync(filePath, JSON.stringify(seedData, null, 2));
    return seedData;
  }
}

function writeData(data) {
  fs.writeFileSync(getCachePath(DATA_FILE), JSON.stringify(data, null, 2));
}

function updateData(updater) {
  const data = readData();
  const nextData = updater(data) || data;
  writeData(nextData);
  return nextData;
}

function ensureProfile(data, user) {
  if (!data.profiles[user.id]) {
    data.profiles[user.id] = createProfile(user);
  } else {
    data.profiles[user.id] = createProfile(user, data.profiles[user.id]);
  }

  if (!data.stats[user.id]) {
    data.stats[user.id] = createStats();
  }
}

function normalizeData(data) {
  const normalized = data && typeof data === 'object' ? data : {};
  normalized.version = normalized.version || 1;
  normalized.settings = normalized.settings || {};
  normalized.settings.tokenSecret = normalized.settings.tokenSecret || crypto.randomBytes(32).toString('hex');
  normalized.users = Array.isArray(normalized.users) ? normalized.users : [];
  normalized.profiles = normalized.profiles && typeof normalized.profiles === 'object' ? normalized.profiles : {};
  normalized.stats = normalized.stats && typeof normalized.stats === 'object' ? normalized.stats : {};
  normalized.servers = Array.isArray(normalized.servers) && normalized.servers.length
    ? normalized.servers
    : createSeedData().servers;
  normalized.matches = Array.isArray(normalized.matches) ? normalized.matches : [];
  normalized.loginLogs = Array.isArray(normalized.loginLogs) ? normalized.loginLogs : [];

  for (const user of normalized.users) {
    ensureProfile(normalized, user);
  }

  return normalized;
}

module.exports = {
  createProfile,
  createStats,
  ensureProfile,
  readData,
  updateData,
  writeData
};
