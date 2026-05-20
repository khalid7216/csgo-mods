# CSGO Mod Manager - Usage Guide

Complete guide to using CSGO Mod Manager with Counter-Strike: Global Offensive.

##  Prerequisites

### Required
- **Windows 10/11** (64-bit)
- **Steam** installed and logged in
- **Counter-Strike: Global Offensive** installed via Steam
- **Internet connection** (for GameBanana API and downloads)

### Recommended
- At least 2GB free disk space for mods
- Administrator privileges (optional, for some features)
- Stable internet connection (for downloading large files)

---

## 🚀 Getting Started

### 1. First Launch
1. Open **CSGO Mod Manager**
2. Wait for the splash screen to finish
3. You'll see "No CSGO Path" in the sidebar

### 2. Set CSGO Path
1. Go to **Settings** (gear icon in sidebar)
2. Click **"Auto-Detect CSGO Path"**
   - App will search common Steam installation folders
3. If auto-detect fails:
   - Click **"Browse"** and select your CSGO folder
   - Default path: `C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive`
4. Click **"Save Path"**
5. The sidebar should now show your CSGO path

### 3. Verify Installation
1. Go to **Installed** tab
2. You should see your current CSGO mods (if any)
3. Check that the path is correct before installing anything

---

## 🗺️ Using Maps

### Browse Maps
1. Click **Maps** in sidebar
2. Browse latest maps from GameBanana
3. Use **Search** to find specific maps (e.g., "de_dust2", "aim_map")
4. Click **Next/Previous** for pagination

### Download & Install Maps
1. Find a map you want
2. Click **"Download & Install"**
3. Wait for download to complete (progress shown)
4. Map is automatically installed to your CSGO `maps/` folder
5. Map appears in **Installed** tab

### Using Installed Maps
1. Launch CSGO
2. Open console (~ key)
3. Type: `map map_name` (without .bsp extension)
4. Or create a server and select the map from the list

### Remove Maps
1. Go to **Installed** tab
2. Find the map you want to remove
3. Click **Remove** button
4. Confirm deletion
5. Map file is deleted from CSGO folder

---

##  Using Skins

### Browse Skins (GameBanana)
1. Click **Skins** in sidebar
2. Select **"Browse GameBanana"** tab
3. Browse latest weapon skins
4. Search for specific skins (e.g., "AK-47", "AWP", "Knife")
5. Click **"Install"** to download and install
6. Skin files are saved to CSGO materials folder

### Manual Skin Install
For custom skins not on GameBanana:

1. Click **Skins** in sidebar
2. Select **"Manual Install"** tab
3. Follow the 4-step process:

#### Step 1: Select VTF File
- Click **"Select .vtf file"**
- Choose your VTF texture file
- File name appears in button

#### Step 2: Generate VMT
- Enter **Skin Name** (e.g., `ak47_redline_custom`)
- Click **"Generate VMT"**
- VMT material file is created automatically

#### Step 3: Create VPK
- Click **"Create VPK"**
- VPK package is created using Steam's vpk.exe
- Requires Steam CSGO installation

#### Step 4: Install to CSGO
- Click **"Install Skin to CSGO"**
- Files are copied to correct CSGO directories
- Skin is ready to use

### Using Installed Skins
1. Launch CSGO
2. Skins are applied automatically if installed correctly
3. For weapon skins, they appear in-game when you equip the weapon
4. For player models, select them from the character selection screen

### Remove Skins
1. Go to **Installed** tab
2. Find the skin you want to remove
3. Click **Remove** button
4. Skin files are deleted from CSGO folders

---

## 🌐 LAN Server

### Start LAN Server
1. Click **LAN Server** in sidebar
2. Configure server settings:
   - **Port**: Default 27015 (can change if needed)
   - **Max Players**: 2-32 players
   - **Server Name**: Custom name for your server
3. Click **"Start Server"**
4. Server console shows live output
5. Share your **Local IP** with friends

### Join LAN Server
**For Host:**
1. Note your Local IP shown in LAN Server tab
2. Share IP with friends (e.g., `192.168.1.100:27015`)

**For Players:**
1. Open CSGO
2. Open console (~ key)
3. Type: `connect 192.168.1.100:27015`
4. Replace with host's actual IP

