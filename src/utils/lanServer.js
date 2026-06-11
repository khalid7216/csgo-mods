const { exec, spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const STEAM_DIR = 'C:\\Program Files (x86)\\Steam';
const STEAMCMD_DIR = path.join(STEAM_DIR, 'steamcmd');

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

const NO_WARMUP_COMMANDS = [
  'mp_warmuptime 0',
  'mp_warmuptime_all_players_connected 0',
  'mp_warmup_pausetimer 0',
  'mp_do_warmup_period 0',
  'mp_warmup_end'
];

function cleanConsoleValue(value, fallback = '') {
  const cleaned = String(value || '')
    .replace(/[\r\n"]/g, '')
    .trim();
  return cleaned || fallback;
}

function normalizeCustomCommands(commands) {
  if (!commands || typeof commands !== 'string') return [];

  return commands
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('//') && !line.startsWith('#'))
    .slice(0, 30)
    .map((line) => line.slice(0, 180));
}

function asCfgLines(commands) {
  return commands.length ? `${commands.join('\n')}\n` : '';
}

const VIRTUAL_KEYWORDS = [
  'vmware', 'virtualbox', 'vbox', 'hyper-v', 'hyperv',
  'docker', 'wsl', 'vEthernet', 'bluetooth', 'loopback'
];

function getLocalLANIP() {
  const interfaces = os.networkInterfaces();
  let fallback = null;

  for (const name of Object.keys(interfaces)) {
    const lowerName = name.toLowerCase();
    const isVirtual = VIRTUAL_KEYWORDS.some((kw) => lowerName.includes(kw));
    if (isVirtual) continue;

    for (const iface of interfaces[name]) {
      if (iface.family !== 'IPv4' || iface.internal) continue;
      if (iface.address.startsWith('169.254.')) {
        if (!fallback) fallback = iface.address;
        continue;
      }
      return iface.address;
    }
  }

  if (fallback) return fallback;

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
  const serverDir = findDedicatedServer() || (fs.existsSync(path.join(csgoPath, 'srcds.exe')) ? csgoPath : null);
  if (!serverDir) {
    throw new Error('srcds.exe not found. Install the CSGO Dedicated Server first.');
  }

  const srcdsExe = path.join(serverDir, 'srcds.exe');
  if (!fs.existsSync(srcdsExe)) {
    throw new Error('srcds.exe not found at ' + srcdsExe);
  }

  const cfgDir = path.join(serverDir, 'csgo', 'cfg');
  if (!fs.existsSync(cfgDir)) fs.mkdirSync(cfgDir, { recursive: true });

  const map = config.map || 'de_dust2';
  const hostname = cleanConsoleValue(config.hostname, 'CSGO Mod Manager Server');
  const rconPassword = cleanConsoleValue(config.rconPassword, 'changeme');
  const freezeTime = config.freezeTime ? '30' : '0';
  const friendlyFire = config.friendlyFire ? '1' : '0';
  const noWarmupCommands = config.skipWarmup === false ? [] : NO_WARMUP_COMMANDS;
  const customCommands = normalizeCustomCommands(config.customCommands);
  const botCfgCommands = config.botsEnabled
    ? ['bot_quota 5', 'bot_difficulty 1', 'bot_join_after_player 1', 'bot_quota_mode fill', 'bot_allow_rogues 0']
    : ['bot_quota 0', 'bot_kick', 'bot_stop 1', 'bot_join_after_player 1', 'bot_quota_mode normal'];

  const cfgContent = `hostname "${hostname}"
rcon_password "${rconPassword}"
sv_lan 1
sv_steamauth 0
sv_forcepreload 1
sv_pausable 0
sv_allow_lobby_connect_only 0
sv_alltalk 1
sv_full_alltalk 1
sv_allow_voice_from_file 1
sv_steamgroup_exclusive 0
sv_pure 0
sv_visiblemaxplayers 16
sv_minrate 20000
sv_maxrate 80000
sv_minupdaterate 20
sv_maxupdaterate 64
sv_mincmdrate 20
sv_maxcmdrate 64
net_splitpacket_maxrate 15000
tv_enable 0
tv_advertise_watchable 0
spec_freeze_time 0
spec_freeze_panel_extended_time 0
mp_autoteambalance 0
mp_limitteams 0
mp_teamplay 0
mp_scoringstyle 0
mp_autokick 0
mp_teammates_are_enemies 0
mp_solid_teammates 1
mp_roundtime 1.92
mp_roundtime_defuse 1.92
mp_match_can_clinch 1
mp_maxrounds 30
mp_halftime 0
bot_quota ${config.botsEnabled ? 5 : 0}
bot_quota_mode fill
bot_autodifficulty_threshold_high 0
bot_autodifficulty_threshold_low 0
bot_allow_rogues 0
bot_chatter off
${asCfgLines(botCfgCommands)}${asCfgLines(noWarmupCommands)}mp_freezetime ${freezeTime}
mp_friendlyfire ${friendlyFire}
${asCfgLines(customCommands)}
exec ${map}.cfg
mp_restartgame 1
`;
  fs.writeFileSync(path.join(cfgDir, 'server.cfg'), cfgContent);

  const mapCfgContent = `${asCfgLines(noWarmupCommands)}mp_freezetime ${freezeTime}
mp_friendlyfire ${friendlyFire}
mp_autoteambalance 0
mp_limitteams 0
${asCfgLines(botCfgCommands)}${asCfgLines(customCommands)}
mp_restartgame 1
`;
  fs.writeFileSync(path.join(cfgDir, `${map}.cfg`), mapCfgContent);

  const autoexecCommands = `mp_freezetime ${freezeTime}
mp_friendlyfire ${friendlyFire}
${asCfgLines(noWarmupCommands)}
mp_autoteambalance 0
mp_limitteams 0
${asCfgLines(botCfgCommands)}${asCfgLines(customCommands)}
`;

  fs.writeFileSync(path.join(cfgDir, 'autoexec.cfg'), autoexecCommands);

  await openFirewallPort(config.port || 27015);

  const gameModeArgs = {
    casual:      ['+game_type', '0', '+game_mode', '0'],
    competitive: ['+game_type', '0', '+game_mode', '1'],
    deathmatch:  ['+game_type', '1', '+game_mode', '2'],
    retake:      ['+game_type', '0', '+game_mode', '1', '+mp_retake', '1'],
  };

  const botArgs = config.botsEnabled
    ? ['+bot_quota', '5', '+bot_difficulty', '1', '+bot_join_after_player', '1', '+bot_quota_mode', 'fill', '+bot_allow_rogues', '0']
    : ['+bot_quota', '0', '+bot_stop', '1', '+bot_join_after_player', '1', '+bot_quota_mode', 'normal'];

  const args = [
    '-game', 'csgo',
    '-usercon',
    '+sv_lan', '1',
    ...gameModeArgs[config.gameMode || 'casual'],
    '+map', config.map || 'de_dust2',
    '-port', String(config.port || 27015),
    '+maxplayers', String(config.maxPlayers || 16),
    '-insecure',
    '-nobreakpad',
    '+exec', 'server.cfg',
    '+mapconfig', map,
    '+exec', map,
    '+mp_freezetime', freezeTime,
    '+mp_friendlyfire', friendlyFire,
    '+mp_autoteambalance', '0',
    '+mp_limitteams', '0',
    '+mp_autokick', '0',
    '+tv_enable', '0',
    '+sv_steamauth', '0',
    '+sv_allow_lobby_connect_only', '0',
    '+sv_minrate', '20000',
    '+sv_maxrate', '80000',
    '+sv_minupdaterate', '20',
    '+sv_maxupdaterate', '64',
    '+bot_quota_mode', 'fill',
    ...botArgs,
  ];

  fs.writeFileSync(path.join(serverDir, 'steam_appid.txt'), '740');

  if (onOutput) onOutput(`Starting dedicated ${config.gameMode} server on ${config.map} | Bots: ${config.botsEnabled ? 'ON' : 'OFF'}\n`);
  serverProcess = spawn(srcdsExe, args, {
    cwd: serverDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, SteamAppId: '740', SteamGameId: '740' }
  });
  serverProcess.unref();

  serverProcess.stdout.on('data', (data) => {
    if (onOutput) onOutput(data.toString());
  });

  serverProcess.stderr.on('data', (data) => {
    if (onOutput) onOutput(data.toString());
  });

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
  const steamRunning = await isSteamRunning();
  if (!steamRunning) {
    throw new Error('Steam is not running. CSGO requires Steam to be open.');
  }

  const csgoExe = path.join(csgoPath, 'csgo.exe');
  if (!fs.existsSync(csgoExe)) {
    throw new Error('csgo.exe not found at ' + csgoExe);
  }

  fs.writeFileSync(path.join(csgoPath, 'steam_appid.txt'), '4465480');

  const cfgDir = path.join(csgoPath, 'csgo', 'cfg');
  if (!fs.existsSync(cfgDir)) fs.mkdirSync(cfgDir, { recursive: true });

  const autoexecContent = `mp_freezetime 0
mp_friendlyfire 0
mp_warmup_end
mp_autoteambalance 0
mp_limitteams 0
bot_kick

mat_global_shader_quality 0
mat_reducefillrate 1
r_dynamic 0
r_shadows 0
fps_max 128
cl_forcepreload 1
mat_queue_mode 2
r_shadowrendertotexture 0
shader_level 0
effect_detail 0
r_shadowlod 0
`;
  fs.writeFileSync(path.join(cfgDir, 'autoexec.cfg'), autoexecContent);

  const defaultFlags = [
    '-insecure',
    '-novid',
    '-console',
    '-w', '1280',
    '-h', '1024',
    '-freq', '60',
    '+exec', 'autoexec.cfg',
    '+mat_savechanges',
    '+r_dynamic', '0',
    '+r_shadowrendertotexture', '0',
    '+r_shadows', '0',
    '+mat_monitorgamma', '2.2',
    '+mat_queue_mode', '2'
  ];
  const allFlags = [...new Set([...defaultFlags, ...flags])];

  spawn(csgoExe, allFlags, {
    cwd: csgoPath,
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, SteamAppId: '4465480', SteamGameId: '4465480' }
  }).unref();

  return { success: true };
}

