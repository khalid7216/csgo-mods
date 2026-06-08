import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Play, RefreshCw, Shield, Swords, XCircle } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { platformApi } from '../lib/platformApi';

function matchLabel(match) {
  if (!match) return 'Idle';
  if (match.status === 'awaiting_accept') return 'Accept Required';
  if (match.status === 'ready') return 'Ready';
  if (match.status === 'live') return 'Live';
  return match.status || 'Match';
}

function statusVariant(status) {
  if (['ready', 'live', 'completed'].includes(status)) return 'success';
  if (status === 'awaiting_accept') return 'warning';
  if (status === 'cancelled') return 'danger';
  return 'outline';
}

function playerName(player) {
  return player?.user?.profile?.displayName || player?.user?.username || 'Player';
}

export default function MatchmakingPage({ addToast }) {
  const [queue, setQueue] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');

  const activeMatch = queue?.activeMatch || null;
  const recentMatches = useMemo(() => matches.slice(0, 8), [matches]);

  const refresh = async () => {
    setLoading(true);
    try {
      const [nextQueue, nextMatches] = await Promise.all([
        platformApi.queueStatus(),
        platformApi.matches()
      ]);
      setQueue(nextQueue);
      setMatches(nextMatches);
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [nextQueue, nextMatches] = await Promise.all([
          platformApi.queueStatus(),
          platformApi.matches()
        ]);
        if (!mounted) return;
        setQueue(nextQueue);
        setMatches(nextMatches);
      } catch (error) {
        if (mounted) addToast(error.message, 'error');
      }
    };

    load();
    const interval = window.setInterval(load, 3000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const findMatch = async () => {
    setBusy('queue');
    try {
      const nextQueue = await platformApi.joinQueue();
      setQueue(nextQueue);
      addToast(nextQueue.activeMatch ? 'Match found' : 'Searching for match', 'success');
      await refresh();
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const leaveQueue = async () => {
    setBusy('leave');
    try {
      setQueue(await platformApi.leaveQueue());
      addToast('Queue cancelled', 'info');
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const acceptMatch = async () => {
    if (!activeMatch) return;
    setBusy('accept');
    try {
      const result = await platformApi.acceptMatch(activeMatch.id);
      setQueue(result.queue);
      addToast('Match accepted', 'success');
      await refresh();
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const connectToMatch = async () => {
    if (!activeMatch?.server) return;
    setBusy('connect');
    try {
      await window.electronAPI.launchCSGO(['+connect', `${activeMatch.server.ip}:${activeMatch.server.port}`]);
      addToast('Launching CSGO', 'success');
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Matchmaking</h2>
          <p className="text-sm text-muted-foreground">Queue, accept, and connect</p>
        </div>
        <Button variant="secondary" onClick={refresh} disabled={loading}>
          <RefreshCw className="h-4 w-4" />
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      <section className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <Card>
          <CardHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Swords className="h-5 w-5" />
            </div>
            <CardTitle>Find Match</CardTitle>
            <CardDescription>{queue?.queued ? `Players waiting: ${queue.queueSize}` : matchLabel(activeMatch)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-border bg-background/50 p-4">
                <p className="text-sm text-muted-foreground">State</p>
                <p className="mt-2 text-xl font-semibold">{queue?.queued ? 'Searching' : matchLabel(activeMatch)}</p>
              </div>
              <div className="rounded-md border border-border bg-background/50 p-4">
                <p className="text-sm text-muted-foreground">Queue</p>
                <p className="mt-2 text-xl font-semibold">{queue?.queueSize || 0}</p>
              </div>
              <div className="rounded-md border border-border bg-background/50 p-4">
                <p className="text-sm text-muted-foreground">Map</p>
                <p className="mt-2 text-xl font-semibold">{activeMatch?.map || 'Any'}</p>
              </div>
            </div>

            {!activeMatch && !queue?.queued && (
              <Button onClick={findMatch} disabled={busy === 'queue'}>
                <Play className="h-4 w-4" />
                {busy === 'queue' ? 'Searching...' : 'Find Match'}
              </Button>
            )}

            {queue?.queued && !activeMatch && (
              <div className="flex flex-wrap gap-3">
                <Button disabled variant="secondary">
                  <Clock className="h-4 w-4" />
                  Searching
                </Button>
                <Button variant="destructive" onClick={leaveQueue} disabled={busy === 'leave'}>
                  <XCircle className="h-4 w-4" />
                  Cancel
                </Button>
              </div>
            )}

            {activeMatch?.status === 'awaiting_accept' && (
              <Button variant="warning" onClick={acceptMatch} disabled={busy === 'accept'}>
                <CheckCircle2 className="h-4 w-4" />
                {busy === 'accept' ? 'Accepting...' : 'Accept Match'}
              </Button>
            )}

            {['ready', 'live'].includes(activeMatch?.status) && (
              <Button onClick={connectToMatch} disabled={busy === 'connect' || !activeMatch.server}>
                <Play className="h-4 w-4" />
                {busy === 'connect' ? 'Launching...' : 'Connect'}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Match</CardTitle>
            <CardDescription>{activeMatch ? activeMatch.id : 'No active match'}</CardDescription>
          </CardHeader>
          <CardContent>
            {!activeMatch ? (
              <div className="rounded-md border border-border bg-background/50 p-5 text-sm text-muted-foreground">
                Queue for a match to see teams and server details.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={statusVariant(activeMatch.status)}>{matchLabel(activeMatch)}</Badge>
                  <Badge variant="outline">{activeMatch.map}</Badge>
                  {activeMatch.server && <Badge variant="success">{activeMatch.server.ip}:{activeMatch.server.port}</Badge>}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {['A', 'B'].map((team) => (
                    <div key={team} className="rounded-md border border-border bg-background/50 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        <p className="font-semibold">Team {team}</p>
                      </div>
                      <div className="space-y-2">
                        {activeMatch.players
                          .filter((player) => player.team === team)
                          .map((player) => (
                            <div key={player.userId} className="flex items-center justify-between gap-3 rounded-md bg-muted px-3 py-2">
                              <span className="truncate text-sm">{playerName(player)}</span>
                              <Badge variant={player.accepted ? 'success' : 'warning'}>
                                {player.accepted ? 'Accepted' : 'Waiting'}
                              </Badge>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Match History</CardTitle>
          <CardDescription>Recent platform matches</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="border-b border-border p-3">Status</th>
                  <th className="border-b border-border p-3">Map</th>
                  <th className="border-b border-border p-3">Teams</th>
                  <th className="border-b border-border p-3">Winner</th>
                  <th className="border-b border-border p-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {recentMatches.map((match) => (
                  <tr key={match.id}>
                    <td className="border-b border-border p-3"><Badge variant={statusVariant(match.status)}>{match.status}</Badge></td>
                    <td className="border-b border-border p-3">{match.map}</td>
                    <td className="border-b border-border p-3">
                      {match.players.map((player) => `${playerName(player)} (${player.team})`).join(', ')}
                    </td>
                    <td className="border-b border-border p-3">{match.winnerTeam || '-'}</td>
                    <td className="border-b border-border p-3">{new Date(match.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {recentMatches.length === 0 && (
                  <tr>
                    <td className="p-4 text-muted-foreground" colSpan="5">No matches yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
