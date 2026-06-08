const { exec, spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');
const dgram = require('dgram');

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

  // Create map-specific CFG - CSGO auto-executes [mapname].cfg on map load
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

  // Write autoexec.cfg for SRCDS
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
    '-console',
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

  fs.writeFileSync(path.join(csgoPath, 'steam_appid.txt'), '4465480');

  if (onOutput) onOutput(`Starting ${config.gameMode} server on ${config.map} | Bots: ${config.botsEnabled ? 'ON' : 'OFF'}\n`);
  serverProcess = spawn(csgoExe, args, {
    cwd: csgoPath,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, SteamAppId: '4465480', SteamGameId: '4465480' }
  });
  serverProcess.unref();

  const send = (cmd) => {
    try { if (serverProcess && serverProcess.stdin) serverProcess.stdin.write(cmd); } catch {}
  };

  const sendCommands = (commands) => {
    for (const command of commands) {
      send(`${command}\n`);
    }
  };

  const startupCommands = [
    ...noWarmupCommands,
    `mp_freezetime ${freezeTime}`,
    `mp_friendlyfire ${friendlyFire}`,
    'mp_autoteambalance 0',
    'mp_limitteams 0',
    'mp_autokick 0',
    ...botCfgCommands
  ];

  for (const delay of [1000, 3000, 6000]) {
    setTimeout(() => sendCommands(startupCommands), delay);
  }
  if (customCommands.length) {
    setTimeout(() => sendCommands(customCommands), 7000);
  }

  let playerJoined = false;

  serverProcess.stdout.on('data', (data) => {
    const output = data.toString();
    if (onOutput) onOutput(output);

    // Detect real player joining
    if (!playerJoined && (output.includes('entered the game') || output.includes('connected'))) {
      playerJoined = true;
      if (onOutput) onOutput('[SERVER] Player detected - running join sequence\n');

      setTimeout(() => {
        sendCommands(noWarmupCommands);
      }, 500);

      setTimeout(() => {
        send(`mp_friendlyfire ${friendlyFire}\n`);
      }, 1500);

      setTimeout(() => {
        send(`mp_freezetime ${freezeTime}\n`);
        send('mp_autoteambalance 0\n');
        send('mp_limitteams 0\n');
      }, 2500);

      setTimeout(() => {
        if (!config.botsEnabled) {
          send('bot_kick all\n');
          send('bot_stop 1\n');
          send('bot_quota 0\n');
        } else {
          send('bot_kick all\n');
          send('bot_quota 5\n');
          send('bot_difficulty 1\n');
          send('bot_join_after_player 1\n');
        }
        send('bot_quota_mode fill\n');
      }, 3500);
    }
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

// ── LAN broadcast / discovery ───────────────────────────────────────────────
const BROADCAST_PORT = 27016;
let broadcastInterval = null;
let broadcastSocket = null;
let listenSocket = null;

function startBroadcast(serverInfo) {
  if (broadcastSocket) stopBroadcast();
  broadcastSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  broadcastSocket.on('error', (err) => {
    console.error('[lanServer] broadcast error:', err.message);
  });
  broadcastSocket.bind(() => {
    broadcastSocket.setBroadcast(true);
    const message = JSON.stringify({
      type: 'CSGO_MOD_MANAGER_SERVER',
      ip: serverInfo.ip,
      port: serverInfo.port,
      hostname: serverInfo.hostname,
      map: serverInfo.map,
      gameMode: serverInfo.gameMode,
      players: serverInfo.players || 0
    });
    console.log('[lanServer] broadcasting on port', BROADCAST_PORT);
    broadcastInterval = setInterval(() => {
      try {
        broadcastSocket.send(message, 0, message.length, BROADCAST_PORT, '255.255.255.255');
      } catch (err) {
        console.error('[lanServer] send error:', err.message);
      }
    }, 3000);
  });
}

function stopBroadcast() {
  if (broadcastInterval) {
    clearInterval(broadcastInterval);
    broadcastInterval = null;
  }
  if (broadcastSocket) {
    try { broadcastSocket.close(); } catch {}
    broadcastSocket = null;
  }
}

function startListening(onServerFound) {
  stopListening();
  listenSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  listenSocket.on('error', (err) => {
    console.error('[lanServer] listen error:', err.message);
  });
  listenSocket.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === 'CSGO_MOD_MANAGER_SERVER') {
        console.log('[lanServer] server found:', data.hostname);
        onServerFound(data);
      }
    } catch {}
  });
  listenSocket.bind(BROADCAST_PORT, () => {
    console.log('[lanServer] listening on port', BROADCAST_PORT);
  });
}

function stopListening() {
  if (listenSocket) {
    try { listenSocket.close(); } catch {}
    listenSocket = null;
  }
}

module.exports = { getLocalIP, openFirewallPort, installDedicatedServer, findDedicatedServer, startServer, stopServer, getServerStatus, launchCSGO, startBroadcast, stopBroadcast, startListening, stopListening };
