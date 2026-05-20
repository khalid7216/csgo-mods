const path = require('path');
const fs = require('fs');

const ALLOWED_DOMAINS = [
  'gamebanana.com',
  'api.gamebanana.com',
  'dl.gamebanana.com',
  'gamebanana.com'
];

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

function validatePath(filePath, allowedBase) {
  if (!filePath || typeof filePath !== 'string') {
    return { valid: false, error: 'Invalid path' };
  }

  const normalized = path.normalize(filePath);
  const resolved = path.resolve(normalized);
  const baseResolved = path.resolve(allowedBase);

  if (!resolved.startsWith(baseResolved)) {
    return { valid: false, error: 'Path traversal detected' };
  }

  return { valid: true, path: resolved };
}

function validateUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'Invalid URL' };
  }

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { valid: false, error: 'Invalid protocol' };
    }

    const isAllowed = ALLOWED_DOMAINS.some(domain =>
      hostname === domain || hostname.endsWith('.' + domain)
    );

    if (!isAllowed) {
      return { valid: false, error: 'Domain not allowed' };
    }

    return { valid: true, url };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

function validateSteamId(steamId) {
  if (!steamId || typeof steamId !== 'string') {
    return { valid: false, error: 'Invalid Steam ID' };
  }

  const steamIdNum = parseInt(steamId, 10);
  if (isNaN(steamIdNum) || steamIdNum < 1 || steamIdNum > 99999999999999999) {
    return { valid: false, error: 'Invalid Steam ID format' };
  }

  return { valid: true, steamId: steamIdNum.toString() };
}

function validateApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    return { valid: false, error: 'Invalid API key' };
  }

  if (apiKey.length < 10 || apiKey.length > 100) {
    return { valid: false, error: 'Invalid API key length' };
  }

  if (!/^[a-zA-Z0-9]+$/.test(apiKey)) {
    return { valid: false, error: 'Invalid API key format' };
  }

  return { valid: true, apiKey };
}

function validatePort(port) {
  const portNum = parseInt(port, 10);
  if (isNaN(portNum) || portNum < 1024 || portNum > 65535) {
    return { valid: false, error: 'Invalid port number' };
  }
  return { valid: true, port: portNum };
}

function validatePageSize(page) {
  const pageNum = parseInt(page, 10);
  if (isNaN(pageNum) || pageNum < 1 || pageNum > 100) {
    return { valid: false, error: 'Invalid page number' };
  }
  return { valid: true, page: pageNum };
}

function validateQuery(query) {
  if (typeof query !== 'string') {
    return { valid: false, error: 'Invalid query' };
  }
  if (query.length > 200) {
    return { valid: false, error: 'Query too long' };
  }
  return { valid: true, query };
}

function sanitizeFileName(fileName) {
  if (!fileName || typeof fileName !== 'string') {
    return 'unknown';
  }
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 255);
}

function validateModType(modType) {
  const allowedTypes = ['maps', 'skins'];
  if (!allowedTypes.includes(modType)) {
    return { valid: false, error: 'Invalid mod type' };
  }
  return { valid: true, modType };
}

function validateFileSize(size) {
  if (size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File too large' };
  }
  return { valid: true };
}

function isSafePath(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  return !filePath.includes('..') && !filePath.includes('\0') && !filePath.includes('\n');
}

module.exports = {
  validatePath,
  validateUrl,
  validateSteamId,
  validateApiKey,
  validatePort,
  validatePageSize,
  validateQuery,
  sanitizeFileName,
  validateModType,
  validateFileSize,
  isSafePath,
  ALLOWED_DOMAINS,
  MAX_FILE_SIZE
};
