'use client';

import React, { useState, useEffect } from 'react';
import { copyToClipboard } from '../lib/clipboard';
import { fetchApi } from '../lib/api-client';
import {
  Terminal,
  Copy,
  Check,
  ExternalLink,
  Globe,
  Laptop,
  Server,
  Zap,
  Info,
  ShieldCheck,
  Download,
  Plus,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Power
} from 'lucide-react';

interface PortMapping {
  id: string;
  name: string;
  port: string;
  subdomain: string;
  customDomain: string;
  status?: 'PENDING_APPROVAL' | 'ONLINE' | 'OFFLINE' | 'REJECTED';
}

interface QuickStartGuideProps {
  apiKey?: string;
  defaultPort?: string;
}

export function QuickStartGuide({ apiKey = 'trk_live_43021d2c8ab8a30c79ed6402964cbb3d1ed62d86464df1b9', defaultPort = '3001' }: QuickStartGuideProps) {
  const [portMappings, setPortMappings] = useState<PortMapping[]>([
    { id: '1', name: 'App Frontend', port: '3001', subdomain: 'app', customDomain: 'app.skyranksolution.com', status: 'PENDING_APPROVAL' },
    { id: '2', name: 'API Server', port: '3002', subdomain: 'api', customDomain: 'api.skyranksolution.com', status: 'PENDING_APPROVAL' },
    { id: '3', name: 'Admin Portal', port: '5000', subdomain: 'admin', customDomain: 'admin.skyranksolution.com', status: 'PENDING_APPROVAL' },
    { id: '4', name: 'Testing Microservice', port: '8000', subdomain: 'test', customDomain: 'test.skyranksolution.com', status: 'PENDING_APPROVAL' },
    { id: '5', name: 'Dev Backend', port: '8080', subdomain: 'dev', customDomain: 'dev.skyranksolution.com', status: 'PENDING_APPROVAL' },
  ]);

  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Load existing user tunnels from API
  const refreshTunnels = async () => {
    try {
      const res = await fetchApi('/api/tunnels');
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        const mapped = res.data.map((t: any, idx: number) => ({
          id: t.id || String(idx + 1),
          name: t.name || `Port ${t.localTargetPort}`,
          port: String(t.localTargetPort || 3000),
          subdomain: t.subdomain || 'tun',
          customDomain: t.customDomain || `${t.subdomain}.skyranksolution.com`,
          status: t.status
        }));
        setPortMappings(mapped);
      }
    } catch (e) {}
  };

  useEffect(() => {
    refreshTunnels();
  }, []);

  const addPortRow = () => {
    const nextPort = String(3000 + portMappings.length + 1);
    setPortMappings([
      ...portMappings,
      {
        id: String(Date.now()),
        name: `Service Port ${nextPort}`,
        port: nextPort,
        subdomain: `service-${nextPort}`,
        customDomain: `service-${nextPort}.skyranksolution.com`,
        status: 'PENDING_APPROVAL'
      }
    ]);
  };

  const removePortRow = (index: number) => {
    if (portMappings.length <= 1) return;
    setPortMappings(portMappings.filter((_, i) => i !== index));
  };

  const updatePortRow = (index: number, field: keyof PortMapping, value: string) => {
    const updated = [...portMappings];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'subdomain' && !updated[index].customDomain.includes('.')) {
      updated[index].customDomain = `${value}.skyranksolution.com`;
    }
    setPortMappings(updated);
  };

  // Submit all ports to API for Admin Approval
  const handleSubmitAll = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const items = portMappings.map(p => ({
        name: p.name,
        localTargetPort: parseInt(p.port, 10) || 3000,
        subdomain: p.subdomain.trim() || `port-${p.port}`,
        customDomain: p.customDomain.trim() || `${p.subdomain}.skyranksolution.com`,
        protocol: 'http'
      }));

      const res = await fetchApi('/api/tunnels/batch', {
        method: 'POST',
        body: JSON.stringify({ items })
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          text: `Successfully submitted ${items.length} port tunnel requests! Pending Admin approval.`
        });
        refreshTunnels();
      } else {
        setFeedback({
          type: 'error',
          text: res.error?.message || 'Failed to submit port configurations'
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  // Download pre-configured agent ZIP
  const handleDownloadZip = async () => {
    setDownloading(true);
    setFeedback(null);
    try {
      const activeKey = apiKey || localStorage.getItem('turnal_token') || 'trk_live_43021d2c8ab8a30c79ed6402964cbb3d1ed62d86464df1b9';

      const tunnelConfigs = portMappings.map(p => ({
        id: p.id,
        name: p.name,
        port: parseInt(p.port, 10) || 3000,
        subdomain: p.subdomain,
        domain: p.customDomain || `${p.subdomain}.skyranksolution.com`,
        status: p.status || 'PENDING_APPROVAL'
      }));

      const configFileContent = JSON.stringify({
        version: '1.0.0',
        apiKey: activeKey,
        apiUrl: 'https://dashboard.skyranksolution.com',
        edgeWsUrl: 'ws://13.62.54.247:8080/tunnel/connect',
        tunnels: tunnelConfigs
      }, null, 2);

      const runAgentBat = `@echo off
title Turnal Multi-Tunnel Agent
color 0B
cls
echo ========================================================
echo        TURNAL SECURE LOCAL-TO-PUBLIC AGENT
echo ========================================================
echo.
echo [1/3] Loading configured tunnels from config.json...
echo [2/3] Connecting to Turnal Edge Server (13.62.54.247:8080)...
echo [3/3] Checking Admin Approval & SSL status...
echo.

node cli.mjs run-config
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Agent stopped with error code %ERRORLEVEL%.
    pause
)
`;

      const installAutostartBat = `@echo off
title Turnal Auto-Start Installer
color 0A
cls
echo ========================================================
echo        TURNAL AUTO-START & BOOT RECOVERY SETUP
echo ========================================================
echo.
echo Installing Turnal Agent to Windows Startup...
echo If your PC restarts or power goes out, Turnal will automatically resume!
echo.

set STARTUP_DIR=%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup
set SCRIPT_DIR=%~dp0

echo Set oWS = WScript.CreateObject("WScript.Shell") > "%TEMP%\\create_shortcut.vbs"
echo sLinkFile = "%STARTUP_DIR%\\TurnalAgent.lnk" >> "%TEMP%\\create_shortcut.vbs"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%TEMP%\\create_shortcut.vbs"
echo oLink.TargetPath = "%SCRIPT_DIR%run-agent.bat" >> "%TEMP%\\create_shortcut.vbs"
echo oLink.WorkingDirectory = "%SCRIPT_DIR%" >> "%TEMP%\\create_shortcut.vbs"
echo oLink.Description = "Turnal Multi-Tunnel Background Agent" >> "%TEMP%\\create_shortcut.vbs"
echo oLink.Save >> "%TEMP%\\create_shortcut.vbs"

cscript /nologo "%TEMP%\\create_shortcut.vbs"
del "%TEMP%\\create_shortcut.vbs"

echo.
echo [SUCCESS] Turnal Auto-Start successfully installed!
echo Turnal will automatically boot and keep your projects live.
echo.
pause
`;

      const uninstallAutostartBat = `@echo off
title Remove Turnal Auto-Start
color 0C
cls
echo Removing Turnal from Windows Startup...
del "%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\TurnalAgent.lnk" >nul 2>&1
echo [OK] Auto-Start removed.
pause
`;

      const cliMjsContent = `// Turnal Standalone Multi-Port CLI Agent Runner
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import { WebSocket } from 'ws';

console.log('\\x1b[36m%s\\x1b[0m', '🌐 TURNAL MULTI-PORT AGENT RUNNER');

const configPath = path.join(process.cwd(), 'config.json');
if (!fs.existsSync(configPath)) {
  console.error('\\x1b[31m[ERROR] config.json not found!\\x1b[0m');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
console.log(\`Loaded \${config.tunnels.length} mapped local ports.\\n\`);

async function startTunnel(tunnel) {
  console.log(\`\\x1b[33m⏳ [Port \${tunnel.port}] Requesting tunnel for \${tunnel.domain}...\\x1b[0m\`);
  
  if (tunnel.status === 'REJECTED') {
    console.log(\`\\x1b[31m❌ [Port \${tunnel.port}] Rejected by Admin Policy. (Not Live)\\x1b[0m\`);
    return;
  }

  // Connect WebSocket to Edge
  const ws = new WebSocket(config.edgeWsUrl, {
    headers: { host: tunnel.domain }
  });

  ws.on('open', () => {
    ws.send(JSON.stringify({
      type: 'AUTH_REQ',
      apiKey: config.apiKey,
      timestamp: Date.now()
    }));

    setTimeout(() => {
      ws.send(JSON.stringify({
        type: 'TUNNEL_REGISTER_REQ',
        subdomain: tunnel.subdomain,
        customDomain: tunnel.domain,
        localTargetPort: tunnel.port,
        localTargetHost: 'localhost',
        timestamp: Date.now()
      }));
    }, 300);
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'TUNNEL_REGISTER_ACK') {
        console.log(\`\\x1b[32m✔ [Port \${tunnel.port}] LIVE: https://\${tunnel.domain} -> http://localhost:\${tunnel.port}\\x1b[0m\`);
      }
    } catch(e) {}
  });

  ws.on('close', () => {
    setTimeout(() => startTunnel(tunnel), 5000);
  });
}

for (const tunnel of config.tunnels) {
  startTunnel(tunnel);
}

console.log('\\x1b[32m%s\\x1b[0m', '\\n🚀 Agent is actively maintaining tunnels in the background. Press Ctrl+C to stop.\\n');
`;

      const readmeContent = `TURNAL MULTI-PORT AGENT INSTRUCTIONS
========================================

1. HOW TO RUN:
   - Double-click 'run-agent.bat' to start all your local project tunnels.
   - CMD will open and show the live status of all configured ports.

2. AUTO-START ON PC REBOOT / POWER LOSS:
   - Double-click 'install-autostart.bat'.
   - When your PC turns on or restarts, Turnal will automatically run in the background.

3. APPROVAL & SSL:
   - If a port is marked 'Waiting for Admin Approval', once the admin approves it in the Admin Dashboard, it will become LIVE automatically without needing a restart!
`;

      const { generateZip } = await import('../lib/zip-generator');
      const blob = generateZip([
        { name: 'run-agent.bat', content: runAgentBat },
        { name: 'install-autostart.bat', content: installAutostartBat },
        { name: 'uninstall-autostart.bat', content: uninstallAutostartBat },
        { name: 'config.json', content: configFileContent },
        { name: 'cli.mjs', content: cliMjsContent },
        { name: 'README.txt', content: readmeContent }
      ]);

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'turnal-agent-bundle.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setFeedback({
        type: 'success',
        text: 'Agent ZIP downloaded successfully! Unzip and run "install-autostart.bat" for auto-boot.'
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to create ZIP bundle' });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm relative overflow-hidden">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-sky-50 border border-sky-200 text-sky-600">
              <Zap className="w-5 h-5" />
            </span>
            <h3 className="text-xl font-bold text-slate-900">Multi-Port Tunnel & Domain Setup</h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure multiple local ports (e.g. 5 projects) with individual domains, download your ready-to-run agent ZIP, and recover automatically on system reboot.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshTunnels}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
            title="Refresh Tunnels"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-semibold text-emerald-700">Turnal Gateway Online</span>
          </div>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs font-bold opacity-60 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Step 1 & 2 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Step 1: Run Local Server */}
        <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-5 space-y-3 relative group hover:border-sky-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold px-2.5 py-1 rounded-md bg-sky-100 text-sky-700 border border-sky-200">
              STEP 1
            </span>
            <Laptop className="w-4 h-4 text-slate-400" />
          </div>
          <h4 className="text-sm font-bold text-slate-900">Run Local Applications</h4>
          <p className="text-xs text-slate-500">
            Keep your local projects running on your PC (e.g. Next.js, Django, FastAPI, Express on ports <code className="text-sky-700 font-bold">3001, 3002, 5000</code>).
          </p>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 font-mono text-[11px] text-slate-200 space-y-1">
            <div className="text-emerald-400 font-semibold">✔ Local Network Detected:</div>
            <div className="text-slate-300">- Ports Configured: <span className="text-sky-300 font-bold">{portMappings.map(p => p.port).join(', ')}</span></div>
            <div className="text-slate-400">- Target Host: http://localhost</div>
          </div>
        </div>

        {/* Step 2: System Boot Persistence */}
        <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-5 space-y-3 relative group hover:border-indigo-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold px-2.5 py-1 rounded-md bg-indigo-100 text-indigo-700 border border-indigo-200">
              STEP 2
            </span>
            <Power className="w-4 h-4 text-slate-400" />
          </div>
          <h4 className="text-sm font-bold text-slate-900">Auto-Recovery on PC Reboot</h4>
          <p className="text-xs text-slate-500">
            If power goes out or Windows restarts, the pre-bundled <code className="text-indigo-700 font-bold">install-autostart.bat</code> automatically resumes all approved tunnels!
          </p>
          <div className="bg-indigo-950/40 border border-indigo-800/40 rounded-xl p-3 text-[11px] text-indigo-200 space-y-1">
            <div className="text-indigo-300 font-semibold">⚡ Power Loss Protection:</div>
            <div className="text-slate-300">- Tunnels stay alive continuously until manually stopped</div>
          </div>
        </div>
      </div>

      {/* Multi-Port Configuration Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Target Ports & Custom Domain Mappings</h4>
            <p className="text-xs text-slate-500">Map each local port to its corresponding public domain or subdomain.</p>
          </div>
          <button
            onClick={addPortRow}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Another Port
          </button>
        </div>

        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700 uppercase">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">Service Name</th>
                <th className="p-3">Local Port</th>
                <th className="p-3">Subdomain</th>
                <th className="p-3">Full Target Domain</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {portMappings.map((row, idx) => {
                const isOnline = row.status === 'ONLINE';
                const isPending = row.status === 'PENDING_APPROVAL' || row.status === 'OFFLINE' || !row.status;
                const isRejected = row.status === 'REJECTED';

                return (
                  <tr key={row.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                    <td className="p-3">
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => updatePortRow(idx, 'name', e.target.value)}
                        placeholder="Service Name"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium focus:ring-1 focus:ring-sky-500 bg-white"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="number"
                        value={row.port}
                        onChange={(e) => updatePortRow(idx, 'port', e.target.value)}
                        placeholder="3000"
                        className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-200 font-mono text-xs font-bold focus:ring-1 focus:ring-sky-500 bg-white"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        value={row.subdomain}
                        onChange={(e) => updatePortRow(idx, 'subdomain', e.target.value)}
                        placeholder="subdomain"
                        className="w-28 px-2.5 py-1.5 rounded-lg border border-slate-200 font-mono text-xs focus:ring-1 focus:ring-sky-500 bg-white"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        value={row.customDomain}
                        onChange={(e) => updatePortRow(idx, 'customDomain', e.target.value)}
                        placeholder="app.skyranksolution.com"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 font-mono text-xs text-sky-700 font-medium focus:ring-1 focus:ring-sky-500 bg-white"
                      />
                    </td>
                    <td className="p-3">
                      {isOnline && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Online
                        </span>
                      )}
                      {isPending && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold">
                          <Clock className="w-3 h-3 text-amber-600" />
                          Pending Approval
                        </span>
                      )}
                      {isRejected && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          Rejected
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => removePortRow(idx)}
                        disabled={portMappings.length <= 1}
                        className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 disabled:opacity-30 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <button
            onClick={handleSubmitAll}
            disabled={saving}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition shadow-sm"
          >
            <Zap className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
            {saving ? 'Submitting Requests...' : 'Submit Port Configurations for Approval'}
          </button>

          <button
            onClick={handleDownloadZip}
            disabled={downloading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm"
          >
            <Download className={`w-4 h-4 ${downloading ? 'animate-bounce' : ''}`} />
            {downloading ? 'Generating ZIP...' : 'Download Configured Agent ZIP'}
          </button>
        </div>
      </div>

      {/* DNS Setup Suggestion Box */}
      <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
          <Info className="w-4 h-4 text-amber-600" />
          DNS SETUP SUGGESTION FOR CUSTOM DOMAINS
        </div>
        <p className="text-xs text-amber-800 leading-relaxed">
          To point your custom domains to Turnal, add this <strong>A Record</strong> in your DNS provider (Hostinger, Cloudflare, GoDaddy):
        </p>
        <div className="border border-amber-200 rounded-xl overflow-hidden bg-white/80">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-amber-100/50 text-[11px] text-amber-900 font-bold border-b border-amber-200">
              <tr>
                <th className="p-2.5">TYPE</th>
                <th className="p-2.5">NAME / HOST</th>
                <th className="p-2.5">POINTS TO (VALUE)</th>
                <th className="p-2.5">RECOMMENDED TTL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100">
              <tr>
                <td className="p-2.5 font-bold text-amber-900">A</td>
                <td className="p-2.5 text-sky-800 font-bold">@ / app / api / *</td>
                <td className="p-2.5 font-bold text-purple-700">13.62.54.247</td>
                <td className="p-2.5 text-slate-600">300 (5 mins)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
