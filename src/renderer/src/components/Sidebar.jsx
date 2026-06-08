import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, Box, ListOrdered, LogOut, Map, Palette, Play, Settings, Swords, UserCircle, Wifi } from 'lucide-react';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';

const playerNavItems = [
  { path: '/profile', label: 'Profile', Icon: UserCircle },
  { path: '/matchmaking', label: 'Find Match', Icon: Swords },
  { path: '/lan', label: 'LAN Server', Icon: Wifi, badge: null },
  { path: '/stats', label: 'Stats', Icon: BarChart3 },
  { path: '/leaderboard', label: 'Leaderboard', Icon: ListOrdered }
];

const adminNavItems = [
  { path: '/profile', label: 'Profile', Icon: UserCircle },
  { path: '/matchmaking', label: 'Find Match', Icon: Swords },
  { path: '/leaderboard', label: 'Leaderboard', Icon: ListOrdered },
  { path: '/maps', label: 'Maps', Icon: Map },
  { path: '/skins', label: 'Skins', Icon: Palette },
  { path: '/installed', label: 'Installed', Icon: Box },
  { path: '/lan', label: 'LAN Server', Icon: Wifi },
  { path: '/stats', label: 'Stats', Icon: BarChart3 },
  { path: '/settings', label: 'Settings', Icon: Settings }
];

export default function Sidebar({ csgoPath, liveServers = [], onLogout, user, serverAvailable }) {
  const location = useLocation();
  const folderName = csgoPath ? (csgoPath.split('\\').pop() || csgoPath.split('/').pop()) : '';
  const isAdmin = user?.role === 'admin';
  const hasLiveServer = liveServers.length > 0;
  const navItems = [
    ...(isAdmin
      ? adminNavItems.map((item) => ({
          ...item,
          badge: item.path === '/lan' && serverAvailable ? 'SERVER FOUND' : undefined
        }))
      : playerNavItems.map((item) => ({
          ...item,
          badge: item.path === '/lan' && serverAvailable ? 'SERVER FOUND' : undefined
        }))
    ),
    ...(hasLiveServer ? [{ path: '/join', label: 'Connect Game', Icon: Play, live: true }] : [])
  ];

  return (
    <aside className="flex w-64 min-w-64 flex-col border-r border-border bg-card/80 backdrop-blur-xl">
      <div className="border-b border-border p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-black">
            5V
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-normal">CSGO Arena</h1>
            <p className="truncate text-xs text-muted-foreground">{isAdmin ? 'Admin client' : 'Player client'}</p>
          </div>
        </div>
        <div className="mt-4">
          <Badge variant={csgoPath ? 'success' : 'warning'} className="max-w-full">
            <span className="truncate">{csgoPath ? `CSGO: ${folderName}` : 'CSGO path missing'}</span>
          </Badge>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map(({ path, label, Icon, live, badge }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                live
                  ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/20'
                  : active
                  ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{label}</span>
              {badge && (
                <Badge variant="success" className="ml-auto text-[10px] px-1.5 py-0">
                  {badge}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-border p-4">
        <div className="rounded-md bg-muted px-3 py-2">
          <p className="truncate text-sm font-medium">{user?.profile?.displayName || user?.username}</p>
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
