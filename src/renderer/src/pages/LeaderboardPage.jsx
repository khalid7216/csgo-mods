import React, { useEffect, useState } from 'react';
import { Medal, RefreshCw, Trophy } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { platformApi } from '../lib/platformApi';

function displayName(entry) {
  return entry.user?.profile?.displayName || entry.user?.username || 'Player';
}

export default function LeaderboardPage({ addToast }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      setRows(await platformApi.leaderboard());
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Leaderboard</h2>
          <p className="text-sm text-muted-foreground">Ranked by ELO</p>
        </div>
        <Button variant="secondary" onClick={refresh} disabled={loading}>
          <RefreshCw className="h-4 w-4" />
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-md bg-amber-500/10 text-amber-300">
            <Trophy className="h-5 w-5" />
          </div>
          <CardTitle>Top Players</CardTitle>
          <CardDescription>{rows.length} ranked players</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="border-b border-border p-3">Rank</th>
                  <th className="border-b border-border p-3">Player</th>
                  <th className="border-b border-border p-3">Level</th>
                  <th className="border-b border-border p-3">ELO</th>
                  <th className="border-b border-border p-3">Record</th>
                  <th className="border-b border-border p-3">K/D</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => (
                  <tr key={entry.user.id}>
                    <td className="border-b border-border p-3">
                      <div className="flex items-center gap-2">
                        <Medal className="h-4 w-4 text-amber-300" />
                        <span className="font-semibold">#{entry.rank}</span>
                      </div>
                    </td>
                    <td className="border-b border-border p-3">
                      <p className="font-semibold">{displayName(entry)}</p>
                      <p className="text-xs text-muted-foreground">{entry.user.profile?.country || 'Global'}</p>
                    </td>
                    <td className="border-b border-border p-3"><Badge variant="success">Level {entry.level}</Badge></td>
                    <td className="border-b border-border p-3">{entry.elo.toLocaleString()}</td>
                    <td className="border-b border-border p-3">{entry.wins}W / {entry.losses}L</td>
                    <td className="border-b border-border p-3">{entry.kd}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td className="p-4 text-muted-foreground" colSpan="6">No ranked players yet.</td>
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
