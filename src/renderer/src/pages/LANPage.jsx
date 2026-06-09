import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Play, Power, Server, Swords, TerminalSquare, Wifi, Wrench } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { cn } from '../lib/utils';
import { DEFAULT_SERVER_CONFIG, getFirstZodError, normalizeServerConfig, serverConfigSchema } from '../lib/validation';

const COMMAND_SUGGESTIONS = [
  { command: 'mp_warmup_end', hint: 'End warmup' },
  { command: 'mp_warmuptime 0', hint: 'No warmup timer' },
  { command: 'mp_freezetime 0', hint: 'No freeze time' },
  { command: 'mp_restartgame 1', hint: 'Restart match' },
  { command: 'mp_roundtime 3', hint: 'Round minutes' },
  { command: 'mp_roundtime_defuse 3', hint: 'Defuse minutes' },
  { command: 'mp_maxrounds 30', hint: 'Match length' },
  { command: 'mp_halftime 0', hint: 'No halftime' },
  { command: 'mp_friendlyfire 1', hint: 'Team damage on' },
  { command: 'mp_friendlyfire 0', hint: 'Team damage off' },
  { command: 'mp_autoteambalance 0', hint: 'No auto balance' },
  { command: 'mp_limitteams 0', hint: 'No team limit' },
  { command: 'bot_kick', hint: 'Remove bots' },
  { command: 'bot_quota 0', hint: 'No bots' },
  { command: 'bot_quota 5', hint: 'Five bots' },
  { command: 'bot_difficulty 2', hint: 'Bot skill' },
  { command: 'sv_cheats 0', hint: 'Cheats off' },
  { command: 'sv_cheats 1', hint: 'Cheats on' },
  { command: 'sv_grenade_trajectory 1', hint: 'Nade practice' },
  { command: 'sv_infinite_ammo 1', hint: 'Practice ammo' },
  { command: 'sv_showimpacts 1', hint: 'Bullet impacts' },
  { command: 'sv_alltalk 1', hint: 'Open voice' },
  { command: 'sv_pure 0', hint: 'Custom files' },
  { command: 'changelevel de_mirage', hint: 'Switch map' },
  { command: 'say Server ready', hint: 'Server chat' }
];

const maps = [
  'de_dust2',
  'de_inferno',
  'de_mirage',
  'de_nuke',
  'de_train',
  'de_overpass',
  'de_cbble',
  'de_cache',
  'de_canals',
  'cs_office',
  'cs_italy',
  'cs_assault'
];

const gameModes = [
  { id: 'casual', label: 'Casual' },
  { id: 'competitive', label: 'Competitive' },
  { id: 'deathmatch', label: 'Deathmatch' },
  { id: 'retake', label: 'Retake' }
];

function getCurrentCommandQuery(value, caretPosition) {
  const beforeCaret = value.slice(0, caretPosition ?? value.length);
  const currentLine = beforeCaret.split(/\r?\n/).pop() || '';
  return currentLine.trimStart().split(/\s+/)[0].toLowerCase();
}

function ToggleRow({ title, caption, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-3 text-left transition-colors hover:bg-muted"
    >
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{caption}</span>
      </span>
      <span
        className={cn(
          'relative h-6 w-11 rounded-full border transition-colors',
          checked ? 'border-primary bg-primary' : 'border-border bg-background'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0.5'
          )}
        />
      </span>
    </button>
  );
}