### Server Commands
In server console, you can use:
- `status` - Show server status
- `kick <player>` - Kick a player
- `ban <player>` - Ban a player
- `changelevel <map>` - Change map
- `sv_cheats 1` - Enable cheats (if needed)

### Stop Server
1. Click **"Stop Server"** button
2. Server shuts down gracefully
3. All players are disconnected

---

## 📊 Player Stats

### Setup Steam API
1. Go to **Settings** tab
2. Find **Steam API Key** section
3. Get your API key from: https://steamcommunity.com/dev/apikey
4. Enter your API key
5. Click **"Save"**

### View Player Stats
1. Click **Stats** in sidebar
2. Enter **Steam ID** (64-bit format, e.g., `76561198000000000`)
   - Find your Steam ID: https://steamid.io/
3. Click **"Fetch Stats"**
4. Stats are displayed:
   - Total kills
   - Total deaths
   - K/D ratio
   - Headshots
   - Playtime
   - And more...

### Find Steam ID
**Method 1: SteamID.io**
1. Go to https://steamid.io/
2. Enter your Steam profile URL or custom URL
3. Copy the **SteamID64** number

**Method 2: Steam Console**
1. Open CSGO
2. Open console (~ key)
3. Type: `status`
4. Your Steam ID is shown next to your name

### Cached Stats
- Stats are cached locally for offline viewing
- Click **"Refresh"** to update with latest data
- Cache is stored in `mods-cache/stats.json`

---

## ️ Settings

### CSGO Path
- **Auto-Detect**: Automatically finds CSGO installation
- **Browse**: Manually select CSGO folder
- **Current Path**: Shows currently configured path
- **Save**: Save changes

### Server Configuration
- **Port**: Server port (1024-65535)
- **Max Players**: Maximum players (2-32)
- **Hostname**: Server name displayed in server browser
- **Save**: Save server settings

### Steam API Key
- Required for player stats feature
- Get free key from Steam website
- Key is stored locally (not shared)
- **Save**: Save API key

### App Settings
- **Theme**: (Future feature)
- **Language**: (Future feature)
- **Auto-Updates**: (Future feature)

---

##  Troubleshooting

### CSGO Path Not Detected
**Problem**: Auto-detect fails to find CSGO
**Solution**:
1. Manually browse to CSGO folder
2. Default location: `C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive`
3. Verify CSGO is installed and up-to-date in Steam

### Maps Not Showing In-Game
**Problem**: Installed maps don't appear in CSGO
**Solution**:
1. Verify map is in `maps/` folder
2. Check file extension is `.bsp`
3. Restart CSGO
4. Verify map name in console: `map <name>` (no .bsp)

### Skins Not Working
**Problem**: Installed skins don't appear
**Solution**:
1. Verify files are in correct directories:
   - VTF: `csgo/materials/models/weapons/`
   - VMT: Same folder as VTF
   - VPK: `csgo/` folder
2. Check VMT file references correct texture path
3. Verify VPK is created correctly
4. Restart CSGO
5. Check console for errors

### LAN Server Not Connecting
**Problem**: Friends can't join server
**Solution**:
1. Verify firewall allows CSGO and port 27015
2. Check Local IP is correct (not public IP)
3. Ensure all players are on same network
4. Try different port if 27015 is blocked
5. Verify server is running (check status)

### Download Fails
**Problem**: Map/skin download fails
**Solution**:
1. Check internet connection
2. Verify CSGO path is set correctly
3. Check available disk space
4. Try again (GameBanana may be temporarily down)
5. Check file size (max 500MB limit)

### Stats Not Loading
**Problem**: Player stats don't fetch
**Solution**:
1. Verify Steam API key is correct
2. Check Steam ID format (must be 64-bit)
3. Verify internet connection
4. Check Steam API status: https://steamstat.us/
5. Try different Steam ID

### App Crashes
**Problem**: App crashes on launch or during use
**Solution**:
1. Restart the app
2. Verify CSGO path is valid
3. Check `mods-cache/config.json` for corruption
4. Reinstall the app if needed
5. Check Windows Event Viewer for errors

### VPK Creation Fails
**Problem**: Can't create VPK file
**Solution**:
1. Verify Steam CSGO is installed
2. Check `vpk.exe` exists in CSGO `bin/` folder
3. Run app as administrator
4. Verify folder path has no special characters
5. Check available disk space

