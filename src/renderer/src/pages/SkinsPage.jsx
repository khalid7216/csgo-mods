import React, { useState, useEffect } from 'react';

export default function SkinsPage({ addToast }) {
  const [skins, setSkins] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(null);
  const [progress, setProgress] = useState(0);
  const [view, setView] = useState('browse');

  const [skinName, setSkinName] = useState('');
  const [vtfFile, setVtfFile] = useState(null);
  const [vmtGenerated, setVmtGenerated] = useState(false);
  const [vpkCreated, setVpkCreated] = useState(false);
  const [processing, setProcessing] = useState(false);

  const dirname = (filePath) => (filePath || '').replace(/[\\/][^\\/]*$/, '');
  const basename = (filePath) => (filePath || '').split(/[\\/]/).filter(Boolean).pop() || '';
  const joinPath = (...parts) => parts.filter(Boolean).join('\\');

  useEffect(() => {
    if (view === 'browse') fetchSkins();
  }, [page, view]);

  const fetchSkins = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.fetchGameBananaSkins(search, page);
      setSkins(result.skins || []);
    } catch (err) {
      addToast('Failed to fetch skins', 'error');
    }
    setLoading(false);
  };

  const handleDownload = async (skin) => {
    setDownloading(skin.id);
    setProgress(0);
    try {
      const result = await window.electronAPI.downloadSkin(skin);
      if (result.success) {
        addToast(`Skin installed: ${skin.name}`, 'success');
      }
    } catch (err) {
      addToast(`Download failed: ${err.message}`, 'error');
    }
    setDownloading(null);
    setProgress(0);
  };

  const handleVtfSelect = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.vtf';
    input.onchange = (e) => {
      if (e.target.files[0]) {
        setVtfFile(e.target.files[0].path || e.target.files[0].name);
        addToast(`Selected: ${e.target.files[0].name}`, 'info');
      }
    };
    input.click();
  };

  const handleGenerateVMT = async () => {
    if (!vtfFile || !skinName) {
      addToast('Select VTF file and enter skin name', 'warning');
      return;
    }
    setProcessing(true);
    try {
      const result = await window.electronAPI.createVMT(vtfFile, skinName);
      if (result.success) {
        setVmtGenerated(true);
        addToast('VMT file generated', 'success');
      }
    } catch (err) {
      addToast(`VMT creation failed: ${err.message}`, 'error');
    }
    setProcessing(false);
  };

  const handleCreateVPK = async () => {
    if (!vtfFile) return;
    setProcessing(true);
    try {
      const folderPath = dirname(vtfFile);
      const result = await window.electronAPI.createVPK(folderPath);
      if (result.success) {
        setVpkCreated(true);
        addToast('VPK created successfully', 'success');
      } else {
        addToast(result.error, 'error');
      }
    } catch (err) {
      addToast(`VPK creation failed: ${err.message}`, 'error');
    }
    setProcessing(false);
  };

  const handleInstallSkin = async () => {
    setProcessing(true);
    try {
      const result = await window.electronAPI.installSkin({
        name: skinName,
        vtfPath: vtfFile,
        vmtPath: vmtGenerated ? joinPath(dirname(vtfFile), `${skinName}.vmt`) : null,
        vpkPath: vpkCreated ? joinPath(dirname(vtfFile), `${basename(dirname(vtfFile))}.vpk`) : null
      });
      if (result.success) {
        addToast(`Skin "${skinName}" installed!`, 'success');
        setSkinName('');
        setVtfFile(null);
        setVmtGenerated(false);
        setVpkCreated(false);
      }
    } catch (err) {
      addToast(`Install failed: ${err.message}`, 'error');
    }
    setProcessing(false);
  };

  const steps = [
    { num: 1, label: 'Select VTF', done: !!vtfFile },
    { num: 2, label: 'Generate VMT', done: vmtGenerated },
    { num: 3, label: 'Create VPK', done: vpkCreated },
    { num: 4, label: 'Install to CSGO', done: false }
  ];

  return (
    <div>
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setView('browse')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${view === 'browse' ? 'bg-primary-600' : 'bg-dark-800 hover:bg-dark-700'}`}
        >
          Browse GameBanana
        </button>
        <button
          onClick={() => setView('manual')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${view === 'manual' ? 'bg-primary-600' : 'bg-dark-800 hover:bg-dark-700'}`}
        >
          Manual Install
        </button>
      </div>

      {view === 'browse' ? (
        <div>
          <h2 className="text-2xl font-bold mb-6">Browse Weapon Skins</h2>
          <div className="flex gap-4 mb-6">
            <input
              type="text"
              placeholder="Search skins..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchSkins()}
              className="flex-1 bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500"
            />
            <button
              onClick={fetchSkins}
              className="bg-primary-600 hover:bg-primary-700 px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Search
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {skins.map((skin) => (
                <div key={skin.id} className="bg-dark-900 rounded-xl border border-dark-800 overflow-hidden hover:border-dark-700 transition-colors">
                  {skin.image && (
                    <img src={skin.image} alt={skin.name} className="w-full h-40 object-cover" />
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold text-lg truncate">{skin.name}</h3>
                    <p className="text-dark-500 text-sm mt-1">by {skin.author}</p>
                    <p className="text-dark-400 text-sm mt-2 line-clamp-2">{skin.description}</p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => window.electronAPI.openExternal(skin.profileUrl)}
                        className="flex-1 py-2 rounded-lg font-medium bg-dark-800 hover:bg-dark-700 transition-colors text-sm"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleDownload(skin)}
                        disabled={downloading === skin.id}
                        className={`flex-1 py-2 rounded-lg font-medium transition-colors text-sm ${
                          downloading === skin.id
                            ? 'bg-dark-700 text-dark-400 cursor-not-allowed'
                            : 'bg-primary-600 hover:bg-primary-700'
                        }`}
                      >
                        {downloading === skin.id ? `${progress}%` : 'Install'}
                      </button>
                    </div>
                    {downloading === skin.id && (
                      <div className="mt-2 h-2 bg-dark-800 rounded-full overflow-hidden">
                        <div className="h-full bg-primary-500 transition-all" style={{ width: `${progress}%` }}></div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {skins.length === 0 && !loading && (
            <div className="text-center py-12 text-dark-500">
              <p className="text-lg">No skins found</p>
              <p className="text-sm mt-2">Try searching for weapon skins on GameBanana</p>
            </div>
          )}

          <div className="flex justify-center gap-4 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-dark-800 rounded-lg disabled:opacity-50 hover:bg-dark-700 transition-colors"
            >
              Previous
            </button>
            <span className="py-2 text-dark-400">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 bg-dark-800 rounded-lg hover:bg-dark-700 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      ) : (
        <div>
          <h2 className="text-2xl font-bold mb-6">Manual Skin Install</h2>

          <div className="flex gap-2 mb-8">
            {steps.map((step) => (
              <div key={step.num} className="flex items-center flex-1">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                  step.done ? 'bg-green-600' : 'bg-dark-800 border border-dark-700'
                }`}>
                  {step.done ? '✓' : step.num}
                </div>
                <span className="ml-2 text-sm text-dark-400">{step.label}</span>
                {step.num < 4 && <div className="flex-1 h-px bg-dark-800 mx-4"></div>}
              </div>
            ))}
          </div>

          <div className="bg-dark-900 rounded-xl border border-dark-800 p-6 max-w-2xl">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-400 mb-2">Skin Name</label>
                <input
                  type="text"
                  value={skinName}
                  onChange={(e) => setSkinName(e.target.value)}
                  placeholder="e.g., butterfly_knife_fade"
                  className="w-full bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-400 mb-2">VTF File</label>
                <div className="flex gap-4">
                  <button
                    onClick={handleVtfSelect}
                    className="flex-1 bg-dark-800 border border-dark-700 hover:border-dark-600 rounded-lg px-4 py-2 transition-colors"
                  >
                    {vtfFile ? vtfFile.split('\\').pop() : 'Select .vtf file'}
                  </button>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={handleGenerateVMT}
                  disabled={!vtfFile || !skinName || processing}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed py-2 rounded-lg font-medium transition-colors"
                >
                  {processing ? 'Processing...' : 'Generate VMT'}
                </button>
                <button
                  onClick={handleCreateVPK}
                  disabled={!vmtGenerated || processing}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed py-2 rounded-lg font-medium transition-colors"
                >
                  Create VPK
                </button>
              </div>

              <button
                onClick={handleInstallSkin}
                disabled={!vtfFile || processing}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed py-3 rounded-lg font-bold text-lg transition-colors"
              >
                Install Skin to CSGO
              </button>
            </div>
          </div>

          <div className="mt-8 bg-dark-900 rounded-xl border border-dark-800 p-6">
            <h3 className="font-semibold mb-4">How to Add Skins</h3>
            <ol className="space-y-3 text-dark-400 text-sm">
              <li className="flex gap-3"><span className="text-primary-500 font-bold">1.</span> Download .vtf texture files for your skin</li>
              <li className="flex gap-3"><span className="text-primary-500 font-bold">2.</span> Enter a skin name and select the VTF file</li>
              <li className="flex gap-3"><span className="text-primary-500 font-bold">3.</span> Generate VMT file (material definition)</li>
              <li className="flex gap-3"><span className="text-primary-500 font-bold">4.</span> Create VPK package from the folder</li>
              <li className="flex gap-3"><span className="text-primary-500 font-bold">5.</span> Install to CSGO with one click</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
