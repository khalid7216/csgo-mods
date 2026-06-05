const API_BASE = import.meta.env.VITE_FACEIT_API_URL || 'http://127.0.0.1:4180/api';
const TOKEN_KEY = 'faceit-mvp:admin-token';

export function getToken() {
  return window.localStorage.getItem(TOKEN_KEY) || '';
}

export function logout() {
  window.localStorage.removeItem(TOKEN_KEY);
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

export async function login(email, password) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: { email, password }
  });

  if (data.user.role !== 'admin') {
    throw new Error('Admin role required');
  }

  window.localStorage.setItem(TOKEN_KEY, data.token);
  return data.user;
}

export async function me() {
  const data = await request('/me');
  if (data.user.role !== 'admin') {
    throw new Error('Admin role required');
  }
  return data.user;
}

export const adminApi = {
  logs: (serverId) => request(`/admin/servers/${serverId}/logs`),
  saveServer: (serverId, config) => request(`/admin/servers/${serverId}`, {
    method: 'PATCH',
    body: { config }
  }),
  servers: () => request('/admin/servers'),
  startServer: (serverId) => request(`/admin/servers/${serverId}/start`, { method: 'POST' }),
  stopServer: (serverId) => request(`/admin/servers/${serverId}/stop`, { method: 'POST' }),
  summary: () => request('/admin/summary'),
  updateUser: (userId, patch) => request(`/admin/users/${userId}`, {
    method: 'PATCH',
    body: patch
  }),
  users: () => request('/admin/users')
};
