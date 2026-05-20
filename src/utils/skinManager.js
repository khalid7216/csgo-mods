const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { isSafePath } = require('./security');

function findVPKExecutable() {
  const possiblePaths = [
    'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\bin\\vpk.exe',
    'C:\\Program Files\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\bin\\vpk.exe',
    path.join(process.env.ProgramFiles, 'Steam', 'steamapps', 'common', 'Counter-Strike Global Offensive', 'bin', 'vpk.exe'),
    path.join(process.env['ProgramFiles(x86)'], 'Steam', 'steamapps', 'common', 'Counter-Strike Global Offensive', 'bin', 'vpk.exe')
  ];

  for (const p of possiblePaths) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

async function createVMT(vtfPath, skinName) {
  if (!isSafePath(vtfPath)) {
    throw new Error('Invalid VTF path');
  }

  const dir = path.dirname(vtfPath);
  const resolvedDir = path.resolve(dir);
  const resolvedVtf = path.resolve(vtfPath);

  if (!resolvedVtf.startsWith(resolvedDir)) {
    throw new Error('Path traversal detected');
  }

  const sanitizedSkinName = skinName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100);
  const vmtPath = path.join(dir, `${sanitizedSkinName}.vmt`);

  const vmtContent = `"UnlitGeneric"
{
\t"$basetexture" "models/weapons/v_${sanitizedSkinName.toLowerCase()}"
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
  if (!isSafePath(folderPath)) {
    throw new Error('Invalid folder path');
  }

  const vpkExe = findVPKExecutable();
  if (!vpkExe) {
    return { success: false, error: 'vpk.exe not found. Please install Steam CSGO tools.' };
  }

  return new Promise((resolve) => {
    const outputDir = path.dirname(folderPath);
    const vpkName = path.basename(folderPath).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100);
    const command = `"${vpkExe}" a "${path.join(outputDir, vpkName)}" "${folderPath}\\*"`;

    exec(command, { timeout: 300000 }, (error, stdout, stderr) => {
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
  if (!isSafePath(csgoPath)) {
    throw new Error('Invalid CSGO path');
  }

  const sanitizedSkinName = skinData.name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100);
  const skinDir = path.join(csgoPath, sanitizedSkinName);

  const resolvedSkinDir = path.resolve(skinDir);
  const resolvedCsgoPath = path.resolve(csgoPath);
  if (!resolvedSkinDir.startsWith(resolvedCsgoPath)) {
    throw new Error('Path traversal detected');
  }

  if (!fs.existsSync(skinDir)) {
    fs.mkdirSync(skinDir, { recursive: true });
  }

  if (skinData.vtfPath && isSafePath(skinData.vtfPath) && fs.existsSync(skinData.vtfPath)) {
    const destVtf = path.join(skinDir, path.basename(skinData.vtfPath));
    const resolvedDestVtf = path.resolve(destVtf);
    if (resolvedDestVtf.startsWith(resolvedSkinDir)) {
      fs.copyFileSync(skinData.vtfPath, destVtf);
    }
  }

  if (skinData.vmtPath && isSafePath(skinData.vmtPath) && fs.existsSync(skinData.vmtPath)) {
    const destVmt = path.join(skinDir, path.basename(skinData.vmtPath));
    const resolvedDestVmt = path.resolve(destVmt);
    if (resolvedDestVmt.startsWith(resolvedSkinDir)) {
      fs.copyFileSync(skinData.vmtPath, destVmt);
    }
  }

  if (skinData.vpkPath && isSafePath(skinData.vpkPath) && fs.existsSync(skinData.vpkPath)) {
    const destVpk = path.join(csgoPath, path.basename(skinData.vpkPath));
    const resolvedDestVpk = path.resolve(destVpk);
    if (resolvedDestVpk.startsWith(resolvedCsgoPath)) {
      fs.copyFileSync(skinData.vpkPath, destVpk);
    }
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
