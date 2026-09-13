#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import readline from 'node:readline/promises';
import { ConfigStore } from './config-store.js';
import { TunnelClient } from './tunnel-client.js';
import { config } from '@turnal/config';

const program = new Command();

program
  .name('turnal')
  .description('Turnal CLI - Secure Local-to-Public Tunneling Agent')
  .version('1.0.0');

// 1. LOGIN COMMAND
program
  .command('login')
  .description('Authenticate your agent with Turnal platform')
  .option('-e, --email <email>', 'Account email')
  .option('-k, --api-key <apiKey>', 'Authenticate via API Key directly')
  .option('--api-url <url>', 'Override API Server URL')
  .action(async (options) => {
    const apiUrl = options.apiUrl || config.api.url;

    if (options.apiKey) {
      ConfigStore.save({ apiKey: options.apiKey, apiUrl });
      console.log(chalk.green('✔ Successfully authenticated with API Key!'));
      return;
    }

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    try {
      const email = options.email || (await rl.question(chalk.cyan('Email: ')));
      const password = await rl.question(chalk.cyan('Password: '));

      console.log(chalk.gray('\nAuthenticating with Turnal...'));

      const res = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Host': 'app.skyranksolution.com'
        },
        body: JSON.stringify({ email: email.trim(), password })
      });

      const data: any = await res.json();

      if (!res.ok || !data.success) {
        console.error(chalk.red(`✖ Login failed: ${data.error?.message || 'Invalid credentials'}`));
        process.exit(1);
      }

      ConfigStore.save({
        token: data.data.token,
        userEmail: data.data.user.email,
        userName: data.data.user.name,
        apiUrl
      });

      console.log(chalk.green(`✔ Welcome back, ${data.data.user.name}! (${data.data.user.email})`));
      console.log(chalk.gray('Your credentials have been securely stored in ~/.turnal/config.json\n'));
    } catch (err: any) {
      console.error(chalk.red(`✖ Error connecting to API: ${err.message}`));
    } finally {
      rl.close();
    }
  });

// 2. LOGOUT COMMAND
program
  .command('logout')
  .description('Log out and clear stored credentials')
  .action(() => {
    ConfigStore.clear();
    console.log(chalk.green('✔ Successfully logged out of Turnal.'));
  });

// 3. STATUS COMMAND
program
  .command('status')
  .description('Check current agent authentication state')
  .action(() => {
    const creds = ConfigStore.load();
    if (!creds.token && !creds.apiKey) {
      console.log(chalk.yellow('Not logged in. Run: turnal login'));
      return;
    }

    console.log(chalk.bold('\nTurnal Agent Status:'));
    console.log(`  User:      ${chalk.cyan(creds.userName || 'API Key User')}`);
    console.log(`  Email:     ${chalk.cyan(creds.userEmail || 'N/A')}`);
    console.log(`  API URL:   ${chalk.gray(creds.apiUrl || config.api.url)}`);
    console.log(`  Auth Mode: ${chalk.green(creds.apiKey ? 'API Key' : 'Session Token')}\n`);
  });

