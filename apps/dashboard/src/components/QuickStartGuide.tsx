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

export function QuickStartGuide({ apiKey = 'trk_live_43021d2c8ab8a30c79ed6402964cbb3d1ed62d86464df1b9', defaultPort = '3000' }: QuickStartGuideProps) {
  // Clean single example row initially; user can dynamically add as many as they want
  const [portMappings, setPortMappings] = useState<PortMapping[]>([
    { id: '1', name: 'My Web App', port: defaultPort || '3000', subdomain: 'app', customDomain: 'app.skyranksolution.com', status: 'PENDING_APPROVAL' },
  ]);

  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Load existing user tunnels from API if any exist
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
    const nextPortNum = 3000 + portMappings.length;
    const nextPort = String(nextPortNum);
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
    if (field === 'subdomain' && (!updated[index].customDomain || updated[index].customDomain.endsWith('.skyranksolution.com'))) {
      updated[index].customDomain = `${value.trim()}.skyranksolution.com`;
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
          text: `Successfully submitted ${items.length} port tunnel requests for Admin approval!`
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

  // Download pre-configured agent ZIP generated dynamically from current rows
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
echo [3/3] Checking Admin Approval and SSL status...
echo.

:loop
node --no-warnings cli.mjs
echo.
echo [INFO] Agent disconnected or restarting. Reconnecting in 5 seconds...
timeout /t 5 /nobreak >nul
goto loop
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

      const cliMjsContent = `// Turnal Standalone Multi-Port CLI Agent Runner (Zero dependencies required)
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

console.log('\\x1b[36m%s\\x1b[0m', '========================================================');
console.log('\\x1b[36m%s\\x1b[0m', '      TURNAL MULTI-PORT AGENT (STANDALONE RUNNER)');
console.log('\\x1b[36m%s\\x1b[0m', '========================================================\\n');

const configPath = path.join(process.cwd(), 'config.json');
if (!fs.existsSync(configPath)) {
  console.error('\\x1b[31m[ERROR] config.json not found!\\x1b[0m');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
console.log(\`Loaded \${config.tunnels.length} configured local port mappings:\\n\`);

const WS = typeof WebSocket !== 'undefined' ? WebSocket : globalThis.WebSocket;
if (!WS) {
  console.error('\\x1b[31m[ERROR] Native WebSocket not available. Please ensure you are running Node.js 21 or higher.\\x1b[0m');
  process.exit(1);
}

function createTunnelConnection(tunnel) {
  console.log(\`\\x1b[33m⏳ [Port \${tunnel.port}] Connecting tunnel for \${tunnel.domain}...\\x1b[0m\`);

  let ws;
  const activeRequests = new Map();

  try {
    ws = new WS(config.edgeWsUrl, {
      headers: { host: tunnel.domain }
    });
  } catch (err) {
    console.error(\`\\x1b[31m[Port \${tunnel.port}] Connection error: \${err.message}\\x1b[0m\`);
    setTimeout(() => createTunnelConnection(tunnel), 5000);
    return;
  }

  const send = (msg) => {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(msg));
    }
  };

  ws.addEventListener('open', () => {
    // 1. Send AUTH_REQ
    send({
      type: 'AUTH_REQ',
      apiKey: config.apiKey,
      agentVersion: '1.0.0',
      platform: process.platform,
      deviceName: process.env.COMPUTERNAME || process.env.HOSTNAME || 'agent-device',
      timestamp: Date.now()
    });
  });

  ws.addEventListener('message', (event) => {
    try {
      const msg = JSON.parse(event.data.toString());

      if (msg.type === 'AUTH_ACK') {
        // 2. Authenticated -> Send TUNNEL_REGISTER_REQ
        send({
          type: 'TUNNEL_REGISTER_REQ',
          projectName: tunnel.name,
          subdomain: tunnel.subdomain,
          customDomain: tunnel.domain,
          localTargetPort: tunnel.port,
          localTargetHost: 'localhost',
          protocol: 'http',
          timestamp: Date.now()
        });
      } else if (msg.type === 'TUNNEL_REGISTER_ACK') {
        console.log(\`\\x1b[32m✔ [Port \${tunnel.port}] LIVE & ONLINE: https://\${tunnel.domain} -> http://localhost:\${tunnel.port}\\x1b[0m\`);
      } else if (msg.type === 'TUNNEL_REGISTER_FAIL') {
        console.log(\`\\x1b[31m❌ [Port \${tunnel.port}] Registration issue: \${msg.reason || 'Pending Admin Approval'}\\x1b[0m\`);
      } else if (msg.type === 'HEARTBEAT_PING') {
        // Reply to keep-alive heartbeat
        send({
          type: 'HEARTBEAT_PONG',
          sequence: msg.sequence,
          timestamp: Date.now()
        });
      } else if (msg.type === 'HTTP_REQUEST_START') {
        const startTime = Date.now();
        const reqOptions = {
          hostname: '127.0.0.1',
          port: tunnel.port,
          path: msg.path || '/',
          method: msg.method || 'GET',
          headers: {
            ...(msg.headers || {}),
            host: \`localhost:\${tunnel.port}\`
          }
        };

        const localReq = http.request(reqOptions, (localRes) => {
          let bytesSent = 0;

          send({
            type: 'HTTP_RESPONSE_START',
            requestId: msg.requestId,
            statusCode: localRes.statusCode || 200,
            statusMessage: localRes.statusMessage,
            headers: localRes.headers,
            timestamp: Date.now()
          });

          localRes.on('data', (chunk) => {
            bytesSent += chunk.length;
            send({
              type: 'HTTP_RESPONSE_CHUNK',
              requestId: msg.requestId,
              chunk: chunk.toString('base64'),
              isBinary: true,
              timestamp: Date.now()
            });
          });

          localRes.on('end', () => {
            activeRequests.delete(msg.requestId);
            send({
              type: 'HTTP_RESPONSE_END',
              requestId: msg.requestId,
              durationMs: Date.now() - startTime,
              bytesSent,
              timestamp: Date.now()
            });
          });
        });

        localReq.on('error', (err) => {
          activeRequests.delete(msg.requestId);
          send({
            type: 'ERROR',
            requestId: msg.requestId,
            code: 'LOCAL_CONNECTION_REFUSED',
            message: \`Failed to connect to local application at http://localhost:\${tunnel.port} (\${err.message})\`,
            timestamp: Date.now()
          });
        });

        activeRequests.set(msg.requestId, localReq);
      } else if (msg.type === 'HTTP_REQUEST_CHUNK') {
        const req = activeRequests.get(msg.requestId);
        if (req && !req.destroyed) {
          const buf = Buffer.from(msg.chunk, 'base64');
          req.write(buf);
        }
      } else if (msg.type === 'HTTP_REQUEST_END') {
        const req = activeRequests.get(msg.requestId);
        if (req && !req.destroyed) {
          req.end();
        }
      }
    } catch (e) {
      console.error('[Error processing wire frame]:', e.message);
    }
  });

  ws.addEventListener('close', () => {
    console.log(\`\\x1b[33m[Port \${tunnel.port}] Disconnected from server. Reconnecting in 5 seconds...\\x1b[0m\`);
    setTimeout(() => createTunnelConnection(tunnel), 5000);
  });

  ws.addEventListener('error', () => {
    // ws close will trigger reconnect
  });
}

for (const tunnel of config.tunnels) {
  createTunnelConnection(tunnel);
}

console.log('\\x1b[32m%s\\x1b[0m', '\\n🚀 Agent is maintaining persistent connections in background. Press Ctrl+C to stop.\\n');
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
        text: `Agent ZIP generated with ${portMappings.length} ports! Unzip & run install-autostart.bat.`
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to create ZIP bundle' });
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyText = (text: string, key: string) => {
    copyToClipboard(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
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
            Add any number of local ports (e.g. 3001, 3002, 5000), configure custom domains, download your auto-starting agent ZIP, and see your exact DNS settings.
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
            Keep your local projects running on your PC (e.g. Next.js, Django, FastAPI, Express on your configured ports).
          </p>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 font-mono text-[11px] text-slate-200 space-y-1">
            <div className="text-emerald-400 font-semibold">✔ Local Ports Configured ({portMappings.length}):</div>
            <div className="text-slate-300">- Ports: <span className="text-sky-300 font-bold">{portMappings.map(p => p.port).join(', ')}</span></div>
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
            <p className="text-xs text-slate-500">Add, edit, or remove your local ports. Map each port to a public domain.</p>
          </div>
          <button
            onClick={addPortRow}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
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
                        placeholder="e.g. My Next.js Frontend"
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
                        placeholder="app"
                        className="w-28 px-2.5 py-1.5 rounded-lg border border-slate-200 font-mono text-xs focus:ring-1 focus:ring-sky-500 bg-white"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        value={row.customDomain}
                        onChange={(e) => updatePortRow(idx, 'customDomain', e.target.value)}
                        placeholder="app.skyranksolution.com or mydomain.com"
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
                        title="Remove Port"
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
            {downloading ? 'Generating ZIP...' : `Download Configured Agent ZIP (${portMappings.length} Ports)`}
          </button>
        </div>
      </div>

      {/* Dynamic DNS Setup Suggestion Box Based on User Added Domains */}
      <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            DNS SETUP SUGGESTIONS FOR YOUR CONFIGURED DOMAINS
          </div>
          <span className="text-[11px] text-amber-800 font-medium">
            Add these DNS A-Records at Hostinger, Cloudflare, or GoDaddy
          </span>
        </div>

        <p className="text-xs text-amber-800 leading-relaxed">
          For your configured custom domains/subdomains to reach your local PC via Turnal, add the following <strong>A Records</strong> in your domain registrar DNS management panel:
        </p>

        <div className="border border-amber-200 rounded-xl overflow-hidden bg-white shadow-xs">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-amber-100/60 text-[11px] text-amber-950 font-bold border-b border-amber-200">
              <tr>
                <th className="p-3">YOUR SERVICE</th>
                <th className="p-3">RECORD TYPE</th>
                <th className="p-3">HOST / NAME</th>
                <th className="p-3">POINTS TO (SERVER IP)</th>
                <th className="p-3">TTL</th>
                <th className="p-3 text-right">COPY</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100 text-slate-700">
              {portMappings.map((p, idx) => {
                const domain = p.customDomain || `${p.subdomain}.skyranksolution.com`;
                const hostName = p.subdomain || '@';

                return (
                  <tr key={p.id} className="hover:bg-amber-50/40 transition">
                    <td className="p-3 font-sans font-semibold text-slate-900">
                      {p.name} <span className="text-xs font-mono text-sky-700 font-bold">(Port {p.port})</span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[11px]">
                        A
                      </span>
                    </td>
                    <td className="p-3 text-sky-800 font-bold">{hostName}</td>
                    <td className="p-3 font-bold text-purple-700">13.62.54.247</td>
                    <td className="p-3 text-slate-500">300 (5 mins)</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleCopyText(`A Record: Name=${hostName}, Value=13.62.54.247`, `dns-${idx}`)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100/80 hover:bg-amber-200 text-amber-900 text-[11px] font-sans font-semibold transition"
                      >
                        {copiedKey === `dns-${idx}` ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-amber-700" />
                            Copy Record
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
