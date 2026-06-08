const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const { URL } = require('url');
const { DEFAULT_CONFIG, getCachePath } = require('../utils/appPaths');
const { getLocalIP, getServerStatus, startServer, stopServer } = require('../utils/lanServer');
const { createToken, hashPassword, publicUser, verifyPassword, verifyToken } = require('./auth');
const { createStats, ensureProfile, readData, updateData } = require('./dataStore');

const DEFAULT_PORT = Number(process.env.FACEIT_API_PORT || 4180);
const DEFAULT_HOST = process.env.FACEIT_API_HOST || '0.0.0.0';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAP_RE = /^[a-zA-Z0-9_]+$/;
const STEAM_ID_RE = /^\d{17}$/;
const STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login';
const STEAM_AUTH_SESSION_TTL_MS = 5 * 60 * 1000;
const MATCH_ACCEPT_TTL_MS = 45 * 1000;
const MATCH_SIZE = 2;

const serverLogs = [];
const steamAuthSessions = new Map();

function pushLog(message) {
  const line = String(message || '').trimEnd();
  if (!line) return;
  serverLogs.push({ at: new Date().toISOString(), message: line });
  if (serverLogs.length > 300) {
    serverLogs.splice(0, serverLogs.length - 300);
  }
}

function setCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Vary', 'Origin');
}

