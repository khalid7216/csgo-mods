import React, { useState, useEffect } from 'react';

export default function LANPage({ config, addToast }) {
  const [localIP, setLocalIP] = useState('');
  const [serverRunning, setServerRunning] = useState(false);
  const [serverOutput, setServerOutput] = useState([]);
  const [serverConfig, setServerConfig] = useState({
    map: 'de_dust2',
    maxPlayers: 16,
    hostname: 'CSGO Mod Manager Server',
    port: 27015,
    rconPassword: 'changeme'
  });
  const [loading, setLoading] = useState(false);

  const maps = ['de_dust2', 'de_inferno', 'de_mirage', 'de_nuke', 'de_train', 'de_overpass', 'de_cbble', 'de_cache', 'de_canals', 'cs_office', 'cs_italy', 'cs_assault'];

  useEffect(() => {
    window.electronAPI.getLocalIP().then(setLocalIP);

    window.electronAPI.onServerOutput((data) => {
      setServerOutput((prev) => [...prev.slice(-100), data]);
    });
  }, []);

  const handleStartServer = async () => {
    setLoading(true);
    try {
      await window.electronAPI.startServer(serverConfig);
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
    navigator.clipboard.writeText(`${localIP}:${serverConfig.port}`);
    addToast('IP copied to clipboard', 'success');
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">LAN Server</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-dark-400 mb-1">Max Players</label>
                  <input
                    type="number"
                    value={serverConfig.maxPlayers}
                    onChange={(e) => setServerConfig({ ...serverConfig, maxPlayers: parseInt(e.target.value) })}
                    className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-dark-400 mb-1">Port</label>
                  <input
                    type="number"
                    value={serverConfig.port}
                    onChange={(e) => setServerConfig({ ...serverConfig, port: parseInt(e.target.value) })}
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
                  disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 py-3 rounded-lg font-bold transition-colors"
                >
                  {loading ? 'Starting...' : 'Start Server'}
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
                  Copy Connect String
                </button>
              </div>
              <div className="mt-4 pt-4 border-t border-dark-700">
                <p className="text-dark-400 text-sm">Friends connect with:</p>
                <code className="block mt-2 bg-dark-950 p-3 rounded-lg font-mono text-green-400">
                  connect {localIP}:{serverConfig.port}
                </code>
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
              <li className="flex gap-3"><span className="text-primary-500 font-bold">1.</span> Configure server settings above</li>
              <li className="flex gap-3"><span className="text-primary-500 font-bold">2.</span> Click "Start Server" to launch SRCDS</li>
              <li className="flex gap-3"><span className="text-primary-500 font-bold">3.</span> Share your IP with friends on same WiFi</li>
              <li className="flex gap-3"><span className="text-primary-500 font-bold">4.</span> Friends type <code className="bg-dark-800 px-2 py-0.5 rounded">connect YOUR_IP:27015</code> in console</li>
              <li className="flex gap-3"><span className="text-primary-500 font-bold">5.</span> Launch CSGO with -insecure flag for mods</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
