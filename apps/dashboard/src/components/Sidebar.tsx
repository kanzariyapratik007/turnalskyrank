'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Radio,
  FolderGit2,
  Globe,
  BarChart3,
  KeyRound,
  Laptop,
  Settings,
  ShieldCheck,
} from 'lucide-react';

const navigation = [
  { name: 'Overview', href: '/', icon: LayoutDashboard },
  { name: 'Tunnels', href: '/tunnels', icon: Radio },
  { name: 'Admin Approvals', href: '/admin', icon: ShieldCheck },
  { name: 'Projects', href: '/projects', icon: FolderGit2 },
  { name: 'Custom Domains', href: '/domains', icon: Globe },
  { name: 'Analytics & Logs', href: '/analytics', icon: BarChart3 },
  { name: 'API Keys', href: '/apikeys', icon: KeyRound },
  { name: 'Devices', href: '/devices', icon: Laptop },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  if (pathname === '/login' || pathname === '/register') {
    return null;
  }

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 min-h-screen shadow-sm">
      <div>
        {/* Brand Logo */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-sky-500/20">
            T
          </div>
          <div>
            <span className="font-bold text-lg text-slate-900 tracking-wide">TURNAL</span>
            <span className="text-[10px] uppercase font-bold tracking-widest text-sky-600 block -mt-1">
              Tunnel Platform
            </span>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="p-4 space-y-1.5">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-sky-50 text-sky-600 border border-sky-200 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-sky-600' : 'text-slate-400'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer / System Status */}
      <div className="p-4 border-t border-slate-100">
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs text-slate-700 font-medium">Edge Ingress Active</span>
          </div>
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
        </div>
      </div>
    </aside>
  );
}
