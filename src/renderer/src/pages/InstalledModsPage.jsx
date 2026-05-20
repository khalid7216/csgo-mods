import React, { useState, useEffect } from 'react';

export default function InstalledModsPage({ addToast }) {
  const [mods, setMods] = useState({ maps: [], skins: [] });
  const [activeTab, setActiveTab] = useState('maps');

  useEffect(() => {
    loadMods();
  }, []);

  const loadMods = async () => {
    const data = await window.electronAPI.getInstalledMods();
    setMods(data);
  };

  const handleRemove = async (modId, modType) => {
    const result = await window.electronAPI.removeMod(modId, modType);
    if (result.success) {
      addToast('Mod removed', 'success');
      loadMods();
    } else {
      addToast(result.error, 'error');
    }
  };

  const currentMods = mods[activeTab] || [];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Installed Mods</h2>

      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('maps')}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'maps' ? 'bg-primary-600' : 'bg-dark-800 hover:bg-dark-700'
          }`}
        >
          Maps ({mods.maps.length})
        </button>
        <button
          onClick={() => setActiveTab('skins')}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'skins' ? 'bg-primary-600' : 'bg-dark-800 hover:bg-dark-700'
          }`}
        >
          Skins ({mods.skins.length})
        </button>
      </div>

      {currentMods.length === 0 ? (
        <div className="text-center py-16 bg-dark-900 rounded-xl border border-dark-800">
          <p className="text-dark-500 text-lg">No {activeTab} installed</p>
          <p className="text-dark-600 text-sm mt-2">Browse and install mods from other tabs</p>
        </div>
      ) : (
        <div className="space-y-3">
          {currentMods.map((mod) => (
            <div key={mod.id} className="bg-dark-900 rounded-xl border border-dark-800 p-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{mod.name}</h3>
                <p className="text-dark-500 text-sm mt-1 truncate max-w-md">{mod.filePath || mod.skinDir}</p>
                <p className="text-dark-600 text-xs mt-1">Installed: {new Date(mod.installedAt).toLocaleDateString()}</p>
              </div>
              <button
                onClick={() => handleRemove(mod.id, activeTab)}
                className="bg-red-600/20 hover:bg-red-600/40 text-red-400 px-4 py-2 rounded-lg transition-colors"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
