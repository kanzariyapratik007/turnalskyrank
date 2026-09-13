export enum TunnelStatus {
  OFFLINE = 'OFFLINE',
  ONLINE = 'ONLINE',
  CONNECTING = 'CONNECTING',
  ERROR = 'ERROR',
  DISABLED = 'DISABLED',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  REJECTED = 'REJECTED'
}

export enum DomainVerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  FAILED = 'FAILED'
}

export enum SslStatus {
  NONE = 'NONE',
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  ERROR = 'ERROR'
}

export interface UserSummary {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  slug: string;
  defaultPort: number;
  description?: string;
  createdAt: string;
}

export interface TunnelSummary {
  id: string;
  name: string;
  subdomain: string;
  publicUrl: string;
  customDomain?: string;
  status: TunnelStatus;
  localTargetPort: number;
  localTargetHost: string;
  protocol: 'http' | 'https';
  connectedDeviceId?: string;
  connectedDeviceName?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;
  createdAt: string;
  lastHeartbeatAt?: string;
  totalRequests: number;
  totalBytes: number;
}

export interface DomainSummary {
  id: string;
  domainName: string;
  verificationStatus: DomainVerificationStatus;
  sslStatus: SslStatus;
  verificationToken: string;
  dnsTxtRecord: string;
  dnsCnameTarget: string;
  targetTunnelId?: string;
  targetTunnelName?: string;
  verifiedAt?: string;
  createdAt: string;
}

export interface ApiKeySummary {
  id: string;
  name: string;
  keyPrefix: string; // e.g. "trk_live_a1b2..."
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
}

export interface DeviceSummary {
  id: string;
  name: string;
  platform: string;
  agentVersion: string;
  ipAddress?: string;
  isOnline: boolean;
  lastSeenAt: string;
  createdAt: string;
}

export interface AnalyticsSummary {
  totalRequestsToday: number;
  totalBandwidthBytes: number;
  avgLatencyMs: number;
  errorRatePercent: number;
  activeTunnelsCount: number;
  onlineDevicesCount: number;
  requestsTimeline: Array<{
    timestamp: string;
    requests: number;
    errors: number;
    avgLatencyMs: number;
  }>;
}

export interface RequestLogSummary {
  id: string;
  requestId: string;
  tunnelId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  bytesIn: number;
  bytesOut: number;
  clientIp?: string;
  userAgent?: string;
  timestamp: string;
}
