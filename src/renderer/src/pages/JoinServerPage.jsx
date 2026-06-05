import React, { useEffect, useMemo, useState } from 'react';
import { Play, RefreshCw, Server, Wifi } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { platformApi } from '../lib/platformApi';

export default function JoinServerPage({ addToast, liveServers = [] }) {
  const [servers, setServers] = useState(liveServers);
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      const nextServers = await platformApi.playerServers();
      setServers(nextServers);
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setServers(liveServers);
  }, [liveServers]);

  useEffect(() => {
    refresh();
  }, []);

  const onlineServers = useMemo(
    () => servers.filter((server) => server.status === 'online'),
    [servers]
  );

  const joinServer = async (server) => {
    setJoining(server.id);
    try {
      await window.electronAPI.launchCSGO(['+connect', `${server.ip}:${server.port}`]);
      addToast(`Joining ${server.name}`, 'success');
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setJoining('');
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Join Now</h2>
          <p className="text-sm text-muted-foreground">Live match servers</p>
        </div>
        <Button variant="secondary" onClick={refresh} disabled={loading}>
          <RefreshCw className="h-4 w-4" />
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {onlineServers.length === 0 ? (
        <Card>
          <CardHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Wifi className="h-5 w-5" />
            </div>
            <CardTitle>No Live Server</CardTitle>
            <CardDescription>Join Now appears in the sidebar when admin starts a server.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {onlineServers.map((server) => (
            <Card key={server.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{server.hostname || server.name}</CardTitle>
                    <CardDescription>{server.ip}:{server.port}</CardDescription>
                  </div>
                  <Badge variant="success">Live</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4 grid grid-cols-2 gap-3">
                  <div className="rounded-md border border-border bg-background/50 p-3">
                    <p className="text-xs text-muted-foreground">Map</p>
                    <p className="mt-1 font-semibold">{server.map}</p>
                  </div>
                  <div className="rounded-md border border-border bg-background/50 p-3">
                    <p className="text-xs text-muted-foreground">Mode</p>
                    <p className="mt-1 font-semibold capitalize">{server.gameMode}</p>
                  </div>
                  <div className="rounded-md border border-border bg-background/50 p-3">
                    <p className="text-xs text-muted-foreground">Region</p>
                    <p className="mt-1 font-semibold">{server.region}</p>
                  </div>
                  <div className="rounded-md border border-border bg-background/50 p-3">
                    <p className="text-xs text-muted-foreground">Slots</p>
                    <p className="mt-1 font-semibold">{server.maxPlayers}</p>
                  </div>
                </div>
                <Button onClick={() => joinServer(server)} disabled={joining === server.id}>
                  <Play className="h-4 w-4" />
                  {joining === server.id ? 'Launching...' : 'Join Now'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
