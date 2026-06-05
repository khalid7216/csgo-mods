# CSGO Mod Manager

Electron-based desktop application for managing Counter-Strike: Global Offensive mods, skins, maps, and LAN servers.

## Features Implemented

### Faceit-style Platform MVP
- **Player Client Auth** - Electron app now requires player login/register before app access
  - Seed player account on first run: `player@faceit.local` / `Player@12345`
  - Each player gets an individual profile and local stats record
  - Players can connect Steam using SteamID64 or a Steam Community profile URL
  - Players can sign up/login with Steam OpenID from the client login screen
- **Admin Web Panel** - Separate web dashboard for admin-only operations
  - Seed admin account on first run: `admin@faceit.local` / `Admin@12345`
  - View registered users, player roles/status, and per-user stats
  - Ban/activate users and promote/demote admins
  - Configure map, game mode, bots, warmup, freeze time, friendly fire, and custom commands before server start
- **Server Control API** - Local backend API controls auth, users, stats, and server actions
  - Electron starts the API automatically on `http://127.0.0.1:4180`
  - Admin web can start/stop the configured local CSGO server
  - Server start requires a valid CSGO path saved in the desktop client Settings
  - Platform runtime data is stored in `mods-cache/platform-data.json`

### GameBanana API Integration
- **Maps Browser** - Fetch and browse CS:GO maps from GameBanana
  - Search functionality with real-time filtering
  - Pagination support
  - Download and auto-install maps to CSGO directory
  - Progress tracking during downloads
- **Skins Browser** - Fetch and browse weapon skins from GameBanana
  - Search and filter skins by name/description
  - Download and install skin files
  - View mod details on GameBanana website
- **Manual Skin Install** - VMT/VPK workflow for custom skins
  - VTF file selection
  - VMT material file generation
  - VPK package creation using Steam's vpk.exe
  - One-click installation to CSGO

### Mod Management
- Track installed mods (maps and skins)
- Remove/uninstall mods with file cleanup
- Persistent mod storage in `mods-cache/`

### LAN Server
- Local IP detection for server hosting
- Start/stop CSGO dedicated server
- Server configuration (port, max players, hostname)
- Live server output console
- Server status monitoring

### Player Stats
- Fetch player stats via Steam API (pending implementation)
- Parse and display player statistics
- Cache stats locally for offline viewing

### Settings
- CSGO path detection and configuration
- Steam API key configuration
- Server settings management

## Tech Stack
- **Electron** - Desktop application framework
- **React** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Node.js** - Backend logic and file operations

## Project Structure
```
csgo-mods/
├── src/
│   ├── main/           # Electron main process
│   │   ├── index.js    # Main entry point and IPC handlers
│   │   └── preload.js  # Context bridge for renderer
│   ├── renderer/       # React frontend
│   │   ├── src/
│   │   │   ├── pages/  # Page components
│   │   │   └── components/
│   │   └── vite.config.js
│   └── utils/          # Shared utilities
│       ├── modManager.js    # GameBanana API and mod operations
│       ├── skinManager.js   # VMT/VPK skin tools
│       ├── lanServer.js     # LAN server management
│       ├── statsParser.js   # Stats parsing
│       └── csgoPath.js      # CSGO path detection
├── mods-cache/         # Local mod storage and config
└── package.json
```

## Security
- Content Security Policy (CSP) headers
- IPC input validation and sanitization
- Path traversal prevention
- URL validation for external links
- File size limits (500MB max)
- Domain whitelist for downloads
- Sandbox mode enabled
- See [SECURITY.md](SECURITY.md) for full checklist

## APIs Used

### GameBanana Core API
- `GET /Core/List/New` - Fetch latest mod IDs by game
- `GET /Core/Item/Data` - Fetch mod details with fields
- Game ID: `4660` (Counter-Strike: Global Offensive)
- Categories: Maps, Skins (RootCategory filtering)

## Pending Implementation

### Steam API Integration
- **Steam Web API** - Player stats and profile data
  - `GET /ISteamUserStats/GetUserStatsForGame` - Fetch player statistics
  - `GET /ISteamUser/GetPlayerSummaries` - Player profile information
  - `GET /ISteamUser/GetFriendList` - Friend list for LAN invites
- **Steam Authentication** - Login via Steam OpenID
- **Steam Workshop** - Browse and subscribe to workshop items
- **SteamCMD Integration** - Server installation and updates via SteamCMD
- **VAC Status** - Check VAC ban status for players
- **Game Server Query** - Query CSGO servers using A2S protocol

### Additional Features
- Mod version tracking and updates
- Backup/restore mod configurations
- Mod conflict detection
- Batch mod installation
- Mod rating and review system
- LAN server browser with server list
- Auto-update notifications for mods

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Counter-Strike: Global Offensive installed via Steam

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

### Platform Development
```bash
npm run dev
npm run dev:admin
```

For admin-only web work without the Electron client, run:
```bash
npm run dev:api
npm run dev:admin
```

Steam signup works through Steam OpenID. For richer Steam names/avatars, save a Steam Web API key in desktop Settings or set `STEAM_API_KEY` before starting the API.

### Build
```bash
npm run build
```

## Configuration
- CSGO path is auto-detected or manually set in Settings
- Steam API key required for player stats (Settings > API Key)
- Server config stored in `mods-cache/config.json`

## License
MIT
