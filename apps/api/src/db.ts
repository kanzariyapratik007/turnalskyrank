import fs from 'node:fs';
import path from 'node:path';

function getDbFilePath(): string {
  const cwdPath = path.join(process.cwd(), 'dev.db.json');
  if (fs.existsSync(cwdPath)) return cwdPath;
  const parentPath = path.join(process.cwd(), '..', '..', 'dev.db.json');
  if (fs.existsSync(parentPath)) return parentPath;
  return cwdPath;
}

const DB_FILE = getDbFilePath();

export interface DatabaseState {
  users: any[];
  projects: any[];
  tunnels: any[];
  domains: any[];
  devices: any[];
  apiKeys: any[];
  requestLogs: any[];
  plans: any[];
  subscriptions: any[];
}

function loadDatabase(): DatabaseState {
  const filePath = getDbFilePath();
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      // Fallback
    }
  }

  const defaultUserId = 'usr_1787745931043_96274';
  const initial: DatabaseState = {
    users: [
      {
        id: defaultUserId,
        email: 'developer@turnal.live',
        name: 'Turnal Developer',
        passwordHash: '$2b$10$m6k1P8q8/j97Z8y08UeZ8uR08y08y08y08y08y08y08y08y08y08y',
        role: 'admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    projects: [
      {
        id: 'proj_default',
        name: 'Default Project',
        slug: 'default',
        userId: defaultUserId,
        createdAt: new Date().toISOString()
      }
    ],
    tunnels: [],
    domains: [
      {
        id: 'dom_default',
        domain: 'app.skyranksolution.com',
        status: 'VERIFIED',
        userId: defaultUserId,
        createdAt: new Date().toISOString()
      }
    ],
    devices: [],
    apiKeys: [
      {
        id: 'key_default',
        name: 'Default Live Key',
        key: 'trk_live_43021d2c8ab8a30c79ed6402964cbb3d1ed62d86464df1b9',
        userId: defaultUserId,
        createdAt: new Date().toISOString()
      }
    ],
    requestLogs: [],
    plans: [],
    subscriptions: []
  };

  saveDatabase(initial);
  return initial;
}

function saveDatabase(state: DatabaseState): void {
  try {
    const filePath = getDbFilePath();
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist database file:', err);
  }
}

let dbState = loadDatabase();

