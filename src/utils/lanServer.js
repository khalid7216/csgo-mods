const { exec, spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

const STEAM_DIR = 'C:\\Program Files (x86)\\Steam';
const STEAMCMD_DIR = path.join(STEAM_DIR, 'steamcmd');

// The dedicated server is in the project root (parent of csgo-mods)
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

const DS_SEARCH_PATHS = [
  PROJECT_ROOT,
  path.join(STEAM_DIR, 'steamapps', 'common', 'Counter-Strike Global Offensive Dedicated Server'),
  path.join(STEAM_DIR, 'steamapps', 'common', 'Counter-Strike Global Offensive'),
  path.join(STEAMCMD_DIR, 'csgo_ds'),
  path.join(STEAM_DIR, '..', 'steamcmd', 'csgo_ds'),
  'C:\\srcds',
  'C:\\steamcmd\\csgo_ds'
];

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

function findDedicatedServer() {
  for (const dir of DS_SEARCH_PATHS) {
    const srcdsExe = path.join(dir, 'srcds.exe');
    if (fs.existsSync(srcdsExe)) {
      return dir;
    }
  }
  return null;
}

function openFirewallPort(port = 27015) {
  return new Promise((resolve) => {
    exec(
      `netsh advfirewall firewall add rule name="CSGO Server ${port}" dir=in action=allow protocol=UDP localport=${port} >nul 2>&1`,
      (error) => {
        resolve({ success: !error, error: error ? error.message : null });
      }
    );
  });
}

async function installDedicatedServer(onOutput) {
  if (!fs.existsSync(STEAMCMD_DIR)) {
    fs.mkdirSync(STEAMCMD_DIR, { recursive: true });
  }

  const steamcmdExe = path.join(STEAMCMD_DIR, 'steamcmd.exe');
  if (!fs.existsSync(steamcmdExe)) {
    throw new Error('SteamCMD not found. Download from https://developer.valvesoftware.com/wiki/SteamCMD and save to ' + STEAMCMD_DIR);
  }

  const installDir = path.join(STEAMCMD_DIR, 'csgo_ds');
  const installScript = `force_install_dir ${installDir}
login anonymous
app_update 740 validate
quit`;

  const scriptPath = path.join(STEAMCMD_DIR, 'install_csgo_ds.txt');
  fs.writeFileSync(scriptPath, installScript);

  return new Promise((resolve, reject) => {
    if (onOutput) onOutput('Installing CSGO Dedicated Server (this may take a while)...\n');
    const proc = spawn(steamcmdExe, ['+runscript', scriptPath], { stdio: ['ignore', 'pipe', 'pipe'] });
    proc.stdout.on('data', (data) => {
      if (onOutput) onOutput(data);
    });
    proc.stderr.on('data', (data) => {
      if (onOutput) onOutput(data);
    });
    proc.on('close', (code) => {
      if (code === 0) {
        if (onOutput) onOutput('\nInstallation complete!\n');
        resolve({ success: true, installDir });
      } else {
        reject(new Error(`SteamCMD exited with code ${code}`));
      }
    });
    proc.on('error', (err) => reject(err));
  });
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

async function startServer(csgoPath, config, onOutput) {
  const csgoExe = path.join(csgoPath, 'csgo.exe');
  if (!fs.existsSync(csgoExe)) {
    throw new Error('csgo.exe not found at ' + csgoExe);
  }

  const cfgDir = path.join(csgoPath, 'csgo', 'cfg');
  if (!fs.existsSync(cfgDir)) fs.mkdirSync(cfgDir, { recursive: true });

  const cfgContent = `hostname "${config.hostname || 'CSGO Mod Manager Server'}"
sv_lan 1
sv_pure 0
sv_consistency 0
sv_cheats 0
sv_allowdownload 1
sv_allowupload 1
mp_autoteambalance 1
mp_limitteams 0
bot_quota 0
`;
  fs.writeFileSync(path.join(cfgDir, 'server.cfg'), cfgContent);

  await openFirewallPort(config.port || 27015);

  const port = config.port || 27015;
  const map = config.map || 'de_dust2';

  const args = [
    '-insecure',
    '-novid',
    '-console',
    '+sv_lan', '1',
    '+ip', '0.0.0.0',
    '+map', map,
    '-port', String(port)
  ];

  if (onOutput) onOutput('Launching CSGO LAN host...\n');
  serverProcess = spawn(csgoExe, args, {
    cwd: csgoPath,
    detached: true,
    stdio: 'ignore'
  });
  serverProcess.unref();

  serverProcess.on('close', (code) => {
    if (onOutput) onOutput(`CSGO closed with code ${code}\n`);
    serverProcess = null;
  });

  serverProcess.on('error', (err) => {
    if (onOutput) onOutput(`Failed to launch CSGO: ${err.message}\n`);
    serverProcess = null;
  });

  return true;
}

function stopServer() {
  if (serverProcess) {
    const pid = serverProcess.pid;
    try {
      exec(`taskkill /PID ${pid} /T /F`, () => {});
    } catch {}
    serverProcess = null;
    return true;
  }
  return false;
}

function getServerStatus() {
  if (!serverProcess) return { running: false };
  try {
    return {
      running: !serverProcess.killed,
      pid: serverProcess.pid
    };
  } catch {
    return { running: false };
  }
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

module.exports = { getLocalIP, openFirewallPort, installDedicatedServer, findDedicatedServer, startServer, stopServer, getServerStatus, launchCSGO };
