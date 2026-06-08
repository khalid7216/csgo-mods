import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import SplashScreen from './components/SplashScreen';
import JoinServerPage from './pages/JoinServerPage';
import LoginPage from './pages/LoginPage';
import MapsPage from './pages/MapsPage';
import SkinsPage from './pages/SkinsPage';
import InstalledModsPage from './pages/InstalledModsPage';
import LANPage from './pages/LANPage';
import LeaderboardPage from './pages/LeaderboardPage';
import MatchmakingPage from './pages/MatchmakingPage';
import PlayerHomePage from './pages/PlayerHomePage';
import PlatformStatsPage from './pages/PlatformStatsPage';
import StatsPage from './pages/StatsPage';
import SettingsPage from './pages/SettingsPage';
import Toast from './components/Toast';
import { platformApi } from './lib/platformApi';
import { useAppStore } from './stores/appStore';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [sessionUser, setSessionUser] = useState(null);
  const [liveServers, setLiveServers] = useState([]);
  const [discoveredServer, setDiscoveredServer] = useState(null);
  const config = useAppStore((state) => state.config);
  const setConfig = useAppStore((state) => state.setConfig);
  const toasts = useAppStore((state) => state.toasts);
  const addToast = useAppStore((state) => state.addToast);

  useEffect(() => {
    let mounted = true;

    async function boot() {
      try {
        const loadedConfig = await window.electronAPI.loadConfig();
        if (loadedConfig && loadedConfig.csgoPath) {
          const validation = await window.electronAPI.validateCSGOPath(loadedConfig.csgoPath);
          if (!validation.valid) {
            loadedConfig.csgoPath = '';
            await window.electronAPI.saveConfig(loadedConfig);
          }
        }
        if (mounted) setConfig(loadedConfig);

        if (platformApi.getToken()) {
          try {
            const user = await platformApi.me();
            if (mounted) setSessionUser(user);
          } catch {
            platformApi.logout();
          }
        }
      } finally {
        if (mounted) setAuthReady(true);
      }
    }

    boot();

    window.electronAPI.onToast((data) => {
      addToast(data.message, data.type);
    });

    window.electronAPI.onDownloadProgress((data) => {
      addToast(`Download: ${data.percent}%`, 'info');
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!sessionUser) {
      setLiveServers([]);
      return undefined;
    }

    let mounted = true;
    const loadServers = async () => {
      try {
        const servers = await platformApi.playerServers();
        if (mounted) {
          setLiveServers(servers.filter((server) => server.status === 'online'));
        }
      } catch {
        if (mounted) setLiveServers([]);
      }
    };

    loadServers();
    const interval = window.setInterval(loadServers, 5000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [sessionUser?.id]);

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  if (!config || !authReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-dark-950">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-dark-400">Loading CSGO Mod Manager...</p>
        </div>
      </div>
    );
  }

  if (!sessionUser) {
    return (
      <>
        <LoginPage addToast={addToast} onAuthenticated={setSessionUser} />
        <Toast toasts={toasts} />
      </>
    );
  }

  const logout = () => {
    platformApi.logout();
    setSessionUser(null);
    setLiveServers([]);
    addToast('Signed out', 'info');
  };

  const isAdmin = sessionUser.role === 'admin';
  const adminOnly = (element) => (isAdmin ? element : <Navigate to="/profile" replace />);

  return (
    <div className="flex h-screen bg-background text-foreground">
      <div className="relative z-10 flex w-full h-full">
        <Sidebar
          csgoPath={config.csgoPath}
          liveServers={liveServers}
          user={sessionUser}
          onLogout={logout}
          serverAvailable={!!discoveredServer}
        />
        <main className="flex-1 overflow-y-auto p-6">
        <Routes>
          <Route path="/" element={<Navigate to="/profile" replace />} />
          <Route
            path="/join"
            element={<JoinServerPage addToast={addToast} liveServers={liveServers} />}
          />
          <Route
            path="/profile"
            element={(
              <PlayerHomePage
                addToast={addToast}
                liveServers={liveServers}
                onUserChange={setSessionUser}
                user={sessionUser}
              />
            )}
          />
          <Route path="/matchmaking" element={<MatchmakingPage addToast={addToast} />} />
          <Route path="/leaderboard" element={<LeaderboardPage addToast={addToast} />} />
          <Route path="/maps" element={adminOnly(<MapsPage addToast={addToast} />)} />
          <Route path="/skins" element={adminOnly(<SkinsPage addToast={addToast} />)} />
          <Route path="/installed" element={adminOnly(<InstalledModsPage addToast={addToast} />)} />
          <Route path="/lan" element={<LANPage config={config} setConfig={setConfig} addToast={addToast} user={sessionUser} discoveredServer={discoveredServer} setDiscoveredServer={setDiscoveredServer} />} />
          <Route
            path="/stats"
            element={isAdmin
              ? <StatsPage config={config} setConfig={setConfig} addToast={addToast} />
              : <PlatformStatsPage addToast={addToast} user={sessionUser} />}
          />
          <Route path="/settings" element={adminOnly(<SettingsPage config={config} setConfig={setConfig} addToast={addToast} />)} />
          <Route path="*" element={<Navigate to="/profile" replace />} />
        </Routes>
        </main>
        <Toast toasts={toasts} />
      </div>
    </div>
  );
}