export default function LANPage({ config, setConfig, addToast, user, discoveredServer, setDiscoveredServer }) {
  const commandsRef = useRef(null);
  const [localIP, setLocalIP] = useState('');
  const [serverRunning, setServerRunning] = useState(false);
  const [serverOutput, setServerOutput] = useState([]);
  const [serverConfig, setServerConfig] = useState(() => normalizeServerConfig(config.serverConfig));
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [dsInstalled, setDsInstalled] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const isAdmin = user?.role === 'admin';

  const commandSuggestions = useMemo(() => {
    const query = commandQuery.trim().toLowerCase();
    const matches = query
      ? COMMAND_SUGGESTIONS.filter((item) => item.command.toLowerCase().startsWith(query))
      : COMMAND_SUGGESTIONS.slice(0, 8);

    return matches.slice(0, 8);
  }, [commandQuery]);

  useEffect(() => {
    let cancelled = false;

    window.electronAPI.getLocalIP().then((ip) => {
      if (!cancelled) setLocalIP(ip);
    });

    window.electronAPI.startListening().catch((err) => {
      console.error('[LANPage] startListening failed:', err);
    });

    const unsubServerFound = window.electronAPI.onServerFound((data) => {
      if (!cancelled) setDiscoveredServer(data);
    });

    window.electronAPI.findDedicatedServer().then((installed) => {
      if (!cancelled) setDsInstalled(installed);
    });

    const outputHandler = (data) => {
      if (!cancelled) setServerOutput((prev) => [...prev.slice(-120), data]);
    };
    window.electronAPI.onServerOutput(outputHandler);

    return () => {
      cancelled = true;
      unsubServerFound();
      window.electronAPI.stopListening().catch(() => {});
    };
  }, []);

  useEffect(() => {
    setServerConfig(normalizeServerConfig(config.serverConfig));
  }, [config.serverConfig]);

  const updateServerConfig = (patch) => {
    setServerConfig((current) => ({ ...current, ...patch }));
  };

  const saveServerConfig = async (nextServerConfig) => {
    const latestConfig = await window.electronAPI.loadConfig();
    const newConfig = {
      ...latestConfig,
      serverConfig: {
        ...DEFAULT_SERVER_CONFIG,
        ...nextServerConfig
      }
    };
    await window.electronAPI.saveConfig(newConfig);
    if (setConfig) setConfig(newConfig);
  };

  const validateServerConfig = () => {
    const result = serverConfigSchema.safeParse(serverConfig);
    if (!result.success) {
      addToast(getFirstZodError(result), 'error');
      return null;
    }
    return result.data;
  };

  const updateCommandQueryFromTextarea = (textarea) => {
    setCommandQuery(getCurrentCommandQuery(textarea.value, textarea.selectionStart));
  };

  const insertCommandSuggestion = (command) => {
    const textarea = commandsRef.current;
    const currentValue = serverConfig.customCommands || '';
    const caretPosition = textarea?.selectionStart ?? currentValue.length;
    const lineStart = currentValue.lastIndexOf('\n', Math.max(0, caretPosition - 1)) + 1;
    const nextLineIndex = currentValue.indexOf('\n', caretPosition);
    const lineEnd = nextLineIndex === -1 ? currentValue.length : nextLineIndex;
    const before = currentValue.slice(0, lineStart);
    const after = currentValue.slice(lineEnd);
    const needsNewline = after && !after.startsWith('\n');
    const nextValue = `${before}${command}${needsNewline ? '\n' : ''}${after}`;

    updateServerConfig({ customCommands: nextValue });
    setCommandQuery('');

    setTimeout(() => {
      if (!commandsRef.current) return;
      const nextCaret = lineStart + command.length;
      commandsRef.current.focus();
      commandsRef.current.setSelectionRange(nextCaret, nextCaret);
    }, 0);
  };

  const handleInstallDS = async () => {
    setInstalling(true);
    try {
      await window.electronAPI.installDedicatedServer();
      setDsInstalled(true);
      addToast('Dedicated server installed', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
    setInstalling(false);
  };

  const handleStartServer = async () => {
    const parsedConfig = validateServerConfig();
    if (!parsedConfig) return;

    setLoading(true);
    try {
      setServerConfig(parsedConfig);
      await saveServerConfig(parsedConfig);
      await window.electronAPI.startServer(parsedConfig);
      await window.electronAPI.startBroadcast({
        ip: localIP,
        port: parsedConfig.port,
        hostname: parsedConfig.hostname,
        map: parsedConfig.map,
        gameMode: parsedConfig.gameMode
      });
      setServerRunning(true);
      addToast('Server started', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
    setLoading(false);
  };

  const handleStopServer = async () => {
    await window.electronAPI.stopBroadcast();
    await window.electronAPI.stopServer();
    setServerRunning(false);
    addToast('Server stopped', 'info');
  };

  const handleLaunchCSGO = async () => {
    try {
      await window.electronAPI.launchCSGO(['-insecure', '-novid', '-console']);
      addToast('CSGO launched', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleConnectToServer = async (ip, port) => {
    try {
      await window.electronAPI.launchCSGO(['-insecure', '-novid', '-console', '+connect', `${ip}:${port}`]);
      addToast('Connecting to server', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const copyIP = () => {
    const text = `${localIP}:${serverConfig.port}`;
    navigator.clipboard.writeText(text);
    addToast('IP:Port copied', 'success');
  };

  const connectCommand = `${localIP || '127.0.0.1'}:${serverConfig.port}`;

  return (
    <div className="space-y-6">
      {isAdmin ? (
        <>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-semibold tracking-normal">LAN Server</h2>
                <Badge variant={serverRunning ? 'success' : dsInstalled ? 'warning' : 'outline'}>
                  {serverRunning ? 'Online' : dsInstalled ? 'Ready' : 'Setup'}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {serverConfig.hostname} on {serverConfig.map}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleLaunchCSGO}>
                <Play className="h-4 w-4" />
                Launch CSGO
              </Button>
              {!serverRunning ? (
                <Button onClick={handleStartServer} disabled={loading || !dsInstalled} variant="success">
                  <Power className="h-4 w-4" />
                  {loading ? 'Starting' : !dsInstalled ? 'Install DS First' : 'Start Server'}
                </Button>
              ) : (
                <Button onClick={handleStopServer} variant="destructive">
                  <Power className="h-4 w-4" />
                  Stop Server
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-primary" />
                    Match Configuration
                  </CardTitle>
                  <CardDescription>Competitive profile, network settings, and round rules.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Map</Label>
                      <select
                        value={serverConfig.map}
                        onChange={(e) => updateServerConfig({ map: e.target.value })}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                      >
                        {maps.map((map) => <option key={map} value={map}>{map}</option>)}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label>Game Mode</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {gameModes.map((mode) => (
                          <Button
                            key={mode.id}
                            type="button"
                            variant={serverConfig.gameMode === mode.id ? 'default' : 'outline'}
                            onClick={() => updateServerConfig({ gameMode: mode.id })}
                            className="justify-center"
                          >
                            {mode.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <ToggleRow title="Bots" caption={serverConfig.botsEnabled ? 'Fill empty slots' : 'Player-only lobby'} checked={serverConfig.botsEnabled} onChange={(value) => updateServerConfig({ botsEnabled: value })} />
                    <ToggleRow title="Skip Warmup" caption="Force match start after map load" checked={serverConfig.skipWarmup} onChange={(value) => updateServerConfig({ skipWarmup: value })} />
                    <ToggleRow title="Freeze Time" caption={serverConfig.freezeTime ? '30 seconds' : 'Instant rounds'} checked={serverConfig.freezeTime} onChange={(value) => updateServerConfig({ freezeTime: value })} />
                    <ToggleRow title="Friendly Fire" caption={serverConfig.friendlyFire ? 'Team damage enabled' : 'Team damage disabled'} checked={serverConfig.friendlyFire} onChange={(value) => updateServerConfig({ friendlyFire: value })} />
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Max Players</Label>
                      <Input
                        type="number"
                        value={Number.isFinite(serverConfig.maxPlayers) ? serverConfig.maxPlayers : ''}
                        onChange={(e) => updateServerConfig({ maxPlayers: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Port</Label>
                      <Input
                        type="number"
                        value={Number.isFinite(serverConfig.port) ? serverConfig.port : ''}
                        onChange={(e) => updateServerConfig({ port: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Hostname</Label>
                      <Input
                        value={serverConfig.hostname}
                        onChange={(e) => updateServerConfig({ hostname: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>RCON Password</Label>
                      <Input
                        type="password"
                        value={serverConfig.rconPassword}
                        onChange={(e) => updateServerConfig({ rconPassword: e.target.value })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TerminalSquare className="h-4 w-4 text-primary" />
                    Command Console
                  </CardTitle>
                  <CardDescription>Preset commands for match, bot, and practice control.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    ref={commandsRef}
                    value={serverConfig.customCommands}
                    onChange={(e) => {
                      updateServerConfig({ customCommands: e.target.value });
                      updateCommandQueryFromTextarea(e.target);
                    }}
                    onClick={(e) => updateCommandQueryFromTextarea(e.target)}
                    onKeyUp={(e) => updateCommandQueryFromTextarea(e.target)}
                    onFocus={(e) => updateCommandQueryFromTextarea(e.target)}
                    rows={6}
                    spellCheck={false}
                    placeholder={'sv_cheats 0\nmp_roundtime 3\nmp_restartgame 1'}
                    className="font-mono"
                  />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {commandSuggestions.map((item) => (
                      <button
                        key={item.command}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertCommandSuggestion(item.command)}
                        className="rounded-md border border-border bg-muted/40 px-3 py-2 text-left transition-colors hover:bg-muted"
                      >
                        <span className="block break-all font-mono text-sm text-primary">{item.command}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{item.hint}</span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-primary" />
                    Connection
                  </CardTitle>
                  <CardDescription>LAN endpoint for the active session.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-border bg-background p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">IP:Port</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <code className="truncate font-mono text-lg text-emerald-300">{connectCommand}</code>
                      <Button variant="outline" size="icon" onClick={copyIP}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Button
                    onClick={handleInstallDS}
                    disabled={installing || dsInstalled}
                    variant={dsInstalled ? 'secondary' : 'warning'}
                    className="w-full"
                  >
                    <Server className="h-4 w-4" />
                    {installing ? 'Installing' : dsInstalled ? 'Dedicated Server Installed' : 'Install Dedicated Server'}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Server Console</CardTitle>
                  <CardDescription>Live output from the server process.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80 overflow-y-auto rounded-md border border-border bg-slate-950 p-4 font-mono text-sm">
                    {serverOutput.length === 0 ? (
                      <p className="text-muted-foreground">Waiting for server output...</p>
                    ) : (
                      serverOutput.map((line, i) => (
                        <p key={`${i}-${line.slice(0, 12)}`} className="whitespace-pre-wrap text-slate-300">{line}</p>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      ) : (
        <>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-semibold tracking-normal">LAN Server</h2>
              <Badge variant={discoveredServer ? 'success' : 'outline'}>
                {discoveredServer ? 'Online' : 'Scanning'}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {discoveredServer
                ? `Server found! Connect below to join the game.`
                : 'Listening for LAN server broadcasts on your network...'}
            </p>
          </div>

          {discoveredServer ? (
            <Card className="border-emerald-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-emerald-400" />
                  Server Discovered
                  <Badge variant="success" className="ml-auto">Online</Badge>
                </CardTitle>
                <CardDescription>A LAN server was found on your network.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Hostname</p>
                  <p className="font-medium">{discoveredServer.hostname}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border bg-background p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Map</p>
                    <p className="font-medium">{discoveredServer.map}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Mode</p>
                    <p className="font-medium capitalize">{discoveredServer.gameMode}</p>
                  </div>
                </div>
                <Button
                  className="w-full"
                  variant="success"
                  onClick={() => handleConnectToServer(discoveredServer.ip, discoveredServer.port)}
                >
                  <Swords className="h-4 w-4" />
                  Connect to Server ({discoveredServer.ip}:{discoveredServer.port})
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-primary" />
                  No Server Found
                </CardTitle>
                <CardDescription>Waiting for an admin to start a LAN server broadcast.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center gap-4 py-8 text-center">
                  <div className="h-12 w-12 animate-pulse rounded-full border-4 border-primary/30 border-t-primary" />
                  <p className="text-sm text-muted-foreground">
                    Make sure you are on the same network as the server admin.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
