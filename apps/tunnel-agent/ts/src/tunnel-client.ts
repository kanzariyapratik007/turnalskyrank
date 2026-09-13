import { WebSocket } from 'ws';
import { EventEmitter } from 'node:events';
import { FrameCodec, MessageType, ProtocolMessage, TunnelRegisterAckMessage } from '../../../../packages/protocol/src/index.js';
import { LocalForwarder } from './local-forwarder.js';

export interface TunnelClientOptions {
  edgeWsUrl: string;
  token?: string;
  apiKey?: string;
  localPort: number;
  localHost?: string;
  subdomain?: string;
  customDomain?: string;
  projectName?: string;
}

export class TunnelClient extends EventEmitter {
  private options: TunnelClientOptions;
  private ws: WebSocket | null = null;
  private forwarder: LocalForwarder;
  private isStopping = false;
  private reconnectAttempts = 0;
  private reconnectTimer?: NodeJS.Timeout;

  public publicUrl?: string;
  public subdomain?: string;
  public tunnelId?: string;

  constructor(options: TunnelClientOptions) {
    super();
    this.options = {
      localHost: 'localhost',
      ...options
    };
    this.forwarder = new LocalForwarder(
      this.options.localPort,
      this.options.localHost,
      'http'
    );
  }

  public async start(): Promise<void> {
    this.isStopping = false;
    this.connect();
  }

  public stop(): void {
    this.isStopping = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.emit('stopped');
  }

  private connect(): void {
    if (this.isStopping) return;

    this.emit('connecting', { attempt: this.reconnectAttempts + 1, url: this.options.edgeWsUrl });

    try {
      const hostHeader = this.options.customDomain || (this.options.subdomain ? `${this.options.subdomain}.skyranksolution.com` : 'app.skyranksolution.com');
      this.ws = new WebSocket(this.options.edgeWsUrl, {
        headers: {
          'host': hostHeader
        }
      });
    } catch (err: any) {
      this.handleDisconnect(`Failed to create WebSocket: ${err.message}`);
      return;
    }

    this.ws.on('open', () => {
      this.reconnectAttempts = 0;
      this.emit('connected');
      this.sendHandshake();
    });

    this.ws.on('message', (raw) => {
      try {
        const msg = FrameCodec.decode(raw as any);
        this.handleMessage(msg);
      } catch (err) {
        console.error('[TunnelClient] Error decoding incoming frame:', err);
      }
    });

    this.ws.on('close', (code, reason) => {
      this.handleDisconnect(`Connection closed (${code}): ${reason.toString() || 'Remote server closed stream'}`);
    });

    this.ws.on('error', (err) => {
      this.handleDisconnect(`Socket error: ${err.message}`);
    });
  }

  private sendHandshake(): void {
    // 1. Send AUTH_REQ
    this.send({
      type: MessageType.AUTH_REQ,
      token: this.options.token,
      apiKey: this.options.apiKey,
      agentVersion: '1.0.0',
      platform: process.platform,
      deviceName: process.env.COMPUTERNAME || process.env.HOSTNAME || 'agent-device',
      timestamp: Date.now()
    } as any);
  }

  private send(msg: ProtocolMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(FrameCodec.encode(msg));
    }
  }

  private handleMessage(msg: ProtocolMessage): void {
    switch (msg.type) {
      case MessageType.AUTH_ACK:
        this.emit('authenticated', msg);
        // After authentication, register the tunnel!
        this.send({
          type: MessageType.TUNNEL_REGISTER_REQ,
          projectName: this.options.projectName,
          subdomain: this.options.subdomain,
          customDomain: this.options.customDomain,
          localTargetPort: this.options.localPort,
          localTargetHost: this.options.localHost,
          protocol: 'http',
          timestamp: Date.now()
        } as any);
        break;

      case MessageType.AUTH_FAIL:
        this.emit('error', new Error(`Authentication failed: ${msg.reason}`));
        this.stop();
        break;

      case MessageType.TUNNEL_REGISTER_ACK: {
        const ack = msg as TunnelRegisterAckMessage;
        this.tunnelId = ack.tunnelId;
        this.subdomain = ack.subdomain;
        this.publicUrl = ack.publicUrl;
        this.emit('ready', ack);
        break;
      }

      case MessageType.TUNNEL_REGISTER_FAIL:
        this.emit('error', new Error(`Tunnel registration failed: ${msg.reason}`));
        this.stop();
        break;

      case MessageType.HTTP_REQUEST_START:
        this.emit('request', {
          id: msg.requestId,
          method: msg.method,
          path: msg.path
        });
        this.forwarder.handleRequestStart(msg, (frame) => this.send(frame));
        break;

      case MessageType.HTTP_REQUEST_CHUNK:
        this.forwarder.handleRequestChunk(msg);
        break;

      case MessageType.HTTP_REQUEST_END:
        this.forwarder.handleRequestEnd(msg.requestId);
        break;

      case MessageType.HEARTBEAT_PING:
        this.send({
          type: MessageType.HEARTBEAT_PONG,
          sequence: msg.sequence,
          timestamp: Date.now()
        });
        break;

      default:
        break;
    }
  }

  private handleDisconnect(reason: string): void {
    if (this.isStopping) return;

    this.emit('disconnected', { reason });

    if (this.reconnectAttempts >= 30) {
      console.log('Max reconnect attempts reached (30). Stopping auto-reconnect to prevent memory leak.');
      this.isStopping = true;
      return;
    }

    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 15000);
    this.reconnectAttempts++;

    this.emit('reconnecting', { delayMs: Math.round(delay), attempt: this.reconnectAttempts });

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }
}
