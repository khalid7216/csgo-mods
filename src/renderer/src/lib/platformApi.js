const API_BASE = import.meta.env.VITE_FACEIT_API_URL || 'http://127.0.0.1:4180/api';
const TOKEN_KEY = 'faceit-mvp:token';

function getToken() {
  return window.localStorage.getItem(TOKEN_KEY) || '';
}

function setToken(token) {
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.headers || {})
  };

  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed with ${response.status}`);
  }

  return data;
}

async function login(email, password) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: { email, password }
  });
  setToken(data.token);
  return data.user;
}

async function register(username, email, password) {
  const data = await request('/auth/register', {
    method: 'POST',
    body: { username, email, password }
  });
  setToken(data.token);
  return data.user;
}

async function startSteamAuth() {
  return request('/auth/steam/session', {
    method: 'POST',
    body: {}
  });
}

async function pollSteamAuth(sessionId) {
  const data = await request(`/auth/steam/session/${encodeURIComponent(sessionId)}`);
  if (data.status === 'complete' && data.token) {
    setToken(data.token);
  }
  return data;
}

async function directSteamLogin(steamInput) {
  const data = await request('/auth/steam/direct', {
    method: 'POST',
    body: { steamInput }
  });
  setToken(data.token);
  return data.user;
}

async function me() {
  const data = await request('/me');
  return data.user;
}

async function updateProfile(profile) {
  const data = await request('/player/profile', {
    method: 'PATCH',
    body: profile
  });
  return data.user;
}

async function stats() {
  const data = await request('/player/stats');
  return data.stats;
}

async function playerServers() {
  const data = await request('/player/servers');
  return data.servers || [];
}

async function queueStatus() {
  const data = await request('/player/queue');
  return data.queue;
}

async function joinQueue(mapPreference = 'any') {
  const data = await request('/player/queue', {
    method: 'POST',
    body: { mapPreference }
  });
  return data.queue;
}

async function leaveQueue() {
  const data = await request('/player/queue', {
    method: 'DELETE'
  });
  return data.queue;
}

async function acceptMatch(matchId) {
  const data = await request(`/player/matches/${encodeURIComponent(matchId)}/accept`, {
    method: 'POST',
    body: {}
  });
  return data;
}

async function matches() {
  const data = await request('/player/matches');
  return data.matches || [];
}

async function leaderboard() {
  const data = await request('/player/leaderboard');
  return data.leaderboard || [];
}

async function connectSteam(steam) {
  const data = await request('/player/steam', {
    method: 'POST',
    body: steam
  });
  return data.user;
}

export const platformApi = {
  acceptMatch,
  connectSteam,
  directSteamLogin,
  getToken,
  joinQueue,
  leaderboard,
  leaveQueue,
  login,
  logout: () => setToken(''),
  matches,
  me,
  playerServers,
  pollSteamAuth,
  queueStatus,
  register,
  startSteamAuth,
  stats,
  updateProfile
};
