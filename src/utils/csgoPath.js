const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const CSGO_FOLDER_NAMES = [
  'Counter-Strike Global Offensive',
  'csgo legacy'
];

async function detectCSGOPath() {
  // Try registry first
  const regPaths = [
    'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Steam App 730',
    'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Steam App 730'
  ];

  for (const regPath of regPaths) {
    try {
      const result = await new Promise((resolve, reject) => {
        exec(`reg query "${regPath}" /v InstallLocation`, (error, stdout) => {
          if (error) reject(error);
          else resolve(stdout);
        });
      });
      const match = result.match(/REG_SZ\s+(.+)/);
      if (match) {
        const steamPath = match[1].trim();
        // Check common subfolders
        for (const folder of CSGO_FOLDER_NAMES) {
          const fullPath = path.join(steamPath, folder);
          if (fs.existsSync(fullPath)) {
            return fullPath;
          }
        }
        // If steamapps/common exists, check there
        const commonPath = path.join(steamPath, 'steamapps', 'common');
        if (fs.existsSync(commonPath)) {
          for (const folder of CSGO_FOLDER_NAMES) {
            const fullPath = path.join(commonPath, folder);
            if (fs.existsSync(fullPath)) {
              return fullPath;
            }
          }
        }
        return steamPath;
      }
    } catch {
      continue;
    }
  }

  // Fallback: check default Steam paths
  const defaultSteamPaths = [
    'C:\\Program Files (x86)\\Steam\\steamapps\\common',
    'C:\\Steam\\steamapps\\common',
    path.join(process.env.LOCALAPPDATA || '', '..', 'Steam', 'steamapps', 'common')
  ];

  for (const basePath of defaultSteamPaths) {
    if (fs.existsSync(basePath)) {
      for (const folder of CSGO_FOLDER_NAMES) {
        const fullPath = path.join(basePath, folder);
        if (fs.existsSync(fullPath)) {
          return fullPath;
        }
      }
    }
  }

  return null;
}

function validateCSGOPath(csgoPath) {
  if (!csgoPath || typeof csgoPath !== 'string') return { valid: false, error: 'Path is empty' };
  if (!fs.existsSync(csgoPath)) return { valid: false, error: 'Path does not exist' };
  
  const stats = fs.statSync(csgoPath);
  if (!stats.isDirectory()) return { valid: false, error: 'Path is not a directory' };
  
  // Check for essential CSGO files
  const essentialFiles = ['csgo.exe', 'bin', 'csgo'];
  const hasEssential = essentialFiles.some(f => fs.existsSync(path.join(csgoPath, f)));
  if (!hasEssential) {
    return { valid: false, error: 'Not a valid CSGO installation' };
  }
  
  return { valid: true, folderName: path.basename(csgoPath) };
}

async function saveCSGOPath(csgoPath) {
  const configPath = path.join(__dirname, '../../mods-cache/config.json');
  let config = {};
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    config = {};
  }
  config.csgoPath = csgoPath;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  return true;
}

async function loadCSGOPath() {
  const configPath = path.join(__dirname, '../../mods-cache/config.json');
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config.csgoPath || null;
  } catch {
    return null;
  }
}

module.exports = { detectCSGOPath, validateCSGOPath, saveCSGOPath, loadCSGOPath };