---

## 📁 File Structure

### CSGO Mod Manager Files
```
csgo-mod-manager/
├── mods-cache/
│   ├── config.json      # App configuration
│   ├── mods.json        # Installed mods tracking
│   ── stats.json       # Cached player stats
── public/
    └── icon.ico         # App icon
```

### CSGO Mod Locations
**Maps:**
```
Counter-Strike Global Offensive/
└── maps/
    └── your_map.bsp
```

**Skins:**
```
Counter-Strike Global Offensive/
└── csgo/
    ├── materials/
    │   └── models/
    │       └── weapons/
    │           └── your_skin.vtf
    │           └── your_skin.vmt
    └── your_skin.vpk
```

---

## ⚠️ Safety Tips

### General Safety
1. **Only download from trusted sources** (GameBanana is verified)
2. **Backup your CSGO folder** before installing mods
3. **Scan downloaded files** with antivirus if unsure
4. **Don't install mods from unknown sources**
5. **Keep app updated** for security patches

### VAC Safety
- **Client-side mods** (maps, skins) are generally VAC-safe
- **Server-side mods** may trigger VAC if used on VAC servers
- **Never use mods on VAC-secured servers** unless explicitly allowed
- **Use mods only on local/LAN servers** or non-VAC servers
- **When in doubt, don't use it on VAC servers**

### Backup Recommendations
1. Backup `csgo/` folder before installing skins
2. Backup `maps/` folder before installing maps
3. Keep original files in case you need to restore
4. Use Steam's "Verify Integrity" to restore original files

### Restore Original Files
If you need to restore original CSGO files:
1. Open Steam
2. Right-click CSGO → Properties
3. Installed Files → Verify Integrity
4. Steam will restore all original files
5. Your custom mods will be removed

---

## 🎮 Console Commands

### Useful CSGO Console Commands
```
// Map commands
map <map_name>          // Load a map
changelevel <map_name>  // Change to another map
mapcyclefile <file>     // Set map cycle file

// Server commands
sv_cheats 1             // Enable cheats
god                     // God mode
noclip                  // Fly through walls
give weapon_ak47        // Give yourself a weapon

// Network commands
connect <ip:port>       // Connect to server
disconnect              // Disconnect from server
status                  // Show server status

// Display commands
cl_showfps 1            // Show FPS
net_graph 1             // Show network graph
```

### Enable Console
1. Open CSGO Settings
2. Go to Game Settings
3. Enable "Developer Console"
4. Press ~ (tilde) key to open console

---

## 📞 Support

### Common Issues
- **Maps not loading**: Verify file is in `maps/` folder with `.bsp` extension
- **Skins not showing**: Check VMT references and file locations
- **LAN not working**: Verify firewall and network settings
- **Stats not loading**: Check Steam API key and Steam ID format

### Getting Help
1. Check this guide first
2. Verify all settings are correct
3. Check `mods-cache/` for error logs
4. Restart the app and CSGO
5. Reinstall if necessary

### Reporting Bugs
If you find a bug:
1. Note what you were doing
2. Check for error messages
3. Note your CSGO path
4. Report with details for faster resolution

---

## 🔄 Updates

### App Updates
- Check for updates in Settings tab
- Updates include new features and security patches
- Backup your config before updating
- Follow update instructions carefully

### Mod Updates
- Check GameBanana for mod updates
- Remove old version before installing new
- Backup custom configurations
- Read mod changelog for changes

---

## 📝 Notes

### Important Reminders
1. **Always backup** before installing mods
2. **Test on local server** before using on public servers
3. **Keep app updated** for best experience
4. **Use trusted sources** for all downloads
5. **Report issues** to help improve the app

### Performance Tips
1. Close other apps while downloading large files
2. Use wired connection for LAN server
3. Keep CSGO updated for best compatibility
4. Monitor disk space regularly
5. Remove unused mods to save space

### Best Practices
1. Name mods clearly for easy identification
2. Keep track of installed mods in Installed tab
3. Test mods before using in important games
4. Read mod descriptions for requirements
5. Follow mod author's installation instructions

---

**Happy Gaming! 🎮**

*Last Updated: 2026-05-20*
*Version: 1.0.0*
