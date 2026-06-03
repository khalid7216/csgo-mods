import React, { useState, useEffect } from 'react';

const DEFAULT_SERVER_CONFIG = {
  map: 'de_dust2',
  gameMode: 'casual',
  botsEnabled: false,
  freezeTime: false,
  skipWarmup: true,
  friendlyFire: true,
  maxPlayers: 16,
  hostname: 'CSGO Mod Manager Server',
  port: 27015,
  rconPassword: 'changeme'
};

export default function LANPage({ config, addToast }) {
  const [localIP, setLocalIP] = useState('');
  const [serverRunning, setServerRunning] = useState(false);
  const [serverOutput, setServerOutput] = useState([]);
  const [serverConfig, setServerConfig] = useState({
    ...DEFAULT_SERVER_CONFIG,
    ...(config.serverConfig || {})
  });
  const [dedicatedServerPath, setDedicatedServerPath] = useState(config.dedicatedServerPath || '');
  const [dsStatus, setDsStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [detectingDs, setDetectingDs] = useState(false);

  const maps = ['de_dust2', 'de_inferno', 'de_mirage', 'de_nuke', 'de_train', 'de_overpass', 'de_cbble', 'de_cache', 'de_canals', 'cs_office', 'cs_italy', 'cs_assault'];

  const gameModes = [
    { id: 'casual', label: 'Casual' },
    { id: 'competitive', label: 'Competitive' },
    { id: 'deathmatch', label: 'Deathmatch' },
    { id: 'retake', label: 'Retake' }
  ];

  useEffect(() => {
    window.electronAPI.getLocalIP().then(setLocalIP);

    window.electronAPI.onServerOutput((data) => {
      setServerOutput((prev) => [...prev.slice(-100), data]);
    });

    refreshDedicatedServerStatus();
  }, []);

  const refreshDedicatedServerStatus = async () => {
    const result = await window.electronAPI.findDedicatedServer();
    setDsStatus(result);
    if (result?.valid) {
      setDedicatedServerPath(result.path);
    } else if (dedicatedServerPath) {
      validateDedicatedServerPath(dedicatedServerPath, true);
    }
  };

  const validateDedicatedServerPath = async (pathValue, silent = false) => {
    if (!pathValue) {
      const emptyStatus = { valid: false, error: 'Set the folder that contains srcds.exe' };
      setDsStatus(emptyStatus);
      return emptyStatus;
    }

    try {
      const result = await window.electronAPI.validateDedicatedServerPath(pathValue);
      setDsStatus(result);
      if (!silent && !result.valid) addToast(result.error, 'error');
      return result;
    } catch (err) {
      const failedStatus = { valid: false, error: err.message || 'Validation failed' };
      setDsStatus(failedStatus);
      if (!silent) addToast(failedStatus.error, 'error');
      return failedStatus;
    }
  };

  const saveDedicatedServerPath = async (pathValue, status = dsStatus) => {
    const currentConfig = await window.electronAPI.loadConfig();
    const resolvedPath = status?.valid ? status.path : pathValue;
    await window.electronAPI.saveConfig({
      ...currentConfig,
      dedicatedServerPath: resolvedPath,
      serverConfig
    });
  };

  const handleDedicatedServerPathChange = (value) => {
    setDedicatedServerPath(value);
    validateDedicatedServerPath(value, true);
  };

  const handleDetectDedicatedServer = async () => {
    setDetectingDs(true);
    try {
      const result = await window.electronAPI.findDedicatedServer();
      setDsStatus(result);
      if (result?.valid) {
        setDedicatedServerPath(result.path);
        await saveDedicatedServerPath(result.path, result);
        addToast('Dedicated server detected', 'success');
      } else {
        addToast(result?.error || 'Dedicated server not found', 'warning');
      }
    } catch (err) {
      addToast(err.message || 'Detection failed', 'error');
    }
    setDetectingDs(false);
  };

  const handleBrowseDedicatedServer = async () => {
    const selectedPath = await window.electronAPI.selectDedicatedServerPath();
    if (!selectedPath) return;

    setDedicatedServerPath(selectedPath);
    const result = await validateDedicatedServerPath(selectedPath, true);
    if (result.valid) {
      await saveDedicatedServerPath(result.path, result);
      addToast('Dedicated server path saved', 'success');
    } else {
      addToast(result.error, 'error');
    }
  };

  const handleSaveDedicatedServerPath = async () => {
    const result = await validateDedicatedServerPath(dedicatedServerPath);
    if (!result.valid) return;
    await saveDedicatedServerPath(result.path, result);
    addToast('Dedicated server path saved', 'success');
  };

  const handleInstallDS = async () => {
    setInstalling(true);
    try {
      const result = await window.electronAPI.installDedicatedServer();
      const installedPath = result?.installDir || dedicatedServerPath;
      const validation = await validateDedicatedServerPath(installedPath, true);
      if (validation.valid) {
        setDedicatedServerPath(validation.path);
        await saveDedicatedServerPath(validation.path, validation);
      }
      addToast('Dedicated Server installed', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
    setInstalling(false);
  };

  const handleStartServer = async () => {
    setLoading(true);
    try {
      const currentStatus = dsStatus?.valid
        ? dsStatus
        : await validateDedicatedServerPath(dedicatedServerPath);

      if (!currentStatus.valid) {
        setLoading(false);
        return;
      }

      await saveDedicatedServerPath(currentStatus.path, currentStatus);
      await window.electronAPI.startServer({
        ...serverConfig,
        dedicatedServerPath: currentStatus.path
      });
      setServerRunning(true);
      addToast('Server started', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
    setLoading(false);
  };

  const handleStopServer = async () => {
    await window.electronAPI.stopServer();
    setServerRunning(false);
    addToast('Server stopped', 'info');
  };

  const handleLaunchCSGO = async () => {
    try {
      await window.electronAPI.launchCSGO(['-insecure', '-novid', '-console']);
      addToast('CSGO launched', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const copyIP = () => {
    const text = `${localIP}:${serverConfig.port}`;
    navigator.clipboard.writeText(text);
    addToast('IP:Port copied! In CSGO console, type connect then paste', 'success');
  };

  const dsReady = !!dsStatus?.valid;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">LAN Server</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-dark-900 rounded-xl border border-dark-800 p-6">
            <h3 className="font-semibold mb-4">Dedicated Server Path</h3>
            <div className="space-y-4">
              <input
                type="text"
                value={dedicatedServerPath}
                onChange={(e) => handleDedicatedServerPathChange(e.target.value)}
                placeholder="C:\csgo_ds or C:\steamcmd\csgo_ds"
                className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500 font-mono text-sm"
              />
              {dsStatus && (
                <div className={`text-sm ${dsStatus.valid ? 'text-green-400' : 'text-yellow-400'}`}>
                  {dsStatus.valid ? `Ready - ${dsStatus.path}` : dsStatus.error}
                </div>
              )}
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={handleDetectDedicatedServer}
                  disabled={detectingDs}
                  className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  {detectingDs ? 'Detecting...' : 'Auto Detect'}
                </button>
                <button
                  onClick={handleBrowseDedicatedServer}
                  className="bg-dark-800 hover:bg-dark-700 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Browse
                </button>
                <button
                  onClick={handleSaveDedicatedServerPath}
                  disabled={!dedicatedServerPath}
                  className="bg-dark-800 hover:bg-dark-700 disabled:opacity-50 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Save Path
                </button>
              </div>
            </div>
          </div>

          <div className="bg-dark-900 rounded-xl border border-dark-800 p-6">
            <h3 className="font-semibold mb-4">Server Configuration</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-dark-400 mb-1">Map</label>
                <select
                  value={serverConfig.map}
                  onChange={(e) => setServerConfig({ ...serverConfig, map: e.target.value })}
                  className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500"
                >
                  {maps.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-dark-400 mb-1">Game Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  {gameModes.map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setServerConfig({ ...serverConfig, gameMode: mode.id })}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        serverConfig.gameMode === mode.id
                          ? 'bg-primary-600 text-white'
                          : 'bg-dark-800 text-dark-400 hover:bg-dark-700'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between bg-dark-800 rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Bots</p>
                  <p className="text-xs text-dark-400">{serverConfig.botsEnabled ? 'Enabled (fill empty slots)' : 'Disabled'}</p>
                </div>
                <button
                  onClick={() => setServerConfig({ ...serverConfig, botsEnabled: !serverConfig.botsEnabled })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    serverConfig.botsEnabled ? 'bg-green-600' : 'bg-dark-600'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      serverConfig.botsEnabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between bg-dark-800 rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Freeze Time</p>
                  <p className="text-xs text-dark-400">{serverConfig.freezeTime ? 'Enabled' : '0 = No freeze at round start'}</p>
                </div>
                <button
                  onClick={() => setServerConfig({ ...serverConfig, freezeTime: !serverConfig.freezeTime })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    serverConfig.freezeTime ? 'bg-green-600' : 'bg-dark-600'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      serverConfig.freezeTime ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between bg-dark-800 rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Skip Warmup</p>
                  <p className="text-xs text-dark-400">Match starts immediately</p>
                </div>
                <button
                  onClick={() => setServerConfig({ ...serverConfig, skipWarmup: !serverConfig.skipWarmup })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    serverConfig.skipWarmup ? 'bg-green-600' : 'bg-dark-600'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      serverConfig.skipWarmup ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between bg-dark-800 rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Friendly Fire</p>
                  <p className="text-xs text-dark-400">Team damage ON/OFF</p>
                </div>
                <button
                  onClick={() => setServerConfig({ ...serverConfig, friendlyFire: !serverConfig.friendlyFire })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    serverConfig.friendlyFire ? 'bg-green-600' : 'bg-dark-600'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      serverConfig.friendlyFire ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-dark-400 mb-1">Max Players</label>
                  <input
                    type="number"
                    value={serverConfig.maxPlayers}
                    onChange={(e) => setServerConfig({ ...serverConfig, maxPlayers: parseInt(e.target.value, 10) })}
                    className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-dark-400 mb-1">Port</label>
                  <input
                    type="number"
                    value={serverConfig.port}
                    onChange={(e) => setServerConfig({ ...serverConfig, port: parseInt(e.target.value, 10) })}
                    className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-dark-400 mb-1">Hostname</label>
                <input
                  type="text"
                  value={serverConfig.hostname}
                  onChange={(e) => setServerConfig({ ...serverConfig, hostname: e.target.value })}
                  className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm text-dark-400 mb-1">RCON Password</label>
                <input
                  type="password"
                  value={serverConfig.rconPassword}
                  onChange={(e) => setServerConfig({ ...serverConfig, rconPassword: e.target.value })}
                  className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-dark-900 rounded-xl border border-dark-800 p-6">
            <h3 className="font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-3">
              {!serverRunning ? (
                <button
                  onClick={handleStartServer}
                  disabled={loading || !dsReady}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 py-3 rounded-lg font-bold transition-colors"
                >
                  {loading ? 'Starting...' : !dsReady ? 'Set DS Path First' : 'Start Server'}
                </button>
              ) : (
                <button
                  onClick={handleStopServer}
                  className="w-full bg-red-600 hover:bg-red-700 py-3 rounded-lg font-bold transition-colors"
                >
                  Stop Server
                </button>
              )}
              <button
                onClick={handleLaunchCSGO}
                className="w-full bg-primary-600 hover:bg-primary-700 py-3 rounded-lg font-bold transition-colors"
              >
                Launch CSGO
              </button>
            </div>
            <div className="mt-4 pt-4 border-t border-dark-700">
              <p className="text-dark-400 text-sm mb-3">
                Dedicated Server: {dsReady ? <span className="text-green-400">Ready</span> : <span className="text-yellow-400">Not Set</span>}
              </p>
              <button
                onClick={handleInstallDS}
                disabled={installing}
                className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 py-2 rounded-lg font-bold transition-colors text-sm"
              >
                {installing ? 'Installing...' : 'Install Dedicated Server'}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-dark-900 rounded-xl border border-dark-800 p-6">
            <h3 className="font-semibold mb-4">Connection Info</h3>
            <div className="bg-dark-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-dark-400 text-sm">Your Local IP</p>
                  <p className="text-xl font-mono font-bold mt-1">{localIP || 'Detecting...'}</p>
                </div>
                <button
                  onClick={copyIP}
                  className="bg-primary-600/20 hover:bg-primary-600/40 text-primary-400 px-4 py-2 rounded-lg transition-colors"
                >
                  Copy IP:Port
                </button>
              </div>
              <div className="mt-4 pt-4 border-t border-dark-700">
                <p className="text-dark-400 text-sm">Friends connect to:</p>
                <code className="block mt-2 bg-dark-950 p-3 rounded-lg font-mono text-green-400">
                  {localIP}:{serverConfig.port}
                </code>
                <p className="text-dark-500 text-xs mt-2">Type <span className="text-primary-400">connect</span> then paste in CSGO console</p>
              </div>
            </div>
          </div>

          <div className="bg-dark-900 rounded-xl border border-dark-800 p-6">
            <h3 className="font-semibold mb-4">Server Console</h3>
            <div className="bg-dark-950 rounded-lg p-4 h-64 overflow-y-auto font-mono text-sm">
              {serverOutput.length === 0 ? (
                <p className="text-dark-600">Server output will appear here...</p>
              ) : (
                serverOutput.map((line, i) => (
                  <p key={i} className="text-dark-400 whitespace-pre-wrap">{line}</p>
                ))
              )}
            </div>
          </div>

          <div className="bg-dark-900 rounded-xl border border-dark-800 p-6">
            <h3 className="font-semibold mb-4">Setup Guide</h3>
            <ol className="space-y-3 text-dark-400 text-sm">
              <li className="flex gap-3"><span className="text-primary-500 font-bold">1.</span> Auto Detect or Browse to the folder that contains srcds.exe</li>
              <li className="flex gap-3"><span className="text-primary-500 font-bold">2.</span> Configure server settings above</li>
              <li className="flex gap-3"><span className="text-primary-500 font-bold">3.</span> Click "Start Server"</li>
              <li className="flex gap-3"><span className="text-primary-500 font-bold">4.</span> Click "Copy IP:Port" and share with friends</li>
              <li className="flex gap-3"><span className="text-primary-500 font-bold">5.</span> Friends type <code className="bg-dark-800 px-2 py-0.5 rounded">connect</code> in console, paste IP:Port</li>
              <li className="flex gap-3"><span className="text-primary-500 font-bold">6.</span> Launch CSGO with "Launch CSGO" button if needed</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
