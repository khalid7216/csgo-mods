import React, { useState } from 'react';
import { ExternalLink, ShieldCheck, UserPlus } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { platformApi } from '../lib/platformApi';

export default function LoginPage({ addToast, onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [platformServer, setPlatformServer] = useState(platformApi.getApiBase());
  const [steamInput, setSteamInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [steamLoading, setSteamLoading] = useState(false);
  const [error, setError] = useState('');

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    platformApi.setApiBase(platformServer);

    try {
      const user = mode === 'login'
        ? await platformApi.login(form.email, form.password)
        : await platformApi.register(form.username, form.email, form.password);
      addToast(mode === 'login' ? 'Signed in' : 'Account created', 'success');
      onAuthenticated(user);
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const signInWithSteam = async () => {
    setSteamLoading(true);
    setError('');
    platformApi.setApiBase(platformServer);

    try {
      const session = await platformApi.startSteamAuth();
      await window.electronAPI.openExternal(session.authUrl);
      addToast('Steam login opened in browser', 'info');

      const startedAt = Date.now();
      while (Date.now() - startedAt < 5 * 60 * 1000) {
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
        const result = await platformApi.pollSteamAuth(session.sessionId);
        if (result.status === 'complete') {
          addToast('Signed in with Steam', 'success');
          onAuthenticated(result.user);
          return;
        }
        if (result.status === 'error') {
          throw new Error(result.error || 'Steam login failed');
        }
      }

      throw new Error('Steam login timed out');
    } catch (err) {
      setError(err.message || 'Steam login failed');
    } finally {
      setSteamLoading(false);
    }
  };

  const signInWithSteamId = async () => {
    setSteamLoading(true);
    setError('');
    platformApi.setApiBase(platformServer);

    try {
      const user = await platformApi.directSteamLogin(steamInput);
      addToast('Signed in with Steam ID', 'success');
      onAuthenticated(user);
    } catch (err) {
      setError(err.message || 'Steam ID login failed');
    } finally {
      setSteamLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
            {mode === 'login' ? <ShieldCheck className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
          </div>
          <CardTitle>{mode === 'login' ? 'Player Login' : 'Create Player'}</CardTitle>
          <CardDescription>CSGO Arena client access</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="platformServer">Platform Server IP</Label>
              <Input
                id="platformServer"
                value={platformServer}
                onChange={(event) => setPlatformServer(event.target.value)}
                placeholder="Admin PC IP, e.g. 192.168.1.20"
              />
            </div>

            {mode === 'register' && (
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={form.username}
                  onChange={(event) => updateField('username', event.target.value)}
                  autoComplete="nickname"
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(event) => updateField('password', event.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
              />
            </div>

            {error && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? 'Working...' : mode === 'login' ? 'Login' : 'Register'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setMode((current) => (current === 'login' ? 'register' : 'login'));
                  setError('');
                }}
              >
                {mode === 'login' ? 'Register' : 'Login'}
              </Button>
            </div>

            <div className="relative py-1 text-center text-xs text-muted-foreground">
              <span className="bg-card px-2">or</span>
            </div>

            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={steamLoading}
              onClick={signInWithSteam}
            >
              <ExternalLink className="h-4 w-4" />
              {steamLoading ? 'Waiting for Steam...' : 'Sign up with Steam'}
            </Button>

            <div className="space-y-2">
              <Label htmlFor="steamInput">SteamID64 or Profile URL</Label>
              <Input
                id="steamInput"
                value={steamInput}
                onChange={(event) => setSteamInput(event.target.value)}
                placeholder="7656119... or https://steamcommunity.com/profiles/..."
              />
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={steamLoading || !steamInput.trim()}
              onClick={signInWithSteamId}
            >
              Login with Steam ID
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
