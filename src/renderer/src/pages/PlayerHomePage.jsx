import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Crosshair, ExternalLink, Link2, Play, Save, Server, Shield, Trophy, UserCircle } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { platformApi } from '../lib/platformApi';

function statValue(value) {
  return Number(value || 0).toLocaleString();
}

export default function PlayerHomePage({ addToast, liveServers = [], onUserChange, user }) {
  const [stats, setStats] = useState(user?.stats || null);
  const [saving, setSaving] = useState(false);
  const [savingSteam, setSavingSteam] = useState(false);
  const [connectingServer, setConnectingServer] = useState('');
  const [profile, setProfile] = useState({
    displayName: user?.profile?.displayName || user?.username || '',
    country: user?.profile?.country || '',
    bio: user?.profile?.bio || ''
  });
  const [steamForm, setSteamForm] = useState({
    steamInput: user?.profile?.steamId || user?.profile?.steamProfileUrl || '',
    steamPersonaName: user?.profile?.steamPersonaName || ''
  });

  useEffect(() => {
    let mounted = true;
    platformApi.stats()
      .then((loadedStats) => {
        if (mounted) setStats(loadedStats);
      })
      .catch((error) => addToast(error.message, 'error'));

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setProfile({
      displayName: user?.profile?.displayName || user?.username || '',
      country: user?.profile?.country || '',
      bio: user?.profile?.bio || ''
    });
    setSteamForm({
      steamInput: user?.profile?.steamId || user?.profile?.steamProfileUrl || '',
      steamPersonaName: user?.profile?.steamPersonaName || ''
    });
    setStats(user?.stats || null);
  }, [user]);

  const ratios = useMemo(() => {
    const kills = Number(stats?.kills || 0);
    const deaths = Number(stats?.deaths || 0);
    const matches = Number(stats?.matches || 0);
    const wins = Number(stats?.wins || 0);
    const headshots = Number(stats?.headshots || 0);

    return {
      kd: deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2),
      winRate: matches > 0 ? `${Math.round((wins / matches) * 100)}%` : '0%',
      hsRate: kills > 0 ? `${Math.round((headshots / kills) * 100)}%` : '0%'
    };
  }, [stats]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const nextUser = await platformApi.updateProfile(profile);
      onUserChange(nextUser);
      addToast('Profile saved', 'success');
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const connectSteam = async (event) => {
    event.preventDefault();
    setSavingSteam(true);
    try {
      const nextUser = await platformApi.connectSteam(steamForm);
      onUserChange(nextUser);
      addToast('Steam connected', 'success');
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setSavingSteam(false);
    }
  };

  const openSteam = () => {
    if (user?.profile?.steamProfileUrl) {
      window.electronAPI.openExternal(user.profile.steamProfileUrl);
    }
  };

  const connectGame = async (server) => {
    setConnectingServer(server.id);
    try {
      await window.electronAPI.launchCSGO(['+connect', `${server.ip}:${server.port}`]);
      addToast(`Connecting to ${server.hostname || server.name}`, 'success');
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setConnectingServer('');
    }
  };

  const rankLabel = `Level ${stats?.level || 1}`;
  const steamConnected = Boolean(user?.profile?.steamId || user?.profile?.steamProfileUrl);
  const primaryServer = liveServers[0] || null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      {primaryServer && (
        <Card className="border-emerald-500/30 bg-emerald-500/10">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-300">
                  <Server className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>{primaryServer.hostname || primaryServer.name}</CardTitle>
                  <CardDescription>
                    {primaryServer.ip}:{primaryServer.port} · {primaryServer.map} · {primaryServer.gameMode}
                  </CardDescription>
                </div>
              </div>
              <Button onClick={() => connectGame(primaryServer)} disabled={connectingServer === primaryServer.id}>
                <Play className="h-4 w-4" />
                {connectingServer === primaryServer.id ? 'Launching...' : 'Connect Game'}
              </Button>
            </div>
          </CardHeader>
        </Card>
      )}

      <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/30">
                  <UserCircle className="h-7 w-7" />
                </div>
                <div>
                  <CardTitle className="text-lg">{user?.profile?.displayName || user?.username}</CardTitle>
                  <CardDescription>{user?.email}</CardDescription>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline">Role: {user?.role || 'player'}</Badge>
                    <Badge variant={user?.status === 'active' ? 'success' : 'danger'}>
                      {user?.status || 'active'}
                    </Badge>
                    <Badge variant={steamConnected ? 'success' : 'warning'}>
                      {steamConnected ? 'Steam connected' : 'Steam missing'}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge variant="success">{rankLabel}</Badge>
                <Badge variant="outline">{statValue(stats?.elo || 1000)} ELO</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-md border border-border bg-background/50 p-4">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-amber-500/10 text-amber-300">
                  <Trophy className="h-4 w-4" />
                </div>
                <p className="text-2xl font-semibold">{statValue(stats?.wins)}</p>
                <p className="text-sm text-muted-foreground">Wins</p>
              </div>
              <div className="rounded-md border border-border bg-background/50 p-4">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-300">
                  <Activity className="h-4 w-4" />
                </div>
                <p className="text-2xl font-semibold">{ratios.winRate}</p>
                <p className="text-sm text-muted-foreground">Win Rate</p>
              </div>
              <div className="rounded-md border border-border bg-background/50 p-4">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-300">
                  <Crosshair className="h-4 w-4" />
                </div>
                <p className="text-2xl font-semibold">{ratios.kd}</p>
                <p className="text-sm text-muted-foreground">K/D</p>
              </div>
              <div className="rounded-md border border-border bg-background/50 p-4">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-red-500/10 text-red-300">
                  <Shield className="h-4 w-4" />
                </div>
                <p className="text-2xl font-semibold">{ratios.hsRate}</p>
                <p className="text-sm text-muted-foreground">HS Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Player identity</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={saveProfile}>
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={profile.displayName}
                  onChange={(event) => setProfile((current) => ({ ...current, displayName: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  maxLength={2}
                  value={profile.country}
                  onChange={(event) => setProfile((current) => ({ ...current, country: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  className="min-h-[86px]"
                  value={profile.bio}
                  onChange={(event) => setProfile((current) => ({ ...current, bio: event.target.value }))}
                />
              </div>
              <Button type="submit" disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Steam</CardTitle>
            <CardDescription>Connect your Steam profile</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={connectSteam}>
              <div className="space-y-2">
                <Label htmlFor="steamInput">SteamID64 or Profile URL</Label>
                <Input
                  id="steamInput"
                  value={steamForm.steamInput}
                  onChange={(event) => setSteamForm((current) => ({ ...current, steamInput: event.target.value }))}
                  placeholder="7656119... or https://steamcommunity.com/profiles/..."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="steamPersonaName">Steam Name</Label>
                <Input
                  id="steamPersonaName"
                  value={steamForm.steamPersonaName}
                  onChange={(event) => setSteamForm((current) => ({ ...current, steamPersonaName: event.target.value }))}
                  placeholder="Optional display name"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={savingSteam}>
                  <Link2 className="h-4 w-4" />
                  {savingSteam ? 'Connecting...' : 'Connect Steam'}
                </Button>
                {user?.profile?.steamProfileUrl && (
                  <Button type="button" variant="secondary" onClick={openSteam}>
                    <ExternalLink className="h-4 w-4" />
                    Open
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Role and platform state</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-border bg-background/50 p-4">
                <p className="text-sm text-muted-foreground">Role</p>
                <p className="mt-2 text-xl font-semibold capitalize">{user?.role || 'player'}</p>
              </div>
              <div className="rounded-md border border-border bg-background/50 p-4">
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="mt-2 text-xl font-semibold capitalize">{user?.status || 'active'}</p>
              </div>
              <div className="rounded-md border border-border bg-background/50 p-4">
                <p className="text-sm text-muted-foreground">Steam</p>
                <p className="mt-2 truncate text-xl font-semibold">
                  {user?.profile?.steamPersonaName || user?.profile?.steamId || 'Not connected'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Matches</CardTitle>
            <CardDescription>Played record</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{statValue(stats?.matches)}</p>
            <p className="mt-2 text-sm text-muted-foreground">{statValue(stats?.losses)} losses</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Kills</CardTitle>
            <CardDescription>Combat output</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{statValue(stats?.kills)}</p>
            <p className="mt-2 text-sm text-muted-foreground">{statValue(stats?.assists)} assists</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Deaths</CardTitle>
            <CardDescription>Survival record</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{statValue(stats?.deaths)}</p>
            <p className="mt-2 text-sm text-muted-foreground">{statValue(stats?.headshots)} headshots</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
