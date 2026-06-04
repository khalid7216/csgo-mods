import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import SplashScreen from './components/SplashScreen';
import MapsPage from './pages/MapsPage';
import SkinsPage from './pages/SkinsPage';
import InstalledModsPage from './pages/InstalledModsPage';
import LANPage from './pages/LANPage';
import StatsPage from './pages/StatsPage';
import SettingsPage from './pages/SettingsPage';
import Toast from './components/Toast';
import { useAppStore } from './stores/appStore';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const config = useAppStore((state) => state.config);
  const setConfig = useAppStore((state) => state.setConfig);
  const toasts = useAppStore((state) => state.toasts);
  const addToast = useAppStore((state) => state.addToast);

  useEffect(() => {
    window.electronAPI.loadConfig().then(async (loadedConfig) => {
      if (loadedConfig && loadedConfig.csgoPath) {
        const validation = await window.electronAPI.validateCSGOPath(loadedConfig.csgoPath);
        if (!validation.valid) {
          // Clear invalid path from config
          loadedConfig.csgoPath = '';
          await window.electronAPI.saveConfig(loadedConfig);
        }
      }
      setConfig(loadedConfig);
    });

    window.electronAPI.onToast((data) => {
      addToast(data.message, data.type);
    });

    window.electronAPI.onDownloadProgress((data) => {
      addToast(`Download: ${data.percent}%`, 'info');
    });
  }, []);

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center h-screen bg-dark-950">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-dark-400">Loading CSGO Mod Manager...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      <div className="relative z-10 flex w-full h-full">
        <Sidebar csgoPath={config.csgoPath} />
        <main className="flex-1 overflow-y-auto p-6">
        <Routes>
          <Route path="/" element={<Navigate to="/maps" replace />} />
          <Route path="/maps" element={<MapsPage addToast={addToast} />} />
          <Route path="/skins" element={<SkinsPage addToast={addToast} />} />
          <Route path="/installed" element={<InstalledModsPage addToast={addToast} />} />
          <Route path="/lan" element={<LANPage config={config} setConfig={setConfig} addToast={addToast} />} />
          <Route path="/stats" element={<StatsPage config={config} setConfig={setConfig} addToast={addToast} />} />
          <Route path="/settings" element={<SettingsPage config={config} setConfig={setConfig} addToast={addToast} />} />
        </Routes>
        </main>
        <Toast toasts={toasts} />
      </div>
    </div>
  );
}