export const prisma = {
  user: {
    findUnique: async ({ where }: { where: { id?: string; email?: string } }) => {
      dbState = loadDatabase();
      return dbState.users.find(u => (where.id && u.id === where.id) || (where.email && u.email.toLowerCase() === where.email.toLowerCase())) || null;
    },
    findFirst: async ({ where }: any) => {
      dbState = loadDatabase();
      return dbState.users.find(u => (!where?.id || u.id === where.id) && (!where?.email || u.email.toLowerCase() === where.email.toLowerCase())) || null;
    },
    create: async ({ data }: { data: any }) => {
      dbState = loadDatabase();
      const user = {
        id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        role: 'USER',
        ...data
      };
      dbState.users.push(user);
      saveDatabase(dbState);
      return user;
    },
    findMany: async () => {
      dbState = loadDatabase();
      return dbState.users;
    }
  },

  plan: {
    upsert: async ({ where, create, update }: any) => {
      dbState = loadDatabase();
      let plan = dbState.plans.find(p => p.slug === where.slug);
      if (!plan) {
        plan = {
          id: `plan_${Date.now()}`,
          ...create,
          createdAt: new Date()
        };
        dbState.plans.push(plan);
        saveDatabase(dbState);
      }
      return plan;
    }
  },

  subscription: {
    create: async ({ data }: { data: any }) => {
      dbState = loadDatabase();
      const sub = {
        id: `sub_${Date.now()}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      dbState.subscriptions.push(sub);
      saveDatabase(dbState);
      return sub;
    }
  },

  tunnel: {
    findMany: async ({ where, include, orderBy }: any = {}) => {
      dbState = loadDatabase();
      let res = dbState.tunnels;
      if (where?.userId) {
        res = res.filter(t => t.userId === where.userId);
      }
      return res.map(t => {
        const item: any = { ...t, createdAt: new Date(t.createdAt) };
        if (include?.project) item.project = dbState.projects.find(p => p.id === t.projectId) || null;
        if (include?.connectedDevice) item.connectedDevice = dbState.devices.find(d => d.id === t.connectedDeviceId) || null;
        if (include?.domains) item.domains = dbState.domains.filter(d => d.targetTunnelId === t.id);
        return item;
      });
    },
    findFirst: async ({ where, include }: any) => {
      dbState = loadDatabase();
      const t = dbState.tunnels.find(x => (!where.id || x.id === where.id) && (!where.userId || x.userId === where.userId));
      if (!t) return null;
      const item: any = { ...t, createdAt: new Date(t.createdAt) };
      if (include?.project) item.project = dbState.projects.find(p => p.id === t.projectId) || null;
      if (include?.connectedDevice) item.connectedDevice = dbState.devices.find(d => d.id === t.connectedDeviceId) || null;
      if (include?.domains) item.domains = dbState.domains.filter(d => d.targetTunnelId === t.id);
      if (include?.requestLogs) {
        item.requestLogs = dbState.requestLogs.filter(l => l.tunnelId === t.id).slice(0, 50);
      }
      return item;
    },
    findUnique: async ({ where, include }: any) => {
      dbState = loadDatabase();
      const t = dbState.tunnels.find(x => (where.id && x.id === where.id) || (where.subdomain && x.subdomain === where.subdomain) || (where.customDomain && x.customDomain === where.customDomain));
      if (!t) return null;
      const item: any = { ...t, createdAt: new Date(t.createdAt) };
      if (include?.user) item.user = dbState.users.find(u => u.id === t.userId) || null;
      return item;
    },
    create: async ({ data }: { data: any }) => {
      dbState = loadDatabase();
      const tunnel = {
        id: `tun_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        status: 'OFFLINE',
        totalRequests: 0,
        totalBytes: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data
      };
      dbState.tunnels.push(tunnel);
      saveDatabase(dbState);
      return tunnel;
    },
    update: async ({ where, data }: any) => {
      dbState = loadDatabase();
      const idx = dbState.tunnels.findIndex(t => t.id === where.id);
      if (idx !== -1) {
        if (data.totalRequests?.increment) {
          dbState.tunnels[idx].totalRequests = (dbState.tunnels[idx].totalRequests || 0) + data.totalRequests.increment;
          delete data.totalRequests;
        }
        if (data.totalBytes?.increment) {
          dbState.tunnels[idx].totalBytes = (dbState.tunnels[idx].totalBytes || 0) + Number(data.totalBytes.increment);
          delete data.totalBytes;
        }
        dbState.tunnels[idx] = { ...dbState.tunnels[idx], ...data, updatedAt: new Date() };
        saveDatabase(dbState);
        return dbState.tunnels[idx];
      }
      return null;
    },
    delete: async ({ where }: any) => {
      dbState = loadDatabase();
      dbState.tunnels = dbState.tunnels.filter(t => t.id !== where.id);
      saveDatabase(dbState);
      return { id: where.id };
    },
    deleteMany: async ({ where }: any = {}) => {
      dbState = loadDatabase();
      let count = 0;
      if (where?.id?.in) {
        const set = new Set(where.id.in);
        const prevLen = dbState.tunnels.length;
        dbState.tunnels = dbState.tunnels.filter(t => !set.has(t.id));
        count = prevLen - dbState.tunnels.length;
      } else if (where?.id) {
        dbState.tunnels = dbState.tunnels.filter(t => t.id !== where.id);
        count = 1;
      }
      saveDatabase(dbState);
      return { count };
    }
  },

  domain: {
    findMany: async ({ where, include }: any = {}) => {
      dbState = loadDatabase();
      let res = dbState.domains;
      if (where?.userId) res = res.filter(d => d.userId === where.userId);
      return res.map(d => {
        const item = { ...d, createdAt: new Date(d.createdAt) };
        if (include?.targetTunnel) item.targetTunnel = dbState.tunnels.find(t => t.id === d.targetTunnelId) || null;
        return item;
      });
    },
    findUnique: async ({ where, include }: any) => {
      dbState = loadDatabase();
      const d = dbState.domains.find(x => (where.id && x.id === where.id) || (where.domainName && x.domainName === where.domainName));
      if (!d) return null;
      const item: any = { ...d, createdAt: new Date(d.createdAt) };
      if (include?.targetTunnel) {
        const tunnel = dbState.tunnels.find(t => t.id === d.targetTunnelId) || null;
        if (tunnel && include.targetTunnel?.include?.user) {
          tunnel.user = dbState.users.find(u => u.id === tunnel.userId) || null;
        }
        item.targetTunnel = tunnel;
      }
      return item;
    },
    findFirst: async ({ where }: any) => {
      dbState = loadDatabase();
      return dbState.domains.find(d => (!where.id || d.id === where.id) && (!where.userId || d.userId === where.userId)) || null;
    },
    create: async ({ data }: any) => {
      dbState = loadDatabase();
      const domain = {
        id: `dom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data
      };
      dbState.domains.push(domain);
      saveDatabase(dbState);
      return domain;
    },
    update: async ({ where, data }: any) => {
      dbState = loadDatabase();
      const idx = dbState.domains.findIndex(d => d.id === where.id);
      if (idx !== -1) {
        dbState.domains[idx] = { ...dbState.domains[idx], ...data, updatedAt: new Date() };
        saveDatabase(dbState);
        return dbState.domains[idx];
      }
      return null;
    },
    delete: async ({ where }: any) => {
      dbState = loadDatabase();
      dbState.domains = dbState.domains.filter(d => d.id !== where.id);
      saveDatabase(dbState);
      return { id: where.id };
    },
    deleteMany: async ({ where }: any = {}) => {
      dbState = loadDatabase();
      let count = 0;
      if (where?.targetTunnelId?.in) {
        const set = new Set(where.targetTunnelId.in);
        const prevLen = dbState.domains.length;
        dbState.domains = dbState.domains.filter(d => !set.has(d.targetTunnelId));
        count = prevLen - dbState.domains.length;
      } else if (where?.targetTunnelId) {
        const prevLen = dbState.domains.length;
        dbState.domains = dbState.domains.filter(d => d.targetTunnelId !== where.targetTunnelId);
        count = prevLen - dbState.domains.length;
      }
      saveDatabase(dbState);
      return { count };
    }
  },

  project: {
    findMany: async ({ where, include }: any = {}) => {
      dbState = loadDatabase();
      let res = dbState.projects;
      if (where?.userId) res = res.filter(p => p.userId === where.userId);
      return res.map(p => {
        const tunnels = dbState.tunnels.filter(t => t.projectId === p.id);
        return {
          ...p,
          createdAt: new Date(p.createdAt),
          tunnels: include?.tunnels ? tunnels : [],
          _count: { tunnels: tunnels.length }
        };
      });
    },
    findFirst: async ({ where }: any) => {
      dbState = loadDatabase();
      return dbState.projects.find(p => (!where.id || p.id === where.id) && (!where.userId || p.userId === where.userId)) || null;
    },
    create: async ({ data }: any) => {
      dbState = loadDatabase();
      const project = {
        id: `prj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data
      };
      dbState.projects.push(project);
      saveDatabase(dbState);
      return project;
    },
    delete: async ({ where }: any) => {
      dbState = loadDatabase();
      dbState.projects = dbState.projects.filter(p => p.id !== where.id);
      saveDatabase(dbState);
      return { id: where.id };
    }
  },

  device: {
    findMany: async ({ where, include }: any = {}) => {
      dbState = loadDatabase();
      let res = dbState.devices;
      if (where?.userId) res = res.filter(d => d.userId === where.userId);
      return res.map(d => {
        const item: any = { ...d };
        if (include?.tunnels) item.tunnels = dbState.tunnels.filter(t => t.connectedDeviceId === d.id);
        return item;
      });
    },
    count: async ({ where }: any = {}) => {
      dbState = loadDatabase();
      let res = dbState.devices;
      if (where?.userId) res = res.filter(d => d.userId === where.userId);
      if (where?.isOnline !== undefined) res = res.filter(d => d.isOnline === where.isOnline);
      return res.length;
    },
    upsert: async ({ where, update, create }: any) => {
      dbState = loadDatabase();
      const idx = dbState.devices.findIndex(d => d.deviceIdentifier === where.deviceIdentifier);
      if (idx !== -1) {
        dbState.devices[idx] = { ...dbState.devices[idx], ...update, updatedAt: new Date() };
        saveDatabase(dbState);
        return dbState.devices[idx];
      } else {
        const device = {
          id: `dev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...create
        };
        dbState.devices.push(device);
        saveDatabase(dbState);
        return device;
      }
    }
  },

  apiKey: {
    findMany: async ({ where }: any = {}) => {
      dbState = loadDatabase();
      let res = dbState.apiKeys;
      if (where?.userId) res = res.filter(k => k.userId === where.userId);
      return res.map(k => ({ ...k, createdAt: new Date(k.createdAt) }));
    },
    findFirst: async ({ where }: any) => {
      dbState = loadDatabase();
      return dbState.apiKeys.find(k => (!where.id || k.id === where.id) && (!where.userId || k.userId === where.userId)) || null;
    },
    findUnique: async ({ where, include }: any) => {
      dbState = loadDatabase();
      const key = dbState.apiKeys.find(k => k.keyHash === where.keyHash);
      if (!key) return null;
      const item: any = { ...key };
      if (include?.user) item.user = dbState.users.find(u => u.id === key.userId) || null;
      return item;
    },
    create: async ({ data }: any) => {
      dbState = loadDatabase();
      const key = {
        id: `key_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: new Date(),
        ...data
      };
      dbState.apiKeys.push(key);
      saveDatabase(dbState);
      return key;
    },
    update: async ({ where, data }: any) => {
      dbState = loadDatabase();
      const idx = dbState.apiKeys.findIndex(k => k.id === where.id);
      if (idx !== -1) {
        dbState.apiKeys[idx] = { ...dbState.apiKeys[idx], ...data };
        saveDatabase(dbState);
        return dbState.apiKeys[idx];
      }
      return null;
    },
    delete: async ({ where }: any) => {
      dbState = loadDatabase();
      dbState.apiKeys = dbState.apiKeys.filter(k => k.id !== where.id);
      saveDatabase(dbState);
      return { id: where.id };
    }
  },

  requestLog: {
    findMany: async ({ where, orderBy, take }: any = {}) => {
      dbState = loadDatabase();
      let res = dbState.requestLogs;
      if (where?.tunnelId?.in) {
        const set = new Set(where.tunnelId.in);
        res = res.filter(l => set.has(l.tunnelId));
      }
      if (where?.timestamp?.gte) {
        const gteTime = new Date(where.timestamp.gte).getTime();
        res = res.filter(l => new Date(l.timestamp).getTime() >= gteTime);
      }
      res.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      if (take) res = res.slice(0, take);
      return res.map(l => ({ ...l, timestamp: new Date(l.timestamp) }));
    },
    create: async ({ data }: any) => {
      dbState = loadDatabase();
      const log = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date(),
        ...data
      };
      dbState.requestLogs.push(log);
      if (dbState.requestLogs.length > 500) {
        dbState.requestLogs = dbState.requestLogs.slice(-500);
      }
      saveDatabase(dbState);
      return log;
    }
  },

  $transaction: async (operations: any[]) => {
    return Promise.all(operations);
  }
};
