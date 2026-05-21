const { exec, spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

const STEAM_DIR = 'C:\\Program Files (x86)\\Steam';
const STEAMCMD_DIR = path.join(STEAM_DIR, 'steamcmd');

const DS_SEARCH_PATHS = [
  'C:\\srcds',
  path.join(STEAMCMD_DIR, 'csgo_ds'),
  path.join(STEAM_DIR, 'steamapps', 'common', 'Counter-Strike Global Offensive Dedicated Server'),
  path.join(STEAM_DIR, '..', 'steamcmd', 'csgo_ds'),
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
  const steamRunning = await isSteamRunning();
  if (!steamRunning) {
    throw new Error('Steam is not running. SRCDS requires Steam to be open.');
  }

  const dsDir = findDedicatedServer();
  if (!dsDir) {
    throw new Error(
      'SRCDS not found. Checked: ' + DS_SEARCH_PATHS.join(', ') +
      '\n\nMake sure srcds.exe exists in one of these locations.\n' +
      'Or use "Install Dedicated Server" button in LAN Settings.'
    );
  }

  const clientCsgoDir = path.join(csgoPath, 'csgo');
  if (!fs.existsSync(clientCsgoDir)) {
    throw new Error('CSGO game directory not found at ' + clientCsgoDir);
  }

  const srcdsGameDir = path.join(dsDir, 'csgo');
  const checkFile = path.join(srcdsGameDir, 'maps', 'de_dust2.bsp');
  if (!fs.existsSync(checkFile)) {
    if (onOutput) onOutput('Copying game files to SRCDS... (one time only, may take a minute)\n');
    fs.mkdirSync(srcdsGameDir, { recursive: true });
    try {
      fs.cpSync(clientCsgoDir, srcdsGameDir, { recursive: true, force: false });
      if (onOutput) onOutput('Game files copied to SRCDS\n');
    } catch (err) {
      throw new Error('Failed to copy game files: ' + err.message);
    }
  }

  const cfgDir = path.join(srcdsGameDir, 'cfg');
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
  const maxPlayers = config.maxPlayers || 16;
  const map = config.map || 'de_dust2';

  const args = [
    '-game', 'csgo',
    '-console',
    '+sv_lan', '1',
    '+map', map,
    '-port', String(port),
    '+maxplayers', String(maxPlayers),
    '-insecure',
    '-nobreakpad'
  ];

  if (onOutput) onOutput('Starting SRCDS...\n');
  serverProcess = spawn(path.join(dsDir, 'srcds.exe'), args, { cwd: dsDir, stdio: ['pipe', 'pipe', 'pipe'] });

  serverProcess.stdout.on('data', (data) => {
    if (onOutput) onOutput(data);
  });

  serverProcess.stderr.on('data', (data) => {
    if (onOutput) onOutput(data);
  });

  serverProcess.on('error', (err) => {
    if (onOutput) onOutput(`Failed to start SRCDS: ${err.message}\n`);
    serverProcess = null;
  });

  serverProcess.on('close', (code) => {
    if (onOutput) onOutput(`Server stopped with code ${code}\n`);
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
