const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

async function detectCSGOPath() {
  return new Promise((resolve) => {
    exec(
      'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Steam App 730" /v InstallLocation',
      (error, stdout) => {
        if (error) {
          exec(
            'reg query "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Steam App 730" /v InstallLocation',
            (error2, stdout2) => {
              if (error2) {
                resolve(null);
              } else {
                const match = stdout2.match(/REG_SZ\s+(.+)/);
                resolve(match ? match[1].trim() : null);
              }
            }
          );
        } else {
          const match = stdout.match(/REG_SZ\s+(.+)/);
          resolve(match ? match[1].trim() : null);
        }
      }
    );
  });
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

module.exports = { detectCSGOPath, saveCSGOPath, loadCSGOPath };
