import React, { useState, useEffect } from 'react';

export default function StatsPage({ config, setConfig, addToast }) {
  const [steamId, setSteamId] = useState(config.steamId || '');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCachedStats();
  }, []);

  const loadCachedStats = async () => {
    const cached = await window.electronAPI.getCachedStats();
    if (cached && Object.keys(cached).length > 0) {
      setStats(cached);
      if (cached.steamId && !steamId) setSteamId(cached.steamId);
    }
  };

  const saveSteamId = async (nextSteamId) => {
    const latestConfig = await window.electronAPI.loadConfig();
    const newConfig = {
      ...latestConfig,
      steamId: nextSteamId
    };
    await window.electronAPI.saveConfig(newConfig);
    if (setConfig) setConfig(newConfig);
  };

  const handleFetchStats = async () => {
    const targetSteamId = (steamId || stats?.steamId || config.steamId || '').trim();

    if (!targetSteamId || !config.steamApiKey) {
      addToast('Enter Steam ID and set API key in Settings', 'warning');
      return;
    }

    setLoading(true);
    try {
      const [profileResult, rawStats] = await Promise.all([
        window.electronAPI.fetchPlayerProfile(targetSteamId, config.steamApiKey).catch((err) => ({ error: err.message })),
        window.electronAPI.fetchPlayerStats(targetSteamId, config.steamApiKey)
      ]);

      if (rawStats.error) {
        addToast(rawStats.error, 'error');
        setLoading(false);
        return;
      }

      const parsed = await window.electronAPI.parseStats(rawStats);
      if (!parsed) {
        addToast('No public CS:GO stats returned for this Steam ID', 'warning');
        setLoading(false);
        return;
      }

      const nextStats = {
        ...parsed,
        steamId: targetSteamId,
        profile: profileResult.error ? null : profileResult,
        profileError: profileResult.error || '',
        lastUpdated: new Date().toISOString()
      };

      setStats(nextStats);
      await window.electronAPI.saveStats(nextStats);
      await saveSteamId(targetSteamId);
      addToast(profileResult.error ? 'Stats updated' : 'Steam ID connected', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to fetch stats', 'error');
    }
    setLoading(false);
  };

  const metrics = stats ? [
    { label: 'K/D Ratio', value: stats.kdRatio, color: 'text-green-400' },
    { label: 'Headshot %', value: `${stats.hsPercentage}%`, color: 'text-yellow-400' },
    { label: 'Accuracy', value: `${stats.accuracy}%`, color: 'text-blue-400' },
    { label: 'Win Rate', value: `${stats.winRate}%`, color: 'text-purple-400' },
    { label: 'MVPs', value: stats.mvps, color: 'text-orange-400' },
    { label: 'Close Range Kills', value: stats.closeRangeKills, color: 'text-red-400' }
  ] : [];

  const barData = stats ? [
    { label: 'Kills', value: stats.kills, max: Math.max(stats.kills, stats.deaths, 1) },
    { label: 'Deaths', value: stats.deaths, max: Math.max(stats.kills, stats.deaths, 1) },
    { label: 'Headshots', value: stats.headshots, max: Math.max(stats.kills, 1) },
    { label: 'MVPs', value: stats.mvps, max: Math.max(stats.mvps, stats.wins, 1) },
    { label: 'Wins', value: stats.wins, max: Math.max(stats.wins, stats.matchesPlayed, 1) },
    { label: 'Pistol Kills', value: stats.pistolKills, max: Math.max(stats.pistolKills, stats.knifeKills, 1) }
  ] : [];

  const updatedAt = stats?.lastUpdated
    ? new Date(stats.lastUpdated).toLocaleString()
    : '';

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Player Stats</h2>

      <div className="bg-dark-900 rounded-xl border border-dark-800 p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm text-dark-400 mb-1">Steam ID 64</label>
            <input
              type="text"
              value={steamId}
              onChange={(e) => setSteamId(e.target.value)}
              placeholder="76561198XXXXXXXXX"
              className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500 font-mono text-sm"
            />
          </div>
          <button
            onClick={handleFetchStats}
            disabled={loading || !steamId || !config.steamApiKey}
            className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-6 py-2 rounded-lg font-medium transition-colors"
          >
            {loading ? 'Fetching...' : stats ? 'Refresh Stats' : 'Connect Steam ID'}
          </button>
        </div>
        {!config.steamApiKey && (
          <p className="text-yellow-500 text-sm mt-3">Set your Steam API key in Settings first</p>
        )}
      </div>

      {!stats ? null : (
        <>
          <div className="bg-dark-900 rounded-xl border border-dark-800 p-6 mb-6">
            <div className="flex items-center gap-4">
              {stats.profile?.avatar && (
                <img
                  src={stats.profile.avatar}
                  alt={stats.profile.personaName}
                  className="w-16 h-16 rounded-lg object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-dark-500 text-sm">Connected Steam ID</p>
                <p className="text-xl font-bold truncate">{stats.profile?.personaName || stats.steamId}</p>
                <p className="text-dark-400 text-sm font-mono">{stats.steamId}</p>
                {updatedAt && <p className="text-dark-500 text-xs mt-1">Updated {updatedAt}</p>}
              </div>
              {stats.profile?.profileUrl && (
                <button
                  onClick={() => window.electronAPI.openExternal(stats.profile.profileUrl)}
                  className="bg-dark-800 hover:bg-dark-700 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Open Steam
                </button>
              )}
            </div>
            {stats.profileError && (
              <p className="text-yellow-500 text-sm mt-3">{stats.profileError}</p>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {metrics.map((m) => (
              <div key={m.label} className="bg-dark-900 rounded-xl border border-dark-800 p-4 text-center">
                <p className="text-dark-500 text-sm">{m.label}</p>
                <p className={`text-2xl font-bold mt-1 ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-dark-900 rounded-xl border border-dark-800 p-6">
              <h3 className="font-semibold mb-4">Performance Bars</h3>
              <div className="space-y-4">
                {barData.map((bar) => (
                  <div key={bar.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-dark-400">{bar.label}</span>
                      <span className="text-dark-300">{bar.value}</span>
                    </div>
                    <div className="h-3 bg-dark-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full transition-all"
                        style={{ width: `${bar.max > 0 ? (bar.value / bar.max) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-dark-900 rounded-xl border border-dark-800 p-6">
              <h3 className="font-semibold mb-4">Detailed Stats</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-dark-800 rounded-lg p-3">
                  <p className="text-dark-500">Total Kills</p>
                  <p className="text-lg font-bold">{stats.kills}</p>
                </div>
                <div className="bg-dark-800 rounded-lg p-3">
                  <p className="text-dark-500">Total Deaths</p>
                  <p className="text-lg font-bold">{stats.deaths}</p>
                </div>
                <div className="bg-dark-800 rounded-lg p-3">
                  <p className="text-dark-500">Shots Fired</p>
                  <p className="text-lg font-bold">{stats.shotsFired}</p>
                </div>
                <div className="bg-dark-800 rounded-lg p-3">
                  <p className="text-dark-500">Shots Hit</p>
                  <p className="text-lg font-bold">{stats.shotsHit}</p>
                </div>
                <div className="bg-dark-800 rounded-lg p-3">
                  <p className="text-dark-500">Rounds Played</p>
                  <p className="text-lg font-bold">{stats.roundsPlayed}</p>
                </div>
                <div className="bg-dark-800 rounded-lg p-3">
                  <p className="text-dark-500">Matches Played</p>
                  <p className="text-lg font-bold">{stats.matchesPlayed}</p>
                </div>
                <div className="bg-dark-800 rounded-lg p-3">
                  <p className="text-dark-500">Avg Damage/Round</p>
                  <p className="text-lg font-bold">{stats.avgDamagePerRound}</p>
                </div>
                <div className="bg-dark-800 rounded-lg p-3">
                  <p className="text-dark-500">Money Earned</p>
                  <p className="text-lg font-bold">${stats.moneyEarned?.toLocaleString()}</p>
                </div>
                <div className="bg-dark-800 rounded-lg p-3">
                  <p className="text-dark-500">Knife Kills</p>
                  <p className="text-lg font-bold">{stats.knifeKills}</p>
                </div>
                <div className="bg-dark-800 rounded-lg p-3">
                  <p className="text-dark-500">Enemies Flashed</p>
                  <p className="text-lg font-bold">{stats.enemiesFlashed}</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
