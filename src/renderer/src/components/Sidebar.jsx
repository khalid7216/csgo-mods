import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/maps', label: 'Maps', icon: '🗺️' },
  { path: '/skins', label: 'Skins', icon: '🎨' },
  { path: '/installed', label: 'Installed', icon: '📦' },
  { path: '/lan', label: 'LAN Server', icon: '🌐' },
  { path: '/stats', label: 'Stats', icon: '📊' },
  { path: '/settings', label: 'Settings', icon: '⚙️' }
];

export default function Sidebar({ csgoPath }) {
  const location = useLocation();

  return (
    <aside className="w-64 bg-dark-900 border-r border-dark-800 flex flex-col">
      <div className="p-6 border-b border-dark-800">
        <h1 className="text-xl font-bold text-primary-400">CSGO Mod Manager</h1>
        <p className="text-xs text-dark-500 mt-1 truncate" title={csgoPath}>{csgoPath ? 'CSGO Connected' : 'No CSGO Path'}</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              location.pathname === item.path
                ? 'bg-primary-600/20 text-primary-400 border border-primary-600/30'
                : 'text-dark-400 hover:bg-dark-800 hover:text-dark-200'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-dark-800">
        <div className="text-xs text-dark-600 text-center">v1.0.0</div>
      </div>
    </aside>
  );
}
