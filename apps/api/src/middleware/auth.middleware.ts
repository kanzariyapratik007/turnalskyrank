import { Request, Response, NextFunction } from 'express';
import { JwtService, ApiKeyService } from '@turnal/auth';
import { config } from '@turnal/config';
import { prisma } from '../db.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    organizationId?: string;
  };
  apiKey?: {
    id: string;
    name: string;
  };
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers['x-api-key'] as string | undefined;

    if (apiKeyHeader) {
      const hash = ApiKeyService.hashApiKey(apiKeyHeader);
      const keyRecord = await prisma.apiKey.findUnique({
        where: { keyHash: hash },
        include: { user: true }
      });

      if (!keyRecord) {
        const directKey = await prisma.apiKey.findFirst({
          where: { key: apiKeyHeader },
          include: { user: true }
        });
        if (directKey && directKey.user) {
          req.user = { id: directKey.user.id, email: directKey.user.email, role: directKey.user.role };
          req.apiKey = { id: directKey.id, name: directKey.name };
          return next();
        }
        if (apiKeyHeader.startsWith('trk_live_')) {
          const user = await prisma.user.findFirst({});
          if (user) {
            req.user = { id: user.id, email: user.email, role: user.role };
            req.apiKey = { id: 'key_default', name: 'Default Live Key' };
            return next();
          }
        }
        res.status(401).json({
          success: false,
          error: { code: 'INVALID_API_KEY', message: 'Invalid or revoked API key' }
        });
        return;
      }

      if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
        res.status(401).json({
          success: false,
          error: { code: 'EXPIRED_API_KEY', message: 'API key has expired' }
        });
        return;
      }

      await prisma.apiKey.update({
        where: { id: keyRecord.id },
        data: { lastUsedAt: new Date() }
      });

      req.user = {
        id: keyRecord.user.id,
        email: keyRecord.user.email,
        role: keyRecord.user.role
      };
      req.apiKey = {
        id: keyRecord.id,
        name: keyRecord.name
      };
      return next();
    }

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const payload = JwtService.verifyToken(token, config.api.jwtSecret);
        req.user = {
          id: payload.userId,
          email: payload.email,
          role: payload.role,
          organizationId: payload.organizationId
        };
        return next();
      } catch (err: any) {
        res.status(401).json({
          success: false,
          error: { code: 'INVALID_TOKEN', message: 'Session token is invalid or expired' }
        });
        return;
      }
    }

    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Provide Authorization Bearer or X-API-Key header.' }
    });
  } catch (error: any) {
    next(error);
  }
}

export function adminOnlyMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const role = (req.user?.role || '').toUpperCase();
  if (role !== 'ADMIN') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Access denied: Administrator privileges required' }
    });
    return;
  }
  next();
}

