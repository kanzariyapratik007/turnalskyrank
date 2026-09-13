import { Router, Response } from 'express';
import crypto from 'node:crypto';
import { prisma } from '../../db.js';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import { config } from '@turnal/config';
import { TunnelStatus } from '@turnal/shared';
import { createZipBuffer } from './zip-helper.js';

export const tunnelRouter = Router();

function generateRandomSubdomain(): string {
  const hex = crypto.randomBytes(4).toString('hex');
  return `tun-${hex}`;
}

// GET / - List all user tunnels
tunnelRouter.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tunnels = await prisma.tunnel.findMany({
      where: { userId: req.user!.id },
      include: {
        project: { select: { id: true, name: true, slug: true } },
        connectedDevice: { select: { id: true, name: true, platform: true } },
        domains: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = tunnels.map(t => ({
      id: t.id,
      name: t.name,
      subdomain: t.subdomain,
      publicUrl: `${config.publicProtocol}://${t.subdomain}.${config.baseDomain}${config.edge.port !== 80 && config.edge.port !== 443 ? `:${config.edge.port}` : ''}`,
      customDomain: t.customDomain ? `${config.publicProtocol}://${t.customDomain}` : undefined,
      status: t.status,
      localTargetPort: t.localTargetPort,
      localTargetHost: t.localTargetHost,
      protocol: t.protocol,
      connectedDeviceId: t.connectedDeviceId,
      connectedDeviceName: t.connectedDevice?.name,
      createdAt: t.createdAt.toISOString(),
      lastHeartbeatAt: t.lastHeartbeatAt?.toISOString(),
      totalRequests: t.totalRequests,
      totalBytes: Number(t.totalBytes),
      approvedAt: (t as any).approvedAt,
      rejectionReason: (t as any).rejectionReason
    }));

    res.json({ success: true, data: formatted });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

// POST /batch - Register multiple port & domain mappings at once
tunnelRouter.post('/batch', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { items, projectId } = req.body as {
      items: Array<{
        name?: string;
        subdomain?: string;
        customDomain?: string;
        localTargetPort: number;
        localTargetHost?: string;
        protocol?: string;
      }>;
      projectId?: string;
    };

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, error: { code: 'INVALID_ITEMS', message: 'items array is required' } });
      return;
    }

    const createdTunnels = [];

    for (const item of items) {
      const chosenSub = (item.subdomain || generateRandomSubdomain()).toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
      const customDom = item.customDomain ? item.customDomain.toLowerCase().trim() : null;

      // Check if subdomain already registered for another tunnel
      const existing = await prisma.tunnel.findUnique({ where: { subdomain: chosenSub } });
      const finalSub = existing ? `${chosenSub}-${crypto.randomBytes(2).toString('hex')}` : chosenSub;

      const tunnel = await prisma.tunnel.create({
        data: {
          name: item.name || `Port ${item.localTargetPort} Tunnel`,
          subdomain: finalSub,
          customDomain: customDom,
          localTargetPort: parseInt(String(item.localTargetPort), 10) || 3000,
          localTargetHost: item.localTargetHost ? item.localTargetHost.trim() : 'localhost',
          protocol: item.protocol || 'http',
          status: TunnelStatus.PENDING_APPROVAL, // Default to pending approval
          userId: req.user!.id,
          projectId: projectId || null
        }
      });

      createdTunnels.push({
        id: tunnel.id,
        name: tunnel.name,
        subdomain: tunnel.subdomain,
        customDomain: tunnel.customDomain,
        localTargetPort: tunnel.localTargetPort,
        status: tunnel.status,
        publicUrl: `${config.publicProtocol}://${tunnel.subdomain}.${config.baseDomain}${config.edge.port !== 80 && config.edge.port !== 443 ? `:${config.edge.port}` : ''}`
      });
    }

    res.status(201).json({
      success: true,
      message: `Registered ${createdTunnels.length} tunnel requests successfully. Pending Admin approval.`,
      data: createdTunnels
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

// POST / - Single tunnel registration
tunnelRouter.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, subdomain, customDomain, localTargetPort = 3000, localTargetHost = 'localhost', protocol = 'http', projectId } = req.body;

    const chosenSubdomain = (subdomain || generateRandomSubdomain()).toLowerCase().trim().replace(/[^a-z0-9-]/g, '');

    if (chosenSubdomain.length < 3) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_SUBDOMAIN', message: 'Subdomain must be at least 3 characters alphanumeric' }
      });
      return;
    }

    const existingSubdomain = await prisma.tunnel.findUnique({
      where: { subdomain: chosenSubdomain }
    });

    if (existingSubdomain) {
      res.status(409).json({
        success: false,
        error: { code: 'SUBDOMAIN_TAKEN', message: `Subdomain '${chosenSubdomain}' is already in use` }
      });
      return;
    }

    const tunnel = await prisma.tunnel.create({
      data: {
        name: name || chosenSubdomain,
        subdomain: chosenSubdomain,
        customDomain: customDomain ? customDomain.toLowerCase().trim() : null,
        localTargetPort: parseInt(localTargetPort, 10),
        localTargetHost: localTargetHost.trim(),
        protocol,
        status: TunnelStatus.PENDING_APPROVAL,
        userId: req.user!.id,
        projectId: projectId || null
      }
    });

    res.status(201).json({
      success: true,
      data: {
        id: tunnel.id,
        name: tunnel.name,
        subdomain: tunnel.subdomain,
        publicUrl: `${config.publicProtocol}://${tunnel.subdomain}.${config.baseDomain}${config.edge.port !== 80 && config.edge.port !== 443 ? `:${config.edge.port}` : ''}`,
        status: tunnel.status,
        localTargetPort: tunnel.localTargetPort,
        localTargetHost: tunnel.localTargetHost,
        protocol: tunnel.protocol
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

// GET /bundle/download - Generate and download pre-configured ZIP bundle
tunnelRouter.get('/bundle/download', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userTunnels = await prisma.tunnel.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' }
    });

    const userApiKeys = await prisma.apiKey.findMany({
      where: { userId: req.user!.id }
    });

    const activeApiKey = userApiKeys.length > 0 ? userApiKeys[0].key : 'trk_live_43021d2c8ab8a30c79ed6402964cbb3d1ed62d86464df1b9';

    const tunnelConfigs = userTunnels.map(t => ({
      id: t.id,
      name: t.name,
      port: t.localTargetPort,
      subdomain: t.subdomain,
      domain: t.customDomain || `${t.subdomain}.${config.baseDomain}`,
      status: t.status
    }));

    const configFileContent = JSON.stringify({
      version: '1.0.0',
      user: {
        id: req.user!.id,
        email: req.user!.email,
        name: (req.user as any)?.name || 'Turnal Developer'
      },
      apiKey: activeApiKey,
      apiUrl: config.api.url || 'http://13.62.54.247:4000',
      edgeWsUrl: `ws://${config.edge.host === '0.0.0.0' ? '13.62.54.247' : config.edge.host}:${config.edge.port}${config.edge.wsPath}`,
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
echo [2/3] Connecting to Turnal Edge Server...
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
import { WebSocket } from 'ws';

console.log('\\x1b[36m%s\\x1b[0m', '🌐 TURNAL MULTI-PORT AGENT RUNNER');

const configPath = path.join(process.cwd(), 'config.json');
if (!fs.existsSync(configPath)) {
  console.error('\\x1b[31m[ERROR] config.json not found!\\x1b[0m');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
console.log(\`Logged in as: \${config.user.name} (\${config.user.email})\`);
console.log(\`Loaded \${config.tunnels.length} mapped local ports.\\n\`);

async function checkAndSyncTunnels() {
  try {
    const res = await fetch(\`\${config.apiUrl}/api/tunnels\`, {
      headers: { 'Authorization': \`Bearer \${config.apiKey}\` }
    });
    if (res.ok) {
      const body = await res.json();
      return body.data;
    }
  } catch (err) {}
  return config.tunnels;
}

async function startTunnel(tunnel) {
  console.log(\`\\x1b[33m⏳ [Port \${tunnel.port}] Requesting tunnel for \${tunnel.domain}...\\x1b[0m\`);
  
  if (tunnel.status === 'REJECTED') {
    console.log(\`\\x1b[31m❌ [Port \${tunnel.port}] Rejected by Admin Policy. (Not Live)\\x1b[0m\`);
    return;
  }
  
  if (tunnel.status === 'PENDING_APPROVAL') {
    console.log(\`\\x1b[33m⏳ [Port \${tunnel.port}] Waiting for Admin Approval...\\x1b[0m\`);
  }

  // Connect WebSocket to Edge
  const ws = new WebSocket(config.edgeWsUrl, {
    headers: { host: tunnel.domain }
  });

  ws.on('open', () => {
    // Send Auth
    ws.send(JSON.stringify({
      type: 'AUTH_REQ',
      apiKey: config.apiKey,
      timestamp: Date.now()
    }));

    // Register Tunnel
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

    const zipBuffer = await createZipBuffer([
      { name: 'run-agent.bat', content: runAgentBat },
      { name: 'install-autostart.bat', content: installAutostartBat },
      { name: 'uninstall-autostart.bat', content: uninstallAutostartBat },
      { name: 'config.json', content: configFileContent },
      { name: 'cli.mjs', content: cliMjsContent },
      { name: 'README.txt', content: readmeContent }
    ]);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="turnal-agent-bundle.zip"');
    res.send(zipBuffer);
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'BUNDLE_GEN_ERROR', message: error.message } });
  }
});

// GET /:id - Single tunnel details
tunnelRouter.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tunnel = await prisma.tunnel.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: {
        project: true,
        connectedDevice: true,
        domains: true,
        requestLogs: {
          take: 50,
          orderBy: { timestamp: 'desc' }
        }
      }
    });

    if (!tunnel) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tunnel not found' } });
      return;
    }

    res.json({ success: true, data: tunnel });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

// DELETE /:id - Delete a tunnel
tunnelRouter.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tunnel = await prisma.tunnel.findFirst({
      where: { id: req.params.id, userId: req.user!.id }
    });

    if (!tunnel) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tunnel not found' } });
      return;
    }

    await prisma.tunnel.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { message: 'Tunnel deleted successfully' } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

// POST /resolve-host - Host resolution for Edge server
tunnelRouter.post('/resolve-host', async (req, res): Promise<void> => {
  try {
    const { host } = req.body;
    if (!host) {
      res.status(400).json({ success: false, error: { code: 'HOST_REQUIRED', message: 'Host is required' } });
      return;
    }

    const cleanHost = host.split(':')[0].toLowerCase();
    
    let subdomainMatch: string | null = null;
    if (cleanHost.endsWith(`.${config.baseDomain}`)) {
      subdomainMatch = cleanHost.replace(`.${config.baseDomain}`, '');
    } else if (cleanHost.endsWith('.localhost')) {
      subdomainMatch = cleanHost.replace('.localhost', '');
    }

    let tunnel = null;
    if (subdomainMatch) {
      tunnel = await prisma.tunnel.findUnique({
        where: { subdomain: subdomainMatch },
        include: { user: { select: { id: true, email: true } } }
      });
    }

    if (!tunnel) {
      const domain = await prisma.domain.findUnique({
        where: { domainName: cleanHost },
        include: {
          targetTunnel: {
            include: { user: { select: { id: true, email: true } } }
          }
        }
      });
      if (domain && domain.targetTunnel) {
        tunnel = domain.targetTunnel;
      }
    }

    if (!tunnel) {
      res.status(404).json({
        success: false,
        error: { code: 'TUNNEL_NOT_FOUND', message: `No tunnel registered for host '${cleanHost}'` }
      });
      return;
    }

    res.json({
      success: true,
      data: {
        tunnelId: tunnel.id,
        subdomain: tunnel.subdomain,
        customDomain: tunnel.customDomain,
        localTargetPort: tunnel.localTargetPort,
        localTargetHost: tunnel.localTargetHost,
        protocol: tunnel.protocol,
        status: tunnel.status,
        userId: tunnel.userId
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});
