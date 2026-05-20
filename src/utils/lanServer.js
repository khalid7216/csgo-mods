const { exec, spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

function openFirewallPort(port = 27015) {
  return new Promise((resolve) => {
    exec(
      `netsh advfirewall firewall add rule name="CSGO Server ${port}" dir=in action=allow protocol=TCP localport=${port}`,
      (error) => {
        if (error) {
          resolve({ success: false, error: error.message });
        } else {
          resolve({ success: true });
        }
      }
    );
  });
}

async function installSRCDS(steamPath) {
  return new Promise((resolve) => {
    const steamcmdPath = path.join(steamPath, '..', 'steamcmd');
    if (!fs.existsSync(steamcmdPath)) {
      fs.mkdirSync(steamcmdPath, { recursive: true });
    }

    const installScript = `force_install_dir ${path.join(steamcmdPath, 'csgo_ds')}
login anonymous
app_update 740 validate
quit`;

    const scriptPath = path.join(steamcmdPath, 'install_csgo_ds.txt');
    fs.writeFileSync(scriptPath, installScript);

    const steamcmdExe = path.join(steamcmdPath, 'steamcmd.exe');
    if (!fs.existsSync(steamcmdExe)) {
      resolve({ success: false, error: 'SteamCMD not found. Download from https://developer.valvesoftware.com/wiki/SteamCMD' });
      return;
    }

    exec(`"${steamcmdExe}" +runscript "${scriptPath}"`, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: stderr || error.message });
      } else {
        resolve({ success: true, installDir: path.join(steamcmdPath, 'csgo_ds') });
      }
    });
  });
}

function createServerCFG(csgoPath, config) {
  const cfgDir = path.join(csgoPath, 'csgo', 'cfg');
  if (!fs.existsSync(cfgDir)) fs.mkdirSync(cfgDir, { recursive: true });

  const cfgContent = `hostname "${config.hostname || 'CSGO Mod Manager Server'}"
sv_lan 1
sv_pure 0
sv_cheats 0
maxplayers ${config.maxPlayers || 16}
rcon_password "${config.rconPassword || 'changeme'}"
mp_autoteambalance 0
mp_limitteams 0
mp_roundtime 1.92
mp_roundtime_defuse 1.92
mp_freezetime 0
mp_buytime 9999
mp_buy_anywhere 1
sv_alltalk 1
mp_restartgame 1
`;

  fs.writeFileSync(path.join(cfgDir, 'server.cfg'), cfgContent);
  return true;
}

let serverProcess = null;

function isSteamRunning() {
  return new Promise((resolve) => {
    exec('tasklist /FI "IMAGENAME eq Steam.exe" /NH', (error, stdout) => {
      if (error) {
        resolve(false);
        return;
      }
      resolve(stdout.toLowerCase().includes('steam.exe'));
    });
  });
}

function findSteamDir(csgoPath) {
  let current = csgoPath;
  for (let i = 0; i < 10; i++) {
    const parent = path.dirname(current);
    if (parent === current) break;
    if (fs.existsSync(path.join(parent, 'Steam.exe'))) {
      return parent;
    }
    current = parent;
  }
  const fallback = 'C:\\Program Files (x86)\\Steam';
  if (fs.existsSync(path.join(fallback, 'Steam.exe'))) {
    return fallback;
  }
  return null;
}

async function startServer(csgoPath, config, onOutput) {
  const steamRunning = await isSteamRunning();
  if (!steamRunning) {
    throw new Error('Please open Steam first. SRCDS requires the Steam client to be running.');
  }

  const srcdsPath = path.join(csgoPath, 'srcds.exe');
  const altPath = path.join(csgoPath, 'bin', 'srcds.exe');

  const exePath = fs.existsSync(srcdsPath) ? srcdsPath : fs.existsSync(altPath) ? altPath : null;
  if (!exePath) {
    throw new Error('srcds.exe not found. Install Dedicated Server via SteamCMD.');
  }

  createServerCFG(csgoPath, config);
  await openFirewallPort(config.port || 27015);

  const steamDir = findSteamDir(csgoPath);
  const port = config.port || 27015;
  const maxPlayers = config.maxPlayers || 16;
  const map = config.map || 'de_dust2';

  const args = [
    '-game', 'csgo',
    '-console',
    '-usercon',
    '-insecure',
    '-nobreakpad',
    '+game_type', '0',
    '+game_mode', '1',
    '+mapgroup', 'mg_active',
    '+map', map,
    '-port', String(port),
    '+maxplayers', String(maxPlayers),
    '+sv_lan', '1',
    '+servercfgfile', 'server.cfg'
  ];

  if (steamDir) {
    args.push('-steam_dir', steamDir);
  }

  serverProcess = spawn(exePath, args, { cwd: path.dirname(exePath), stdio: ['pipe', 'pipe', 'pipe'] });

  serverProcess.stdout.on('data', (data) => {
    if (onOutput) onOutput(data);
  });

  serverProcess.stderr.on('data', (data) => {
    if (onOutput) onOutput(data);
  });

  serverProcess.on('close', (code) => {
    if (onOutput) onOutput(`Server stopped with code ${code}`);
    serverProcess = null;
  });

  return true;
}

function stopServer(process) {
  if (process) {
    process.kill('SIGTERM');
    setTimeout(() => {
      if (process && !process.killed) process.kill('SIGKILL');
    }, 5000);
    return true;
  }
  return false;
}

function getServerStatus(process) {
  if (!process) return { running: false };
  return {
    running: !process.killed,
    pid: process.pid
  };
}

async function launchCSGO(csgoPath, flags = []) {
  const csgoExe = path.join(csgoPath, 'csgo.exe');
  if (!fs.existsSync(csgoExe)) {
    throw new Error('csgo.exe not found');
  }

  const defaultFlags = ['-insecure', '-novid', '-console'];
  const allFlags = [...new Set([...defaultFlags, ...flags])];

  exec(`"${csgoExe}" ${allFlags.join(' ')}`, (error) => {
    if (error) console.error('Failed to launch CSGO:', error);
  });

  return { success: true };
}

module.exports = { getLocalIP, openFirewallPort, installSRCDS, createServerCFG, startServer, stopServer, getServerStatus, launchCSGO };
