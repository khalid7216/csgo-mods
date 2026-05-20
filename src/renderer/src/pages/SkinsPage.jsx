import React, { useState } from 'react';

export default function SkinsPage({ addToast }) {
  const [skinName, setSkinName] = useState('');
  const [vtfFile, setVtfFile] = useState(null);
  const [vmtGenerated, setVmtGenerated] = useState(false);
  const [vpkCreated, setVpkCreated] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleVtfSelect = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.vtf';
    input.onchange = (e) => {
      if (e.target.files[0]) {
        setVtfFile(e.target.files[0].path);
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
      const folderPath = require('path').dirname(vtfFile);
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
        vmtPath: vmtGenerated ? require('path').join(require('path').dirname(vtfFile), `${skinName}.vmt`) : null,
        vpkPath: vpkCreated ? require('path').join(require('path').dirname(vtfFile), `${require('path').basename(require('path').dirname(vtfFile))}.vpk`) : null
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
      <h2 className="text-2xl font-bold mb-6">Skins Manager</h2>

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
  );
}