let scanInterval = null;
let scanAbort = false;

function startListening(onServerFound) {
  if (scanInterval) return;
  scanAbort = false;

  const scan = () => {
    if (scanAbort) return;
    const localIP = getLocalLANIP();
    const parts = localIP.split('.');
    if (parts.length !== 4) return;
    const subnet = parts.slice(0, 3).join('.') + '.';

    for (let i = 1; i <= 254; i++) {
      const ip = subnet + i;
      if (ip === localIP) continue;
      const ws = new WebSocket(`ws://${ip}:27016`);
      ws.on('message', (data) => {
        try {
          const server = JSON.parse(data.toString());
          if (server.type === 'CSGO_MOD_MANAGER_SERVER') {
            onServerFound(server);
          }
        } catch {}
        ws.close();
      });
      ws.on('error', () => {});
      setTimeout(() => {
        if (ws.readyState !== WebSocket.CLOSED) ws.close();
      }, 1000);
    }
  };

  scan();
  scanInterval = setInterval(scan, 5000);
}

function stopListening() {
  scanAbort = true;
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
}

module.exports = {
  getLocalLANIP,
  getLocalIP: getLocalLANIP,
  openFirewallPort,
  installDedicatedServer,
  findDedicatedServer,
  startServer,
  stopServer,
  getServerStatus,
  launchCSGO,
  startListening,
  stopListening
};
