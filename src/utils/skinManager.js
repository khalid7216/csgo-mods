const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

function findVPKExecutable() {
  const possiblePaths = [
    'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\bin\\vpk.exe',
    'C:\\Program Files\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\bin\\vpk.exe',
    path.join(process.env.ProgramFiles, 'Steam', 'steamapps', 'common', 'Counter-Strike Global Offensive', 'bin', 'vpk.exe'),
    path.join(process.env['ProgramFiles(x86)'], 'Steam', 'steamapps', 'common', 'Counter-Strike Global Offensive', 'bin', 'vpk.exe')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function createVMT(vtfPath, skinName) {
  const dir = path.dirname(vtfPath);
  const vmtPath = path.join(dir, `${skinName}.vmt`);

  const vmtContent = `"UnlitGeneric"
{
\t"$basetexture" "models/weapons/v_${skinName.toLowerCase()}"
\t"$surfaceprop" "metal"
\t"$model" "1"
\t"$nofog" "1"
\t"$ignorez" "0"
\t"$halflambert" "1"
\t"$nocull" "1"
}
`;

  fs.writeFileSync(vmtPath, vmtContent);
  return { success: true, vmtPath };
}

async function createVPK(folderPath) {
  const vpkExe = findVPKExecutable();
  if (!vpkExe) {
    return { success: false, error: 'vpk.exe not found. Please install Steam CSGO tools.' };
  }

  return new Promise((resolve) => {
    const outputDir = path.dirname(folderPath);
    const vpkName = path.basename(folderPath);
    const command = `"${vpkExe}" a "${path.join(outputDir, vpkName)}" "${folderPath}\\*"`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: stderr || error.message });
      } else {
        const vpkPath = path.join(outputDir, `${vpkName}.vpk`);
        resolve({ success: true, vpkPath });
      }
    });
  });
}

async function installSkin(skinData, csgoPath) {
  const skinDir = path.join(csgoPath, skinData.name.replace(/[^a-zA-Z0-9_-]/g, '_'));
  if (!fs.existsSync(skinDir)) {
    fs.mkdirSync(skinDir, { recursive: true });
  }

  if (skinData.vtfPath && fs.existsSync(skinData.vtfPath)) {
    const destVtf = path.join(skinDir, path.basename(skinData.vtfPath));
    fs.copyFileSync(skinData.vtfPath, destVtf);
  }

  if (skinData.vmtPath && fs.existsSync(skinData.vmtPath)) {
    const destVmt = path.join(skinDir, path.basename(skinData.vmtPath));
    fs.copyFileSync(skinData.vmtPath, destVmt);
  }

  if (skinData.vpkPath && fs.existsSync(skinData.vpkPath)) {
    const destVpk = path.join(csgoPath, path.basename(skinData.vpkPath));
    fs.copyFileSync(skinData.vpkPath, destVpk);
  }

  const MODS_PATH = path.join(__dirname, '../../mods-cache/mods.json');
  let mods = { maps: [], skins: [] };
  try {
    mods = JSON.parse(fs.readFileSync(MODS_PATH, 'utf8'));
  } catch {}

  mods.skins.push({
    id: Date.now(),
    name: skinData.name,
    skinDir,
    installedAt: new Date().toISOString()
  });

  fs.writeFileSync(MODS_PATH, JSON.stringify(mods, null, 2));
  return { success: true, skinDir };
}

module.exports = { createVMT, createVPK, installSkin, findVPKExecutable };