function sendJson(req, res, status, body) {
  setCors(req, res);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function sendError(req, res, status, message) {
  sendJson(req, res, status, { error: message });
}

function sendHtml(req, res, status, html) {
  setCors(req, res);
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        req.destroy();
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function loadDesktopConfig() {
  try {
    const config = JSON.parse(fs.readFileSync(getCachePath('config.json'), 'utf8'));
    return {
      ...DEFAULT_CONFIG,
      ...config,
      serverConfig: {
        ...DEFAULT_CONFIG.serverConfig,
        ...(config.serverConfig || {})
      }
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeUsername(username) {
  return String(username || '').trim().replace(/\s+/g, ' ').slice(0, 32);
}

function normalizeSteamConnection(body) {
  const steamInput = String(body.steamInput || body.steamId || body.steamProfileUrl || '').trim();
  const personaName = normalizeUsername(body.steamPersonaName || body.personaName || '');
  let steamId = String(body.steamId || '').trim();
  let steamProfileUrl = String(body.steamProfileUrl || '').trim();

  if (STEAM_ID_RE.test(steamInput)) {
    steamId = steamInput;
    steamProfileUrl = steamProfileUrl || `https://steamcommunity.com/profiles/${steamInput}`;
  } else if (steamInput) {
    try {
      const url = new URL(steamInput);
      if (!['steamcommunity.com', 'www.steamcommunity.com'].includes(url.hostname.toLowerCase())) {
        return { error: 'Steam profile URL must be from steamcommunity.com' };
      }
      steamProfileUrl = url.toString();
      const profileMatch = url.pathname.match(/\/profiles\/(\d{17})/);
      if (profileMatch) {
        steamId = profileMatch[1];
      }
    } catch {
      return { error: 'Enter a SteamID64 or a Steam profile URL' };
    }
  }

  if (steamId && !STEAM_ID_RE.test(steamId)) {
    return { error: 'SteamID64 must be 17 digits' };
  }

  if (!steamId && !steamProfileUrl) {
    return { error: 'SteamID64 or Steam profile URL is required' };
  }

  return {
    steamId,
    steamPersonaName: personaName,
    steamProfileUrl,
    steamConnectedAt: new Date().toISOString()
  };
}

function requestOrigin(req) {
  const configuredOrigin = String(process.env.FACEIT_PUBLIC_API_ORIGIN || '').trim().replace(/\/+$/, '');
  if (configuredOrigin) return configuredOrigin;

  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const host = req.headers.host || `${DEFAULT_HOST}:${DEFAULT_PORT}`;
  return `http://${host}`;
}

function cleanupSteamAuthSessions() {
  const now = Date.now();
  for (const [sessionId, session] of steamAuthSessions.entries()) {
    if (session.expiresAt < now) {
      steamAuthSessions.delete(sessionId);
    }
  }
}

function createSteamAuthUrl(req, sessionId) {
  const origin = requestOrigin(req);
  const returnTo = `${origin}/api/auth/steam/callback?session=${encodeURIComponent(sessionId)}`;
  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': `${origin}/`,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select'
  });

  return `${STEAM_OPENID_URL}?${params.toString()}`;
}

async function verifySteamOpenId(url) {
  if (url.searchParams.get('openid.mode') !== 'id_res') {
    throw new Error('Steam did not return a successful login response');
  }

  const params = new URLSearchParams();
  for (const [key, value] of url.searchParams.entries()) {
    if (key.startsWith('openid.')) {
      params.set(key, value);
    }
  }
  params.set('openid.mode', 'check_authentication');

  const response = await fetch(STEAM_OPENID_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  const text = await response.text();
  if (!response.ok || !text.includes('is_valid:true')) {
    throw new Error('Steam login could not be verified');
  }

  const claimedId = url.searchParams.get('openid.claimed_id') || '';
  const match = claimedId.match(/\/(?:id|profiles)\/(\d{17})$/);
  if (!match) {
    throw new Error('SteamID64 was not returned by Steam');
  }

  return match[1];
}

async function fetchSteamSummary(steamId) {
  const steamApiKey = loadDesktopConfig().steamApiKey || process.env.STEAM_API_KEY || '';
  if (!steamApiKey) return null;

  try {
    const params = new URLSearchParams({
      key: steamApiKey,
      steamids: steamId
    });
    const response = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?${params.toString()}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.response?.players?.[0] || null;
  } catch {
    return null;
  }
}

async function createOrLoginSteamUser(steamId) {
  const summary = await fetchSteamSummary(steamId);
  const personaName = normalizeUsername(summary?.personaname || `Steam${steamId.slice(-6)}`);
  const profileUrl = summary?.profileurl || `https://steamcommunity.com/profiles/${steamId}`;
  const avatarUrl = summary?.avatarfull || summary?.avatarmedium || summary?.avatar || '';
  let loginUser;

  const data = updateData((current) => {
    const profileEntry = Object.entries(current.profiles || {})
      .find(([, profile]) => profile?.steamId === steamId);
    loginUser = profileEntry
      ? current.users.find((user) => user.id === profileEntry[0])
      : null;

    if (!loginUser) {
      loginUser = {
        id: crypto.randomUUID(),
        email: `steam-${steamId}@steam.local`,
        username: personaName,
        role: 'player',
        status: 'active',
        authProvider: 'steam',
        passwordHash: hashPassword(crypto.randomBytes(24).toString('hex')),
        createdAt: new Date().toISOString(),
        lastLoginAt: null
      };
      current.users.push(loginUser);
    }

    if (loginUser.status !== 'active') {
      throw new Error('User is not active');
    }

    loginUser.username = personaName || loginUser.username;
    loginUser.authProvider = loginUser.authProvider || 'steam';
    loginUser.lastLoginAt = new Date().toISOString();
    ensureProfile(current, loginUser);
    current.profiles[loginUser.id] = {
      ...current.profiles[loginUser.id],
      displayName: personaName || current.profiles[loginUser.id].displayName,
      avatarUrl: avatarUrl || current.profiles[loginUser.id].avatarUrl,
      steamId,
      steamPersonaName: personaName,
      steamProfileUrl: profileUrl,
      steamConnectedAt: new Date().toISOString()
    };
    current.loginLogs.push({
      id: crypto.randomUUID(),
      userId: loginUser.id,
      email: loginUser.email,
      at: loginUser.lastLoginAt,
      provider: 'steam'
    });
    current.loginLogs = current.loginLogs.slice(-500);
    return current;
  });

  return {
    token: createToken(loginUser, data.settings.tokenSecret),
    user: withProfile(data, loginUser)
  };
}

function validateRegistration(body) {
  const email = normalizeEmail(body.email);
  const username = normalizeUsername(body.username);
  const password = String(body.password || '');

  if (!EMAIL_RE.test(email)) return { error: 'Valid email is required' };
  if (username.length < 3) return { error: 'Username must be at least 3 characters' };
  if (password.length < 8) return { error: 'Password must be at least 8 characters' };

  return { email, username, password };
}

function readBearerToken(req) {
  const header = String(req.headers.authorization || '');
  if (!header.toLowerCase().startsWith('bearer ')) return '';
  return header.slice(7).trim();
}

function getAuthContext(req) {
  const data = readData();
  const payload = verifyToken(readBearerToken(req), data.settings.tokenSecret);
  if (!payload) return { data, error: 'Authentication required' };

  const user = data.users.find((entry) => entry.id === payload.sub);
  if (!user) return { data, error: 'User not found' };
  if (user.status !== 'active') return { data, error: 'User is not active', status: 403 };

  ensureProfile(data, user);
  return { data, user };
}

function requireUser(req, res) {
  const context = getAuthContext(req);
  if (context.error) {
    sendError(req, res, context.status || 401, context.error);
    return null;
  }
  return context;
}

function requireAdmin(req, res) {
  const context = requireUser(req, res);
  if (!context) return null;
  if (context.user.role !== 'admin') {
    sendError(req, res, 403, 'Admin role required');
    return null;
  }
  return context;
}

function withProfile(data, user) {
  ensureProfile(data, user);
  return {
    ...publicUser(user),
    profile: data.profiles[user.id],
    stats: data.stats[user.id]
  };
}

async function handleSteamDirectLogin(req, res) {
  const body = await readJsonBody(req);
  const steam = normalizeSteamConnection(body);
  if (steam.error) {
    sendError(req, res, 400, steam.error);
    return;
  }
  if (!steam.steamId) {
    sendError(req, res, 400, 'SteamID64 is required for direct Steam login');
    return;
  }

  const result = await createOrLoginSteamUser(steam.steamId);
  const data = updateData((current) => {
    const user = current.users.find((entry) => entry.id === result.user.id);
    ensureProfile(current, user);
    current.profiles[user.id] = {
      ...current.profiles[user.id],
      steamPersonaName: steam.steamPersonaName || current.profiles[user.id].steamPersonaName,
      steamProfileUrl: steam.steamProfileUrl || current.profiles[user.id].steamProfileUrl
    };
    return current;
  });
  const user = data.users.find((entry) => entry.id === result.user.id);
  sendJson(req, res, 200, {
    token: createToken(user, data.settings.tokenSecret),
    user: withProfile(data, user)
  });
}

function kdRatio(stats = {}) {
  const deaths = Number(stats.deaths || 0);
  const kills = Number(stats.kills || 0);
  return deaths > 0 ? Number((kills / deaths).toFixed(2)) : kills;
}

function levelFromElo(elo) {
  const value = Number(elo || 1000);
  return Math.max(1, Math.min(10, Math.floor((value - 800) / 150) + 1));
}

function mapUser(data, userId) {
  const user = data.users.find((entry) => entry.id === userId);
  return user ? withProfile(data, user) : null;
}

function publicMatch(data, match) {
  const server = data.servers.find((entry) => entry.id === match.serverId);
  return {
    ...match,
    server: server ? publicServer(server) : null,
    players: (match.players || []).map((player) => ({
      ...player,
      user: mapUser(data, player.userId)
    }))
  };
}

function leaderboard(data) {
  return data.users
    .filter((user) => user.role === 'player' && user.status === 'active')
    .map((user) => {
      ensureProfile(data, user);
      const stats = data.stats[user.id] || createStats();
      return {
        user: withProfile(data, user),
        elo: Number(stats.elo || 1000),
        level: Number(stats.level || levelFromElo(stats.elo)),
        wins: Number(stats.wins || 0),
        losses: Number(stats.losses || 0),
        matches: Number(stats.matches || 0),
        kd: kdRatio(stats)
      };
    })
    .sort((a, b) => b.elo - a.elo || b.wins - a.wins || b.kd - a.kd)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function queueStatus(data, userId) {
  const activeMatches = data.matches
    .filter((match) => ['awaiting_accept', 'ready', 'live'].includes(match.status))
    .filter((match) => (match.players || []).some((player) => player.userId === userId))
    .map((match) => publicMatch(data, match));

  return {
    queued: data.queue.entries.some((entry) => entry.userId === userId),
    queueSize: data.queue.entries.length,
    queuedAt: data.queue.entries.find((entry) => entry.userId === userId)?.queuedAt || null,
    activeMatch: activeMatches[0] || null
  };
}

function firstAvailableServer(data) {
  return data.servers.find((server) => serializeServer(server).status === 'online') || data.servers[0] || null;
}

function makeMatch(data, queuedEntries) {
  const server = firstAvailableServer(data);
  const map = server?.config?.map || 'de_dust2';
  const players = queuedEntries.slice(0, MATCH_SIZE).map((entry, index) => ({
    userId: entry.userId,
    team: index % 2 === 0 ? 'A' : 'B',
    accepted: false,
    stats: {
      kills: 0,
      deaths: 0,
      assists: 0,
      headshots: 0
    }
  }));

  return {
    id: crypto.randomUUID(),
    map,
    serverId: server?.id || null,
    status: 'awaiting_accept',
    winnerTeam: null,
    createdAt: new Date().toISOString(),
    acceptedAt: null,
    completedAt: null,
    acceptExpiresAt: new Date(Date.now() + MATCH_ACCEPT_TTL_MS).toISOString(),
    players
  };
}

function createMatchIfReady(current) {
  const activeUserIds = new Set(
    current.matches
      .filter((match) => ['awaiting_accept', 'ready', 'live'].includes(match.status))
      .flatMap((match) => (match.players || []).map((player) => player.userId))
  );
  current.queue.entries = current.queue.entries.filter((entry) => !activeUserIds.has(entry.userId));

  if (current.queue.entries.length < MATCH_SIZE) return null;

  const selectedEntries = current.queue.entries.slice(0, MATCH_SIZE);
  const match = makeMatch(current, selectedEntries);
  current.matches.unshift(match);
  current.queue.entries = current.queue.entries.filter(
    (entry) => !selectedEntries.some((selected) => selected.userId === entry.userId)
  );
  current.queue.activeMatchId = match.id;
  return match;
}

function resolveExpiredAccepts(current) {
  const now = Date.now();
  for (const match of current.matches) {
    if (match.status !== 'awaiting_accept') continue;
    if (!match.acceptExpiresAt || Date.parse(match.acceptExpiresAt) > now) continue;

    match.status = 'cancelled';
    match.cancelledAt = new Date().toISOString();
    match.cancelReason = 'Accept expired';
  }
}

function addAuditLog(current, actor, action, details = {}) {
  current.auditLogs.push({
    id: crypto.randomUUID(),
    actorId: actor?.id || null,
    action,
    details,
    at: new Date().toISOString()
  });
  current.auditLogs = current.auditLogs.slice(-500);
}

function applyMatchResult(current, match, body, actor) {
  const winnerTeam = String(body.winnerTeam || match.winnerTeam || '').toUpperCase();
  if (!['A', 'B'].includes(winnerTeam)) {
    throw new Error('Winner team must be A or B');
  }

  const statsByUser = body.playerStats && typeof body.playerStats === 'object' ? body.playerStats : {};
  for (const player of match.players || []) {
    const patch = statsByUser[player.userId] || {};
    player.stats = {
      kills: Math.max(0, Number(patch.kills ?? player.stats?.kills ?? 0)),
      deaths: Math.max(0, Number(patch.deaths ?? player.stats?.deaths ?? 0)),
      assists: Math.max(0, Number(patch.assists ?? player.stats?.assists ?? 0)),
      headshots: Math.max(0, Number(patch.headshots ?? player.stats?.headshots ?? 0))
    };
  }

  const wasCompleted = match.status === 'completed';
  match.status = 'completed';
  match.winnerTeam = winnerTeam;
  match.completedAt = new Date().toISOString();
  match.approvedBy = actor?.id || null;

  if (!wasCompleted) {
    for (const player of match.players || []) {
      const stats = current.stats[player.userId] || createStats();
      const won = player.team === winnerTeam;
      stats.matches = Number(stats.matches || 0) + 1;
      stats.wins = Number(stats.wins || 0) + (won ? 1 : 0);
      stats.losses = Number(stats.losses || 0) + (won ? 0 : 1);
      stats.kills = Number(stats.kills || 0) + Number(player.stats?.kills || 0);
      stats.deaths = Number(stats.deaths || 0) + Number(player.stats?.deaths || 0);
      stats.assists = Number(stats.assists || 0) + Number(player.stats?.assists || 0);
      stats.headshots = Number(stats.headshots || 0) + Number(player.stats?.headshots || 0);
      stats.elo = Math.max(100, Number(stats.elo || 1000) + (won ? 25 : -25));
      stats.level = levelFromElo(stats.elo);
      current.stats[player.userId] = stats;
    }
  }

  addAuditLog(current, actor, 'match.result', { matchId: match.id, winnerTeam });
}

function sanitizeServerConfig(currentConfig, patch = {}) {
  const nextConfig = {
    ...DEFAULT_CONFIG.serverConfig,
    ...(currentConfig || {}),
    ...(patch || {})
  };

  const port = Number(nextConfig.port);
  const maxPlayers = Number(nextConfig.maxPlayers);
  const map = String(nextConfig.map || 'de_dust2').trim();

  if (!MAP_RE.test(map)) throw new Error('Map can only contain letters, numbers, and underscores');
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Port must be between 1024 and 65535');
  if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 32) throw new Error('Max players must be between 2 and 32');

  return {
    ...nextConfig,
    map,
    port,
    maxPlayers,
    hostname: String(nextConfig.hostname || 'Faceit MVP Server').trim().slice(0, 80),
    rconPassword: String(nextConfig.rconPassword || 'changeme').trim().slice(0, 64),
    customCommands: String(nextConfig.customCommands || '').slice(0, 4000),
    gameMode: ['casual', 'competitive', 'deathmatch', 'retake'].includes(nextConfig.gameMode)
      ? nextConfig.gameMode
      : 'competitive',
    botsEnabled: Boolean(nextConfig.botsEnabled),
    freezeTime: Boolean(nextConfig.freezeTime),
    skipWarmup: nextConfig.skipWarmup !== false,
    friendlyFire: Boolean(nextConfig.friendlyFire)
  };
}

function serializeServer(server) {
  const liveStatus = server.id === 'local-csgo' ? getServerStatus() : { running: server.status === 'online' };
  return {
    ...server,
    ip: server.id === 'local-csgo' ? getLocalIP() : server.ip,
    status: liveStatus.running ? 'online' : 'offline',
    process: liveStatus
  };
}

function publicServer(server) {
  const serialized = serializeServer(server);
  return {
    id: serialized.id,
    name: serialized.name,
    region: serialized.region,
    ip: serialized.ip,
    port: serialized.port,
    status: serialized.status,
    map: serialized.config?.map || 'de_dust2',
    gameMode: serialized.config?.gameMode || 'competitive',
    maxPlayers: serialized.config?.maxPlayers || 16,
    hostname: serialized.config?.hostname || serialized.name
  };
}

async function handleAuthRegister(req, res) {
  const body = await readJsonBody(req);
  const validation = validateRegistration(body);
  if (validation.error) {
    sendError(req, res, 400, validation.error);
    return;
  }

  let createdUser;
  const data = updateData((current) => {
    if (current.users.some((user) => user.email === validation.email)) {
      throw new Error('Email is already registered');
    }

    createdUser = {
      id: crypto.randomUUID(),
      email: validation.email,
      username: validation.username,
      role: 'player',
      status: 'active',
      passwordHash: hashPassword(validation.password),
      createdAt: new Date().toISOString(),
      lastLoginAt: null
    };
    current.users.push(createdUser);
    ensureProfile(current, createdUser);
    return current;
  });

  const token = createToken(createdUser, data.settings.tokenSecret);
  sendJson(req, res, 201, { token, user: withProfile(data, createdUser) });
}

async function handleAuthLogin(req, res) {
  const body = await readJsonBody(req);
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');

  if (!EMAIL_RE.test(email) || !password) {
    sendError(req, res, 400, 'Email and password are required');
    return;
  }

  let loginUser;
  const data = updateData((current) => {
    const user = current.users.find((entry) => entry.email === email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new Error('Invalid email or password');
    }
    if (user.status !== 'active') {
      throw new Error('User is not active');
    }

    user.lastLoginAt = new Date().toISOString();
    ensureProfile(current, user);
    current.loginLogs.push({
      id: crypto.randomUUID(),
      userId: user.id,
      email: user.email,
      at: user.lastLoginAt
    });
    current.loginLogs = current.loginLogs.slice(-500);
    loginUser = user;
    return current;
  });

  const token = createToken(loginUser, data.settings.tokenSecret);
  sendJson(req, res, 200, { token, user: withProfile(data, loginUser) });
}

function handleSteamSessionCreate(req, res) {
  cleanupSteamAuthSessions();
  const sessionId = crypto.randomUUID();
  const now = Date.now();
  steamAuthSessions.set(sessionId, {
    status: 'pending',
    createdAt: now,
    expiresAt: now + STEAM_AUTH_SESSION_TTL_MS
  });

  sendJson(req, res, 201, {
    sessionId,
    authUrl: createSteamAuthUrl(req, sessionId),
    expiresAt: new Date(now + STEAM_AUTH_SESSION_TTL_MS).toISOString()
  });
}

function handleSteamSessionStatus(req, res, sessionId) {
  cleanupSteamAuthSessions();
  const session = steamAuthSessions.get(sessionId);
  if (!session) {
    sendError(req, res, 404, 'Steam login session expired');
    return;
  }

  if (session.status === 'complete') {
    steamAuthSessions.delete(sessionId);
    sendJson(req, res, 200, {
      status: 'complete',
      token: session.token,
      user: session.user
    });
    return;
  }

  if (session.status === 'error') {
    steamAuthSessions.delete(sessionId);
    sendJson(req, res, 200, {
      status: 'error',
      error: session.error || 'Steam login failed'
    });
    return;
  }

  sendJson(req, res, 202, { status: 'pending' });
}

async function handleSteamCallback(req, res, url) {
  cleanupSteamAuthSessions();
  const sessionId = url.searchParams.get('session') || '';
  const session = steamAuthSessions.get(sessionId);
  if (!session) {
    sendHtml(req, res, 400, '<!doctype html><title>Steam Login</title><h1>Steam login session expired</h1>');
    return;
  }

  try {
    const steamId = await verifySteamOpenId(url);
    const authResult = await createOrLoginSteamUser(steamId);
    steamAuthSessions.set(sessionId, {
      ...session,
      status: 'complete',
      token: authResult.token,
      user: authResult.user,
      expiresAt: Date.now() + 60 * 1000
    });
    sendHtml(req, res, 200, '<!doctype html><title>Steam Login</title><h1>Steam login complete</h1><p>You can return to CSGO Arena now.</p>');
  } catch (error) {
    steamAuthSessions.set(sessionId, {
      ...session,
      status: 'error',
      error: error.message || 'Steam login failed',
      expiresAt: Date.now() + 60 * 1000
    });
    sendHtml(req, res, 400, `<!doctype html><title>Steam Login</title><h1>Steam login failed</h1><p>${error.message || 'Steam login failed'}</p>`);
  }
}

function handleSteamStart(req, res, url) {
  cleanupSteamAuthSessions();
  const sessionId = url.searchParams.get('session') || crypto.randomUUID();
  const now = Date.now();
  if (!steamAuthSessions.has(sessionId)) {
    steamAuthSessions.set(sessionId, {
      status: 'pending',
      createdAt: now,
      expiresAt: now + STEAM_AUTH_SESSION_TTL_MS
    });
  }

  setCors(req, res);
  res.writeHead(302, { Location: createSteamAuthUrl(req, sessionId) });
  res.end();
}

async function handlePlayerProfilePatch(req, res, context) {
  const body = await readJsonBody(req);
  const data = updateData((current) => {
    const user = current.users.find((entry) => entry.id === context.user.id);
    ensureProfile(current, user);
    current.profiles[user.id] = {
      ...current.profiles[user.id],
      displayName: normalizeUsername(body.displayName || current.profiles[user.id].displayName),
      country: String(body.country || current.profiles[user.id].country || '').trim().slice(0, 2).toUpperCase(),
      avatarUrl: String(body.avatarUrl || current.profiles[user.id].avatarUrl || '').trim().slice(0, 300),
      bio: String(body.bio || current.profiles[user.id].bio || '').trim().slice(0, 160)
    };
    user.username = current.profiles[user.id].displayName || user.username;
    return current;
  });
  const user = data.users.find((entry) => entry.id === context.user.id);
  sendJson(req, res, 200, { user: withProfile(data, user) });
}

async function handlePlayerSteamPatch(req, res, context) {
  const body = await readJsonBody(req);
  const steam = normalizeSteamConnection(body);
  if (steam.error) {
    sendError(req, res, 400, steam.error);
    return;
  }

  const data = updateData((current) => {
    const user = current.users.find((entry) => entry.id === context.user.id);
    ensureProfile(current, user);
    current.profiles[user.id] = {
      ...current.profiles[user.id],
      ...steam
    };
    return current;
  });
  const user = data.users.find((entry) => entry.id === context.user.id);
  sendJson(req, res, 200, { user: withProfile(data, user) });
}

function handleQueueStatus(req, res, context) {
  const data = updateData((current) => {
    resolveExpiredAccepts(current);
    createMatchIfReady(current);
    return current;
  });
  sendJson(req, res, 200, { queue: queueStatus(data, context.user.id) });
}

async function handleQueueJoin(req, res, context) {
  const body = await readJsonBody(req);
  const data = updateData((current) => {
    resolveExpiredAccepts(current);
    const active = queueStatus(current, context.user.id).activeMatch;
    if (active) return current;

    if (!current.queue.entries.some((entry) => entry.userId === context.user.id)) {
      current.queue.entries.push({
        id: crypto.randomUUID(),
        userId: context.user.id,
        mapPreference: String(body.mapPreference || 'any').slice(0, 32),
        queuedAt: new Date().toISOString()
      });
    }
    createMatchIfReady(current);
    return current;
  });
  sendJson(req, res, 200, { queue: queueStatus(data, context.user.id) });
}

function handleQueueLeave(req, res, context) {
  const data = updateData((current) => {
    current.queue.entries = current.queue.entries.filter((entry) => entry.userId !== context.user.id);
    return current;
  });
  sendJson(req, res, 200, { queue: queueStatus(data, context.user.id) });
}

function handlePlayerMatches(req, res, context) {
  const data = updateData((current) => {
    resolveExpiredAccepts(current);
    return current;
  });
  const matches = data.matches
    .filter((match) => (match.players || []).some((player) => player.userId === context.user.id))
    .map((match) => publicMatch(data, match));
  sendJson(req, res, 200, { matches });
}

async function handleMatchAccept(req, res, context, matchId) {
  const data = updateData((current) => {
    resolveExpiredAccepts(current);
    const match = current.matches.find((entry) => entry.id === matchId);
    if (!match) throw new Error('Match not found');
    if (match.status !== 'awaiting_accept') throw new Error('Match is not waiting for accept');

    const player = (match.players || []).find((entry) => entry.userId === context.user.id);
    if (!player) throw new Error('You are not in this match');

    player.accepted = true;
    player.acceptedAt = new Date().toISOString();
    if (match.players.every((entry) => entry.accepted)) {
      match.status = 'ready';
      match.acceptedAt = new Date().toISOString();
    }
    return current;
  });
  const match = data.matches.find((entry) => entry.id === matchId);
  sendJson(req, res, 200, { match: publicMatch(data, match), queue: queueStatus(data, context.user.id) });
}

function handleLeaderboard(req, res) {
  const data = readData();
  sendJson(req, res, 200, { leaderboard: leaderboard(data) });
}

function adminSummary(data) {
  const users = data.users;
  return {
    users: users.length,
    activeUsers: users.filter((user) => user.status === 'active').length,
    bannedUsers: users.filter((user) => user.status === 'banned').length,
    matches: data.matches.length,
    activeMatches: data.matches.filter((match) => ['awaiting_accept', 'ready', 'live'].includes(match.status)).length,
    queueSize: data.queue.entries.length,
    serversOnline: data.servers.map(serializeServer).filter((server) => server.status === 'online').length
  };
}

async function handleAdminUserPatch(req, res, userId) {
  const body = await readJsonBody(req);
  const data = updateData((current) => {
    const user = current.users.find((entry) => entry.id === userId);
    if (!user) throw new Error('User not found');

    if (body.status) {
      if (!['active', 'banned'].includes(body.status)) throw new Error('Invalid user status');
      user.status = body.status;
    }

    if (body.role) {
      if (!['player', 'admin'].includes(body.role)) throw new Error('Invalid user role');
      user.role = body.role;
    }

    return current;
  });

  const user = data.users.find((entry) => entry.id === userId);
  sendJson(req, res, 200, { user: withProfile(data, user) });
}

async function handleAdminServerPatch(req, res, serverId) {
  const body = await readJsonBody(req);
  const data = updateData((current) => {
    const server = current.servers.find((entry) => entry.id === serverId);
    if (!server) throw new Error('Server not found');
    server.config = sanitizeServerConfig(server.config, body.config || body);
    server.port = server.config.port;
    server.lastCommandAt = new Date().toISOString();
    return current;
  });

  const server = data.servers.find((entry) => entry.id === serverId);
  sendJson(req, res, 200, { server: serializeServer(server) });
}

async function handleAdminServerStart(req, res, serverId) {
  const data = readData();
  const server = data.servers.find((entry) => entry.id === serverId);
  if (!server) {
    sendError(req, res, 404, 'Server not found');
    return;
  }

  if (getServerStatus().running) {
    sendJson(req, res, 200, { server: serializeServer({ ...server, status: 'online' }) });
    return;
  }

  const desktopConfig = loadDesktopConfig();
  if (!desktopConfig.csgoPath) {
    sendError(req, res, 400, 'CSGO path is not set in the desktop app settings');
    return;
  }

  const config = sanitizeServerConfig(server.config);
  pushLog(`[ADMIN] Starting ${server.name} on ${config.map}:${config.port}`);
  await startServer(desktopConfig.csgoPath, config, pushLog);

  const nextData = updateData((current) => {
    const entry = current.servers.find((item) => item.id === serverId);
    entry.status = 'online';
    entry.ip = getLocalIP();
    entry.port = config.port;
    entry.config = config;
    entry.lastCommandAt = new Date().toISOString();
    return current;
  });
  sendJson(req, res, 200, { server: serializeServer(nextData.servers.find((entry) => entry.id === serverId)) });
}

async function handleAdminServerStop(req, res, serverId) {
  const didStop = stopServer();
  pushLog(`[ADMIN] Stop requested for ${serverId}`);

  const data = updateData((current) => {
    const server = current.servers.find((entry) => entry.id === serverId);
    if (!server) throw new Error('Server not found');
    server.status = 'offline';
    server.lastCommandAt = new Date().toISOString();
    return current;
  });

  sendJson(req, res, 200, {
    stopped: didStop,
    server: serializeServer(data.servers.find((entry) => entry.id === serverId))
  });
}

function handleAdminMatches(req, res, context) {
  const data = updateData((current) => {
    resolveExpiredAccepts(current);
    return current;
  });
  sendJson(req, res, 200, {
    matches: data.matches.map((match) => publicMatch(data, match)),
    queue: data.queue
  });
}

async function handleAdminMatchPatch(req, res, context, matchId) {
  const body = await readJsonBody(req);
  const data = updateData((current) => {
    const match = current.matches.find((entry) => entry.id === matchId);
    if (!match) throw new Error('Match not found');

    if (body.status) {
      if (!['awaiting_accept', 'ready', 'live', 'completed', 'cancelled'].includes(body.status)) {
        throw new Error('Invalid match status');
      }
      match.status = body.status;
      if (body.status === 'live') match.startedAt = match.startedAt || new Date().toISOString();
      if (body.status === 'cancelled') match.cancelledAt = new Date().toISOString();
      addAuditLog(current, context.user, 'match.status', { matchId, status: body.status });
    }

    if (body.winnerTeam || body.playerStats) {
      applyMatchResult(current, match, body, context.user);
    }

    return current;
  });
  const match = data.matches.find((entry) => entry.id === matchId);
  sendJson(req, res, 200, { match: publicMatch(data, match) });
}

async function routeRequest(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  try {
    if (req.method === 'GET' && pathname === '/api/health') {
      sendJson(req, res, 200, { ok: true, service: 'faceit-mvp-api' });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/auth/register') {
      await handleAuthRegister(req, res);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/auth/login') {
      await handleAuthLogin(req, res);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/auth/steam/session') {
      handleSteamSessionCreate(req, res);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/auth/steam/direct') {
      await handleSteamDirectLogin(req, res);
      return;
    }

    const steamSessionMatch = pathname.match(/^\/api\/auth\/steam\/session\/([^/]+)$/);
    if (req.method === 'GET' && steamSessionMatch) {
      handleSteamSessionStatus(req, res, steamSessionMatch[1]);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/auth/steam/start') {
      handleSteamStart(req, res, url);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/auth/steam/callback') {
      await handleSteamCallback(req, res, url);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/me') {
      const context = requireUser(req, res);
      if (!context) return;
      sendJson(req, res, 200, { user: withProfile(context.data, context.user) });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/player/profile') {
      const context = requireUser(req, res);
      if (!context) return;
      sendJson(req, res, 200, { user: withProfile(context.data, context.user) });
      return;
    }

    if (req.method === 'PATCH' && pathname === '/api/player/profile') {
      const context = requireUser(req, res);
      if (!context) return;
      await handlePlayerProfilePatch(req, res, context);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/player/stats') {
      const context = requireUser(req, res);
      if (!context) return;
      sendJson(req, res, 200, { stats: context.data.stats[context.user.id] || createStats() });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/player/servers') {
      const context = requireUser(req, res);
      if (!context) return;
      sendJson(req, res, 200, { servers: context.data.servers.map(publicServer) });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/player/queue') {
      const context = requireUser(req, res);
      if (!context) return;
      handleQueueStatus(req, res, context);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/player/queue') {
      const context = requireUser(req, res);
      if (!context) return;
      await handleQueueJoin(req, res, context);
      return;
    }

    if (req.method === 'DELETE' && pathname === '/api/player/queue') {
      const context = requireUser(req, res);
      if (!context) return;
      handleQueueLeave(req, res, context);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/player/matches') {
      const context = requireUser(req, res);
      if (!context) return;
      handlePlayerMatches(req, res, context);
      return;
    }

    const playerMatchAccept = pathname.match(/^\/api\/player\/matches\/([^/]+)\/accept$/);
    if (req.method === 'POST' && playerMatchAccept) {
      const context = requireUser(req, res);
      if (!context) return;
      await handleMatchAccept(req, res, context, playerMatchAccept[1]);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/player/leaderboard') {
      const context = requireUser(req, res);
      if (!context) return;
      handleLeaderboard(req, res);
      return;
    }

    if ((req.method === 'POST' || req.method === 'PATCH') && pathname === '/api/player/steam') {
      const context = requireUser(req, res);
      if (!context) return;
      await handlePlayerSteamPatch(req, res, context);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/admin/summary') {
      const context = requireAdmin(req, res);
      if (!context) return;
      sendJson(req, res, 200, { summary: adminSummary(context.data) });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/admin/users') {
      const context = requireAdmin(req, res);
      if (!context) return;
      sendJson(req, res, 200, {
        users: context.data.users.map((user) => withProfile(context.data, user))
      });
      return;
    }

    const userMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
    if (userMatch && req.method === 'PATCH') {
      if (!requireAdmin(req, res)) return;
      await handleAdminUserPatch(req, res, userMatch[1]);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/admin/servers') {
      const context = requireAdmin(req, res);
      if (!context) return;
      sendJson(req, res, 200, {
        servers: context.data.servers.map(serializeServer)
      });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/admin/matches') {
      const context = requireAdmin(req, res);
      if (!context) return;
      handleAdminMatches(req, res, context);
      return;
    }

    const adminMatch = pathname.match(/^\/api\/admin\/matches\/([^/]+)$/);
    if (adminMatch && req.method === 'PATCH') {
      const context = requireAdmin(req, res);
      if (!context) return;
      await handleAdminMatchPatch(req, res, context, adminMatch[1]);
      return;
    }

    const serverMatch = pathname.match(/^\/api\/admin\/servers\/([^/]+)(?:\/([^/]+))?$/);
    if (serverMatch) {
      if (!requireAdmin(req, res)) return;
      const [, serverId, action] = serverMatch;

      if (!action && req.method === 'PATCH') {
        await handleAdminServerPatch(req, res, serverId);
        return;
      }

      if (action === 'start' && req.method === 'POST') {
        await handleAdminServerStart(req, res, serverId);
        return;
      }

      if (action === 'stop' && req.method === 'POST') {
        await handleAdminServerStop(req, res, serverId);
        return;
      }

      if (action === 'logs' && req.method === 'GET') {
        sendJson(req, res, 200, { logs: serverLogs.slice(-120) });
        return;
      }
    }

    sendError(req, res, 404, 'Route not found');
  } catch (error) {
    sendError(req, res, error.message === 'User is not active' ? 403 : 400, error.message || 'Request failed');
  }
}

function createApiServer({ host = DEFAULT_HOST, port = DEFAULT_PORT } = {}) {
  const server = http.createServer((req, res) => {
    routeRequest(req, res);
  });

  return {
    server,
    start() {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.off('error', reject);
          resolve({ host, port });
        });
      });
    },
    close() {
      return new Promise((resolve) => server.close(resolve));
    }
  };
}

if (require.main === module) {
  const api = createApiServer();
  api.start()
    .then(({ host, port }) => {
      console.log(`Faceit MVP API running at http://${host}:${port}`);
      console.log('Seed admin: admin@faceit.local / Admin@12345');
      console.log('Seed player: player@faceit.local / Player@12345');
    })
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}

module.exports = {
  createApiServer
};
