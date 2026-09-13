import { Router, Response } from 'express';
import { prisma } from '../../db.js';
import { authMiddleware, adminOnlyMiddleware, AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import { TunnelStatus, DomainVerificationStatus, SslStatus } from '@turnal/shared';

export const adminRouter = Router();

// Apply Auth and Admin Role protection to all admin endpoints
adminRouter.use(authMiddleware, adminOnlyMiddleware);

// GET /api/admin/tunnels/pending - Fetch all tunnels pending admin approval
adminRouter.get('/tunnels/pending', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const allTunnels = await prisma.tunnel.findMany({
      include: {
        project: true,
        connectedDevice: true,
        domains: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const allUsers = await prisma.user.findMany();

    const formattedTunnels = allTunnels.map(t => {
      const user = allUsers.find(u => u.id === t.userId);
      return {
        id: t.id,
        name: t.name,
        subdomain: t.subdomain,
        customDomain: t.customDomain,
        localTargetPort: t.localTargetPort,
        localTargetHost: t.localTargetHost,
        protocol: t.protocol,
        status: t.status,
        userId: t.userId,
        userName: user?.name || 'User',
        createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : new Date().toISOString(),
        approvedAt: (t as any).approvedAt,
        approvedBy: (t as any).approvedBy,
        rejectionReason: (t as any).rejectionReason
      };
    });

    res.json({
      success: true,
      data: formattedTunnels
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

// POST /api/admin/tunnels/:id/approve - Approve a specific tunnel and activate its domain/SSL
adminRouter.post('/tunnels/:id/approve', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body;

    const tunnel = await prisma.tunnel.findUnique({ where: { id } });
    if (!tunnel) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tunnel not found' } });
      return;
    }

    const updated = await prisma.tunnel.update({
      where: { id },
      data: {
        status: TunnelStatus.ONLINE,
        approvedAt: new Date().toISOString(),
        approvedBy: req.user?.email || 'admin',
        adminNotes: adminNotes || 'Approved by administrator'
      } as any
    });

    // If there is a custom domain attached, mark domain & SSL as verified/active
    if (tunnel.customDomain) {
      const existingDomain = await prisma.domain.findUnique({ where: { domainName: tunnel.customDomain } });
      if (existingDomain) {
        await prisma.domain.update({
          where: { id: existingDomain.id },
          data: {
            verificationStatus: DomainVerificationStatus.VERIFIED,
            sslStatus: SslStatus.ACTIVE,
            verifiedAt: new Date()
          }
        });
      } else {
        await prisma.domain.create({
          data: {
            domainName: tunnel.customDomain,
            verificationStatus: DomainVerificationStatus.VERIFIED,
            verificationToken: `v_tok_${Date.now()}`,
            sslStatus: SslStatus.ACTIVE,
            verifiedAt: new Date(),
            userId: tunnel.userId,
            targetTunnelId: tunnel.id
          }
        });
      }
    }

    res.json({
      success: true,
      message: `Tunnel ${tunnel.name} (${tunnel.localTargetPort} -> ${tunnel.customDomain || tunnel.subdomain}) successfully approved!`,
      data: updated
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

// POST /api/admin/tunnels/:id/reject - Reject a specific tunnel
adminRouter.post('/tunnels/:id/reject', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason = 'Rejected by administrator policy' } = req.body;

    const tunnel = await prisma.tunnel.findUnique({ where: { id } });
    if (!tunnel) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tunnel not found' } });
      return;
    }

    const updated = await prisma.tunnel.update({
      where: { id },
      data: {
        status: TunnelStatus.REJECTED,
        rejectionReason: reason,
        approvedBy: req.user?.email || 'admin'
      } as any
    });

    res.json({
      success: true,
      message: `Tunnel ${tunnel.name} was rejected.`,
      data: updated
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

// POST /api/admin/tunnels/batch-decision - Approve or reject multiple tunnels in one request
adminRouter.post('/tunnels/batch-decision', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { decisions } = req.body as { decisions: Array<{ tunnelId: string; action: 'APPROVE' | 'REJECT'; reason?: string }> };

    if (!Array.isArray(decisions)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'decisions must be an array' } });
      return;
    }

    const results = [];

    for (const item of decisions) {
      const tunnel = await prisma.tunnel.findUnique({ where: { id: item.tunnelId } });
      if (!tunnel) continue;

      if (item.action === 'APPROVE') {
        const updated = await prisma.tunnel.update({
          where: { id: item.tunnelId },
          data: {
            status: TunnelStatus.ONLINE,
            approvedAt: new Date().toISOString(),
            approvedBy: req.user?.email || 'admin'
          } as any
        });
        if (tunnel.customDomain) {
          const dom = await prisma.domain.findUnique({ where: { domainName: tunnel.customDomain } });
          if (dom) {
            await prisma.domain.update({
              where: { id: dom.id },
              data: { verificationStatus: DomainVerificationStatus.VERIFIED, sslStatus: SslStatus.ACTIVE, verifiedAt: new Date() }
            });
          }
        }
        results.push({ id: item.tunnelId, status: TunnelStatus.ONLINE, approved: true });
      } else {
        const updated = await prisma.tunnel.update({
          where: { id: item.tunnelId },
          data: {
            status: TunnelStatus.REJECTED,
            rejectionReason: item.reason || 'Rejected by administrator',
            approvedBy: req.user?.email || 'admin'
          } as any
        });
        results.push({ id: item.tunnelId, status: TunnelStatus.REJECTED, approved: false });
      }
    }

    res.json({
      success: true,
      data: results
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

// GET /api/admin/stats - Admin platform telemetry
adminRouter.get('/stats', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany();
    const tunnels = await prisma.tunnel.findMany();
    const domains = await prisma.domain.findMany();

    const activeTunnels = tunnels.filter(t => t.status === TunnelStatus.ONLINE);
    const pendingTunnels = tunnels.filter(t => t.status === TunnelStatus.PENDING_APPROVAL);
    const rejectedTunnels = tunnels.filter(t => t.status === TunnelStatus.REJECTED);

    res.json({
      success: true,
      data: {
        totalUsers: users.length,
        totalTunnels: tunnels.length,
        activeTunnelsCount: activeTunnels.length,
        pendingTunnelsCount: pendingTunnels.length,
        rejectedTunnelsCount: rejectedTunnels.length,
        totalCustomDomains: domains.length
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});
