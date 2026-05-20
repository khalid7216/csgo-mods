import React, { useState, useEffect } from 'react';

export default function SettingsPage({ config, setConfig, addToast }) {
  const [csgoPath, setCSGOPath] = useState(config.csgoPath || '');
  const [steamApiKey, setSteamApiKey] = useState(config.steamApiKey || '');
  const [serverConfig, setServerConfig] = useState(config.serverConfig || {
    port: 27015,
    maxPlayers: 16,
    hostname: 'CSGO Mod Manager Server'
  });
  const [detecting, setDetecting] = useState(false);
  const [pathStatus, setPathStatus] = useState(null);

  useEffect(() => {
    if (config.csgoPath) {
      validatePath(config.csgoPath);
    } else {
      setPathStatus(null);
    }
  }, [config.csgoPath]);

  const validatePath = async (path) => {
    if (!path) {
      setPathStatus(null);
      return;
    }
    try {
      const result = await window.electronAPI.validateCSGOPath(path);
      setPathStatus(result);
    } catch {
      setPathStatus({ valid: false, error: 'Validation failed' });
    }
  };

  const handlePathChange = (value) => {
    setCSGOPath(value);
    validatePath(value);
  };

  const handleClearPath = async () => {
    setCSGOPath('');
    setPathStatus(null);
    const newConfig = { ...config, csgoPath: '' };
    await window.electronAPI.saveConfig(newConfig);
    setConfig(newConfig);
    addToast('CSGO path cleared', 'info');
  };

  const handleDetectCSGO = async () => {
    setDetecting(true);
    try {
      const detectedPath = await window.electronAPI.detectCSGOPath();
      if (detectedPath) {
        setCSGOPath(detectedPath);
        validatePath(detectedPath);
        addToast('CSGO path detected!', 'success');
      } else {
        addToast('CSGO not found. Use manual select.', 'warning');
      }
    } catch {
      addToast('Detection failed', 'error');
    }
    setDetecting(false);
  };

  const handleManualSelect = async () => {
    const path = await window.electronAPI.selectCSGOPath();
    if (path) {
      setCSGOPath(path);
      validatePath(path);
      addToast('CSGO path selected', 'success');
    }
  };

  const handleSave = async () => {
    if (pathStatus && !pathStatus.valid) {
      addToast('Invalid CSGO path. Please fix before saving.', 'error');
      return;
    }

    const newConfig = {
      ...config,
      csgoPath,
      steamApiKey,
      serverConfig
    };
    await window.electronAPI.saveConfig(newConfig);
    setConfig(newConfig);
    addToast('Settings saved', 'success');
  };

  const handleLaunchCSGO = async () => {
    if (!csgoPath) {
      addToast('Set CSGO path first', 'warning');
      return;
    }
    try {
      await window.electronAPI.launchCSGO(['-insecure', '-novid', '-console']);
      addToast('CSGO launched with -insecure', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Settings</h2>

      <div className="space-y-6 max-w-2xl">
        <div className="bg-dark-900 rounded-xl border border-dark-800 p-6">
          <h3 className="font-semibold mb-4">CSGO Path</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={csgoPath}
                onChange={(e) => handlePathChange(e.target.value)}
                placeholder="C:\Program Files (x86)\Steam\steamapps\common\csgo legacy"
                className="flex-1 bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500 font-mono text-sm"
              />
            </div>
            {pathStatus && (
              <div className={`text-sm ${pathStatus.valid ? 'text-green-400' : 'text-red-400'}`}>
                {pathStatus.valid ? (
                  <span>✓ CSGO Found - {pathStatus.folderName}</span>
                ) : (
                  <span>✗ {pathStatus.error}</span>
                )}
              </div>
            )}
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={handleDetectCSGO}
                disabled={detecting}
                className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                {detecting ? 'Detecting...' : 'Auto Detect'}
              </button>
              <button
                onClick={handleManualSelect}
                className="bg-dark-800 hover:bg-dark-700 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Browse
              </button>
              {csgoPath && (
                <button
                  onClick={handleClearPath}
                  className="bg-red-600/20 hover:bg-red-600/30 text-red-400 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Clear Path
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="bg-dark-900 rounded-xl border border-dark-800 p-6">
          <h3 className="font-semibold mb-4">Steam API Key</h3>
          <div className="space-y-4">
            <input
              type="password"
              value={steamApiKey}
              onChange={(e) => setSteamApiKey(e.target.value)}
              placeholder="Get from https://steamcommunity.com/dev/apikey"
              className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500 font-mono text-sm"
            />
            <p className="text-dark-500 text-sm">Required for player stats. Get a free key from Steam Web API.</p>
          </div>
        </div>

        <div className="bg-dark-900 rounded-xl border border-dark-800 p-6">
          <h3 className="font-semibold mb-4">Server Configuration</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-dark-400 mb-1">Default Hostname</label>
              <input
                type="text"
                value={serverConfig.hostname}
                onChange={(e) => setServerConfig({ ...serverConfig, hostname: e.target.value })}
                className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-dark-400 mb-1">Default Port</label>
                <input
                  type="number"
                  value={serverConfig.port}
                  onChange={(e) => setServerConfig({ ...serverConfig, port: parseInt(e.target.value) })}
                  className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm text-dark-400 mb-1">Max Players</label>
                <input
                  type="number"
                  value={serverConfig.maxPlayers}
                  onChange={(e) => setServerConfig({ ...serverConfig, maxPlayers: parseInt(e.target.value) })}
                  className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-dark-900 rounded-xl border border-dark-800 p-6">
          <h3 className="font-semibold mb-4">Launch CSGO</h3>
          <p className="text-dark-400 text-sm mb-4">Launch CSGO with recommended flags for mod testing</p>
          <div className="flex gap-3">
            <button
              onClick={handleLaunchCSGO}
              className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Launch CSGO (-insecure)
            </button>
          </div>
          <div className="mt-3 flex gap-2 flex-wrap">
            {['-insecure', '-novid', '-console', '-windowed', '-noborder'].map((flag) => (
              <span key={flag} className="bg-dark-800 text-dark-400 px-3 py-1 rounded-full text-xs font-mono">{flag}</span>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          className="w-full bg-primary-600 hover:bg-primary-700 py-3 rounded-lg font-bold text-lg transition-colors"
        >
          Save All Settings
        </button>
      </div>
    </div>
  );
}
