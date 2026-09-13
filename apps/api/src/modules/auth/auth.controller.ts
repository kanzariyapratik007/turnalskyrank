import { Router, Request, Response } from 'express';
import { PasswordService, JwtService } from '@turnal/auth';
import { config } from '@turnal/config';
import { prisma } from '../../db.js';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth.middleware.js';

export const authRouter = Router();

authRouter.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Email, password, and name are required' } });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ success: false, error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters long' } });
      return;
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (existingUser) {
      res.status(409).json({ success: false, error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists' } });
      return;
    }

    const passwordHash = await PasswordService.hash(password);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash,
        name: name.trim(),
        role: 'USER'
      }
    });

    const freePlan = await prisma.plan.upsert({
      where: { slug: 'free' },
      update: {},
      create: {
        name: 'Free Developer',
        slug: 'free',
        maxTunnels: 3,
        maxCustomDomains: 1,
        bandwidthLimitBytes: BigInt(10737418240),
        priceMonthly: 0
      }
    });

    await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: freePlan.id,
        status: 'ACTIVE'
      }
    });

    const token = JwtService.signAccessToken(
      { userId: user.id, email: user.email, role: user.role },
      config.api.jwtSecret,
      config.api.jwtExpiresIn
    );

    const refreshToken = JwtService.signRefreshToken(
      { userId: user.id, email: user.email, role: user.role },
      config.api.jwtRefreshSecret,
      config.api.jwtRefreshExpiresIn
    );

    res.status(201).json({
      success: true,
      data: {
        token,
        refreshToken,
        user: { id: user.id, email: user.email, name: user.name, role: user.role }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Email and password are required' } });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (!user) {
      res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
      return;
    }

    const isValid = await PasswordService.compare(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
      return;
    }

    const token = JwtService.signAccessToken(
      { userId: user.id, email: user.email, role: user.role },
      config.api.jwtSecret,
      config.api.jwtExpiresIn
    );

    const refreshToken = JwtService.signRefreshToken(
      { userId: user.id, email: user.email, role: user.role },
      config.api.jwtRefreshSecret,
      config.api.jwtRefreshExpiresIn
    );

    res.json({
      success: true,
      data: {
        token,
        refreshToken,
        user: { id: user.id, email: user.email, name: user.name, role: user.role }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

authRouter.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = await (prisma.user.findUnique as any)({
      where: { id: req.user!.id }
    });

    if (!user) {
      res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
      return;
    }

    res.json({ success: true, data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});
