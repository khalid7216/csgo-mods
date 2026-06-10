import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Ban, CheckCircle2, LogOut, Play, Power, Save, Server, Shield, Swords, Users } from 'lucide-react';
import { adminApi, getToken, login, logout, me } from './api';

function Notice({ notice }) {
  if (!notice) return null;
  return <div className={`notice ${notice.type || 'info'}`}>{notice.message}</div>;
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Metric({ label, value, icon: Icon }) {
  return (
    <div className="metric">
      <div className="metric-icon"><Icon size={18} /></div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function kdRatio(stats = {}) {
  const kills = Number(stats.kills || 0);
  const deaths = Number(stats.deaths || 0);
  return deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2);
}

function playerName(player) {
  return player?.user?.profile?.displayName || player?.user?.username || 'Player';
}

function Login({ onLogin, setNotice }) {
  const [email, setEmail] = useState('admin@faceit.local');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      onLogin(user);
    } catch (error) {
      setNotice({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <div className="brand-mark"><Shield size={24} /></div>
        <h1>Admin Login</h1>
        <p>CSGO Arena web control</p>
        <Field label="Email">
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
        </Field>
        <Field label="Password">
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
        </Field>
        <button className="primary-button" disabled={loading} type="submit">
          {loading ? 'Checking...' : 'Login'}
        </button>
      </form>
    </main>
  );
}

export default function App() {
  const [admin, setAdmin] = useState(null);
  const [ready, setReady] = useState(false);
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [servers, setServers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [queue, setQueue] = useState({ entries: [] });
  const [serverForms, setServerForms] = useState({});
  const [logs, setLogs] = useState([]);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState('');

  const activeServerId = servers[0]?.id;

  const showNotice = (message, type = 'info') => {
    setNotice({ message, type });
    window.setTimeout(() => setNotice(null), 3500);
  };

  const refresh = async () => {
    const [summaryData, usersData, serversData, matchesData] = await Promise.all([
      adminApi.summary(),
      adminApi.users(),
      adminApi.servers(),
      adminApi.matches()
    ]);
    setSummary(summaryData.summary);
    setUsers(usersData.users);
    setServers(serversData.servers);
    setMatches(matchesData.matches || []);
    setQueue(matchesData.queue || { entries: [] });
    setServerForms((current) => {
      const next = { ...current };
      for (const server of serversData.servers) {
        next[server.id] = {
          ...(server.config || {}),
          ...(next[server.id] || {})
        };
      }
      return next;
    });

    if (serversData.servers[0]) {
      const logData = await adminApi.logs(serversData.servers[0].id);
      setLogs(logData.logs);
    }
  };

  useEffect(() => {
    let mounted = true;
    async function boot() {
      if (!getToken()) {
        setReady(true);
        return;
      }

      try {
        const user = await me();
        if (!mounted) return;
        setAdmin(user);
        await refresh();
      } catch {
        logout();
      } finally {
        if (mounted) setReady(true);
      }
    }

    boot();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!admin) return undefined;
    const interval = window.setInterval(() => {
      refresh().catch(() => {});
    }, 7000);
    return () => window.clearInterval(interval);
  }, [admin]);

  const metrics = useMemo(() => ([
    { label: 'Users', value: summary?.users ?? 0, icon: Users },
    { label: 'Active', value: summary?.activeUsers ?? 0, icon: CheckCircle2 },
    { label: 'Banned', value: summary?.bannedUsers ?? 0, icon: Ban },
    { label: 'Servers Online', value: summary?.serversOnline ?? 0, icon: Server },
    { label: 'Queue', value: summary?.queueSize ?? queue.entries?.length ?? 0, icon: Swords },
    { label: 'Live Matches', value: summary?.activeMatches ?? 0, icon: Activity }
  ]), [summary]);

  const updateUser = async (user, patch) => {
    setBusy(user.id);
    try {
      await adminApi.updateUser(user.id, patch);
      await refresh();
      showNotice('User updated', 'success');
    } catch (error) {
      showNotice(error.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const updateServerForm = (serverId, field, value) => {
    setServerForms((current) => ({
      ...current,
      [serverId]: {
        ...(current[serverId] || {}),
        [field]: value
      }
    }));
  };

  const saveServer = async (serverId) => {
    setBusy(`save-${serverId}`);
    try {
      await adminApi.saveServer(serverId, serverForms[serverId]);
      await refresh();
      showNotice('Server config saved', 'success');
    } catch (error) {
      showNotice(error.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const startServer = async (serverId) => {
    setBusy(`start-${serverId}`);
    try {
      await adminApi.saveServer(serverId, serverForms[serverId]);
      await adminApi.startServer(serverId);
      await refresh();
      showNotice('Server start requested', 'success');
    } catch (error) {
      showNotice(error.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const stopServer = async (serverId) => {
    setBusy(`stop-${serverId}`);
    try {
      await adminApi.stopServer(serverId);
      await refresh();
      showNotice('Server stop requested', 'success');
    } catch (error) {
      showNotice(error.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const updateMatch = async (matchId, patch) => {
    setBusy(`match-${matchId}`);
    try {
      await adminApi.updateMatch(matchId, patch);
      await refresh();
      showNotice('Match updated', 'success');
    } catch (error) {
      showNotice(error.message, 'error');
    } finally {
      setBusy('');
    }
  };

  if (!ready) {
    return <div className="loading">Loading admin...</div>;
  }

  if (!admin) {
    return (
      <>
        <Login
          onLogin={async (user) => {
            setAdmin(user);
            await refresh();
          }}
          setNotice={setNotice}
        />
        <Notice notice={notice} />
      </>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Shield size={21} /></div>
          <div>
            <strong>CSGO Arena</strong>
            <span>Admin</span>
          </div>
        </div>
        <div className="admin-box">
          <strong>{admin.username}</strong>
          <span>{admin.email}</span>
        </div>
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            logout();
            setAdmin(null);
          }}
        >
          <LogOut size={16} />
          Logout
        </button>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <h1>Operations</h1>
            <p>Users, servers, and match infrastructure</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => refresh().catch((error) => showNotice(error.message, 'error'))}>
            <Activity size={16} />
            Refresh
          </button>
        </header>

        <section className="metrics">
          {metrics.map((metric) => <Metric key={metric.label} {...metric} />)}
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Users</h2>
              <p>Registered accounts</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Steam</th>
                  <th>ELO</th>
                  <th>K/D</th>
                  <th>Record</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.profile?.displayName || user.username}</strong>
                      <span>{user.email}</span>
                    </td>
                    <td><span className="pill">{user.role}</span></td>
                    <td><span className={`pill ${user.status}`}>{user.status}</span></td>
                    <td>
                      <strong>{user.profile?.steamPersonaName || user.profile?.steamId || 'Not connected'}</strong>
                      {user.profile?.steamProfileUrl && <span>Steam linked</span>}
                    </td>
                    <td>{user.stats?.elo || 1000}</td>
                    <td>{kdRatio(user.stats)}</td>
                    <td>{user.stats?.wins || 0}W / {user.stats?.losses || 0}L</td>
                    <td className="actions">
                      <button
                        type="button"
                        disabled={busy === user.id}
                        onClick={() => updateUser(user, { status: user.status === 'active' ? 'banned' : 'active' })}
                      >
                        {user.status === 'active' ? 'Ban' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        disabled={busy === user.id}
                        onClick={() => updateUser(user, { role: user.role === 'admin' ? 'player' : 'admin' })}
                      >
                        {user.role === 'admin' ? 'Make Player' : 'Make Admin'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Matches</h2>
              <p>Queue, active games, and results</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Map</th>
                  <th>Server</th>
                  <th>Team A</th>
                  <th>Team B</th>
                  <th>Winner</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match) => {
                  const teamA = match.players.filter((player) => player.team === 'A');
                  const teamB = match.players.filter((player) => player.team === 'B');
                  return (
                    <tr key={match.id}>
                      <td><span className={`pill ${match.status}`}>{match.status}</span></td>
                      <td>{match.map}</td>
                      <td>
                        <strong>{match.server?.hostname || match.server?.name || 'Unassigned'}</strong>
                        {match.server && <span>{match.server.ip}:{match.server.port}</span>}
                      </td>
                      <td>{teamA.map((player) => `${playerName(player)}${player.accepted ? ' ✓' : ''}`).join(', ')}</td>
                      <td>{teamB.map((player) => `${playerName(player)}${player.accepted ? ' ✓' : ''}`).join(', ')}</td>
                      <td>{match.winnerTeam || '-'}</td>
                      <td>{new Date(match.createdAt).toLocaleString()}</td>
                      <td className="actions">
                        {match.status === 'ready' && (
                          <button
                            type="button"
                            disabled={busy === `match-${match.id}`}
                            onClick={() => updateMatch(match.id, { status: 'live' })}
                          >
                            Mark Live
                          </button>
                        )}
                        {match.status !== 'completed' && match.status !== 'cancelled' && (
                          <>
                            <button
                              type="button"
                              disabled={busy === `match-${match.id}`}
                              onClick={() => updateMatch(match.id, { winnerTeam: 'A' })}
                            >
                              Team A Won
                            </button>
                            <button
                              type="button"
                              disabled={busy === `match-${match.id}`}
                              onClick={() => updateMatch(match.id, { winnerTeam: 'B' })}
                            >
                              Team B Won
                            </button>
                            <button
                              type="button"
                              disabled={busy === `match-${match.id}`}
                              onClick={() => updateMatch(match.id, { status: 'cancelled' })}
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {matches.length === 0 && (
                  <tr>
                    <td colSpan="8">No matches yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid-section">
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Servers</h2>
                <p>Admin controlled CSGO host</p>
              </div>
            </div>
            {servers.map((server) => {
              const form = serverForms[server.id] || server.config || {};
              return (
                <div className="server-card" key={server.id}>
                  <div className="server-title">
                    <div>
                      <strong>{server.name}</strong>
                      <span>{server.ip}:{server.port}</span>
                    </div>
                    <span className={`status ${server.status}`}>{server.status}</span>
                  </div>
                  <div className="server-form">
                    <Field label="Map">
                      <select value={form.map || 'de_dust2'} onChange={(event) => updateServerForm(server.id, 'map', event.target.value)}>
                        <option value="de_dust2">de_dust2</option>
                        <option value="de_inferno">de_inferno</option>
                        <option value="de_mirage">de_mirage</option>
                        <option value="de_nuke">de_nuke</option>
                        <option value="de_train">de_train</option>
                        <option value="de_overpass">de_overpass</option>
                        <option value="de_cbble">de_cbble</option>
                        <option value="de_cache">de_cache</option>
                        <option value="de_canals">de_canals</option>
                        <option value="cs_office">cs_office</option>
                        <option value="cs_italy">cs_italy</option>
                        <option value="cs_assault">cs_assault</option>
                      </select>
                    </Field>
                    <Field label="Port">
                      <input value={form.port || ''} type="number" onChange={(event) => updateServerForm(server.id, 'port', Number(event.target.value))} />
                    </Field>
                    <Field label="Max Players">
                      <input value={form.maxPlayers || ''} type="number" onChange={(event) => updateServerForm(server.id, 'maxPlayers', Number(event.target.value))} />
                    </Field>
                    <Field label="Mode">
                      <select value={form.gameMode || 'competitive'} onChange={(event) => updateServerForm(server.id, 'gameMode', event.target.value)}>
                        <option value="competitive">Competitive</option>
                        <option value="casual">Casual</option>
                        <option value="deathmatch">Deathmatch</option>
                        <option value="retake">Retake</option>
                      </select>
                    </Field>
                    <Field label="Hostname">
                      <input value={form.hostname || ''} onChange={(event) => updateServerForm(server.id, 'hostname', event.target.value)} />
                    </Field>
                    <Field label="RCON">
                      <input value={form.rconPassword || ''} onChange={(event) => updateServerForm(server.id, 'rconPassword', event.target.value)} type="password" />
                    </Field>
                  </div>
                  <div className="toggle-grid">
                    <label className="check-row">
                      <input
                        checked={Boolean(form.friendlyFire)}
                        type="checkbox"
                        onChange={(event) => updateServerForm(server.id, 'friendlyFire', event.target.checked)}
                      />
                      Friendly fire
                    </label>
                    <label className="check-row">
                      <input
                        checked={Boolean(form.botsEnabled)}
                        type="checkbox"
                        onChange={(event) => updateServerForm(server.id, 'botsEnabled', event.target.checked)}
                      />
                      Bots enabled
                    </label>
                    <label className="check-row">
                      <input
                        checked={Boolean(form.freezeTime)}
                        type="checkbox"
                        onChange={(event) => updateServerForm(server.id, 'freezeTime', event.target.checked)}
                      />
                      Freeze time
                    </label>
                    <label className="check-row">
                      <input
                        checked={form.skipWarmup !== false}
                        type="checkbox"
                        onChange={(event) => updateServerForm(server.id, 'skipWarmup', event.target.checked)}
                      />
                      Skip warmup
                    </label>
                  </div>
                  <Field label="Custom Commands">
                    <textarea
                      value={form.customCommands || ''}
                      onChange={(event) => updateServerForm(server.id, 'customCommands', event.target.value)}
                      placeholder="mp_roundtime 1.92&#10;mp_maxrounds 30"
                    />
                  </Field>
                  <div className="button-row">
                    <button className="secondary-button" disabled={busy === `save-${server.id}`} onClick={() => saveServer(server.id)} type="button">
                      <Save size={16} />
                      Save
                    </button>
                    <button className="primary-button" disabled={busy === `start-${server.id}`} onClick={() => startServer(server.id)} type="button">
                      <Play size={16} />
                      Start
                    </button>
                    <button className="danger-button" disabled={busy === `stop-${server.id}`} onClick={() => stopServer(server.id)} type="button">
                      <Power size={16} />
                      Stop
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="panel logs-panel">
            <div className="panel-header">
              <div>
                <h2>Server Logs</h2>
                <p>{activeServerId || 'No server selected'}</p>
              </div>
            </div>
            <pre>{logs.length ? logs.map((log) => `[${log.at}] ${log.message}`).join('\n') : 'No logs yet.'}</pre>
          </div>
        </section>
      </main>
      <Notice notice={notice} />
    </div>
  );
}
