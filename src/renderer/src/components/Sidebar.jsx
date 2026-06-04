import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, Box, Map, Palette, Settings, Wifi } from 'lucide-react';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';

const navItems = [
  { path: '/maps', label: 'Maps', Icon: Map },
  { path: '/skins', label: 'Skins', Icon: Palette },
  { path: '/installed', label: 'Installed', Icon: Box },
  { path: '/lan', label: 'LAN Server', Icon: Wifi },
  { path: '/stats', label: 'Stats', Icon: BarChart3 },
  { path: '/settings', label: 'Settings', Icon: Settings }
];

export default function Sidebar({ csgoPath }) {
  const location = useLocation();
  const folderName = csgoPath ? (csgoPath.split('\\').pop() || csgoPath.split('/').pop()) : '';

  return (
    <aside className="flex w-64 min-w-64 flex-col border-r border-border bg-card/80 backdrop-blur-xl">
      <div className="border-b border-border p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-black">
            CS
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-normal">CSGO Mod Manager</h1>
            <p className="truncate text-xs text-muted-foreground">LAN, mods, stats</p>
          </div>
        </div>
        <div className="mt-4">
          <Badge variant={csgoPath ? 'success' : 'warning'} className="max-w-full">
            <span className="truncate">{csgoPath ? `CSGO: ${folderName}` : 'CSGO path missing'}</span>
          </Badge>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map(({ path, label, Icon }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-4">
        <div className="rounded-md bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
          Desktop build v1.0.0
        </div>
      </div>
    </aside>
  );
}