// 4. TUNNEL COMMAND (Expose Local Port)
program
  .command('tunnel')
  .description('Start a secure tunnel to expose a local port to the internet')
  .option('-p, --port <port>', 'Local port to expose (e.g. 3000)', '3000')
  .option('-s, --subdomain <subdomain>', 'Requested custom subdomain')
  .option('-d, --domain <domain>', 'Configured custom domain')
  .option('-k, --api-key <apiKey>', 'Authenticate via API Key directly')
  .option('-t, --token <token>', 'Authenticate via Session Token')
  .option('-n, --name <name>', 'Project / Tunnel name')
  .option('--host <host>', 'Local target host', 'localhost')
  .option('--edge-ws <url>', 'Edge WebSocket URL override')
  .action(async (options) => {
    const creds = ConfigStore.load();
    const token = options.token || creds.token;
    const apiKey = options.apiKey || creds.apiKey;

    if (!token && !apiKey) {
      console.log(chalk.red('✖ Authentication required. Pass --api-key <key> or run: turnal login'));
      process.exit(1);
    }

    const port = parseInt(options.port, 10);
    const edgeWsUrl = options.edgeWs || options.edgeWsUrl || process.env.TURNAL_EDGE_WS_URL || `ws://${config.edge.host === '0.0.0.0' ? '127.0.0.1' : config.edge.host}:${config.edge.port}${config.edge.wsPath}`;

    console.log(chalk.bold.cyan('\n  ████████╗██╗   ██╗██████╗ ███╗   ██╗ █████╗ ██╗     '));
    console.log(chalk.bold.cyan('  ╚══██╔══╝██║   ██║██╔══██╗████╗  ██║██╔══██╗██║     '));
    console.log(chalk.bold.cyan('     ██║   ██║   ██║██████╔╝██╔██╗ ██║███████║██║     '));
    console.log(chalk.bold.cyan('     ██║   ██║   ██║██╔══██╗██║╚██╗██║██╔══██║██║     '));
    console.log(chalk.bold.cyan('     ██║   ╚██████╔╝██║  ██║██║ ╚████║██║  ██║███████╗'));
    console.log(chalk.bold.cyan('     ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝\n'));

    let reqSubdomain = options.subdomain;
    if (!reqSubdomain && options.domain) {
      if (options.domain.includes('.')) {
        reqSubdomain = options.domain.split('.')[0];
      }
    }

    const client = new TunnelClient({
      edgeWsUrl,
      token,
      apiKey,
      localPort: port,
      localHost: options.host,
      subdomain: reqSubdomain,
      customDomain: options.domain,
      projectName: options.name
    });

    client.on('connecting', ({ attempt }) => {
      console.log(chalk.yellow(`⏳ Connecting to Turnal Edge (attempt ${attempt})...`));
    });

    client.on('connected', () => {
      console.log(chalk.gray('✔ Connected to edge gateway. Authenticating...'));
    });

    client.on('authenticated', () => {
      console.log(chalk.green('✔ Authenticated successfully. Reserving tunnel route...'));
    });

    client.on('ready', (ack) => {
      console.log(chalk.bold.green('\n🎉 TUNNEL IS ONLINE!'));
      console.log('───────────────────────────────────────────────────────');
      if (ack.customDomain) {
        console.log(`  ${chalk.bold('Forwarding:')}  ${chalk.cyan(`http://${ack.customDomain}`)} ${chalk.gray('→')} ${chalk.yellow(`http://${ack.localTarget}`)}`);
        console.log(`  ${chalk.bold('Turnal URL:')}  ${chalk.gray(ack.publicUrl)}`);
      } else {
        console.log(`  ${chalk.bold('Forwarding:')}  ${chalk.cyan(ack.publicUrl)} ${chalk.gray('→')} ${chalk.yellow(`http://${ack.localTarget}`)}`);
      }
      console.log(`  ${chalk.bold('Tunnel ID:')}   ${chalk.gray(ack.tunnelId)}`);
      console.log(`  ${chalk.bold('Status:')}      ${chalk.bgGreen.black(' LIVE ')}`);
      console.log('───────────────────────────────────────────────────────');
      console.log(chalk.gray('\nPress Ctrl+C to close the tunnel.\n'));
    });

    client.on('request', ({ method, path }) => {
      const time = new Date().toLocaleTimeString();
      console.log(`  ${chalk.gray(time)} ${chalk.bold.blue(method)} ${chalk.white(path)}`);
    });

    client.on('disconnected', ({ reason }) => {
      console.log(chalk.red(`\n✖ Connection lost: ${reason}`));
    });

    client.on('reconnecting', ({ delayMs, attempt }) => {
      console.log(chalk.yellow(`⏳ Reconnecting in ${delayMs / 1000}s (attempt ${attempt})...`));
    });

    client.on('error', (err) => {
      console.error(chalk.red(`\n✖ Tunnel error: ${err.message}`));
    });

    const shutdown = () => {
      console.log(chalk.yellow('\n\nClosing tunnel and shutting down agent...'));
      client.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    await client.start();
  });

// 5. RUN-CONFIG COMMAND (Multi-Port Tunnel Runner from config.json)
program
  .command('run-config')
  .description('Run all configured tunnels from config.json concurrently')
  .option('-c, --config <path>', 'Path to config.json', 'config.json')
  .action(async (options) => {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const configPath = path.resolve(process.cwd(), options.config);
    if (!fs.existsSync(configPath)) {
      console.error(chalk.red(`✖ Config file not found at: ${configPath}`));
      process.exit(1);
    }

    const fileContent = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const apiKey = fileContent.apiKey;
    const tunnels = fileContent.tunnels || [];
    const edgeWsUrl = fileContent.edgeWsUrl || `ws://${config.edge.host === '0.0.0.0' ? '127.0.0.1' : config.edge.host}:${config.edge.port}${config.edge.wsPath}`;

    console.log(chalk.bold.cyan('\n  ████████╗██╗   ██╗██████╗ ███╗   ██╗ █████╗ ██╗     '));
    console.log(chalk.bold.cyan('  ╚══██╔══╝██║   ██║██╔══██╗████╗  ██║██╔══██╗██║     '));
    console.log(chalk.bold.cyan('     ██║   ██║   ██║██████╔╝██╔██╗ ██║███████║██║     '));
    console.log(chalk.bold.cyan('     ██║   ██║   ██║██╔══██╗██║╚██╗██║██╔══██║██║     '));
    console.log(chalk.bold.cyan('     ██║   ╚██████╔╝██║  ██║██║ ╚████║██║  ██║███████╗'));
    console.log(chalk.bold.cyan('     ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝\n'));

    console.log(chalk.bold(`🌐 User: ${chalk.cyan(fileContent.user?.name || 'Turnal Developer')} (${fileContent.user?.email || 'N/A'})`));
    console.log(chalk.bold(`📡 Edge Gateway: ${chalk.gray(edgeWsUrl)}`));
    console.log(chalk.bold(`⚡ Active Port Configurations: ${chalk.yellow(tunnels.length)}\n`));

    const activeClients: any[] = [];

    for (const t of tunnels) {
      const port = t.port || t.localTargetPort;
      const targetDomain = t.domain || t.customDomain || `${t.subdomain}.skyranksolution.com`;
      const client = new TunnelClient({
        edgeWsUrl,
        apiKey,
        localPort: port,
        localHost: 'localhost',
        subdomain: t.subdomain,
        customDomain: targetDomain,
        projectName: t.name
      });

      client.on('connecting', () => {
        console.log(chalk.yellow(`⏳ [Port ${port}] Connecting for ${targetDomain}...`));
      });

      client.on('ready', (ack) => {
        console.log(chalk.green(`✔ [Port ${port}] LIVE: https://${targetDomain} -> http://localhost:${port}`));
      });

      client.on('error', (err) => {
        console.log(chalk.red(`✖ [Port ${port}] Error: ${err.message}`));
      });

      activeClients.push(client);
      client.start().catch((e) => console.error(e));
    }

    console.log(chalk.gray('\nPress Ctrl+C to close all tunnels.\n'));

    const shutdown = () => {
      console.log(chalk.yellow('\nStopping all port tunnels...'));
      activeClients.forEach(c => c.stop());
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });

program.parse(process.argv);

