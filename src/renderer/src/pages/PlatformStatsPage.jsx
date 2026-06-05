import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Crosshair, Medal, Shield, Target, Trophy } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { platformApi } from '../lib/platformApi';

function format(value) {
  return Number(value || 0).toLocaleString();
}

function StatCard({ Icon, label, value, hint }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <CardTitle className="text-sm">{label}</CardTitle>
        {hint && <CardDescription>{hint}</CardDescription>}
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function PlatformStatsPage({ addToast, user }) {
  const [stats, setStats] = useState(user?.stats || null);

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

  const ratios = useMemo(() => {
    const kills = Number(stats?.kills || 0);
    const deaths = Number(stats?.deaths || 0);
    const wins = Number(stats?.wins || 0);
    const matches = Number(stats?.matches || 0);
    const headshots = Number(stats?.headshots || 0);

    return {
      kd: deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2),
      winRate: matches > 0 ? `${Math.round((wins / matches) * 100)}%` : '0%',
      hsRate: kills > 0 ? `${Math.round((headshots / kills) * 100)}%` : '0%'
    };
  }, [stats]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Stats</h2>
          <p className="text-sm text-muted-foreground">{user?.profile?.displayName || user?.username}</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="success">Level {stats?.level || 1}</Badge>
          <Badge variant="outline">{format(stats?.elo || 1000)} ELO</Badge>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard Icon={Trophy} label="Wins" value={format(stats?.wins)} hint={`${format(stats?.losses)} losses`} />
        <StatCard Icon={Activity} label="Win Rate" value={ratios.winRate} hint={`${format(stats?.matches)} matches`} />
        <StatCard Icon={Crosshair} label="K/D" value={ratios.kd} hint={`${format(stats?.kills)} kills`} />
        <StatCard Icon={Target} label="HS Rate" value={ratios.hsRate} hint={`${format(stats?.headshots)} headshots`} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard Icon={Medal} label="Kills" value={format(stats?.kills)} hint={`${format(stats?.assists)} assists`} />
        <StatCard Icon={Shield} label="Deaths" value={format(stats?.deaths)} hint="Survival record" />
        <StatCard Icon={Activity} label="Matches" value={format(stats?.matches)} hint="Platform matches" />
      </div>
    </div>
  );
}
