import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from '../../../packages/config/src/index.js';
import { authRouter } from './modules/auth/auth.controller.js';
import { tunnelRouter } from './modules/tunnel/tunnel.controller.js';
import { domainRouter } from './modules/domain/domain.controller.js';
import { projectRouter } from './modules/project/project.controller.js';
import { deviceRouter } from './modules/device/device.controller.js';
import { apiKeyRouter } from './modules/apikey/apikey.controller.js';
import { analyticsRouter } from './modules/analytics/analytics.controller.js';
import { adminRouter } from './modules/admin/admin.controller.js';

const app = express();

// Security & Parsing Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// Rate Limiting for Auth Endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'turnal-api', timestamp: new Date().toISOString() });
});

// Mount Routes
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/tunnels', tunnelRouter);
app.use('/api/domains', domainRouter);
app.use('/api/projects', projectRouter);
app.use('/api/devices', deviceRouter);
app.use('/api/apikeys', apiKeyRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/admin', adminRouter);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[API Server Unhandled Error]:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred'
    }
  });
});

app.listen(config.api.port, config.api.host, () => {
  console.log(`🚀 [Turnal API Server] listening on http://${config.api.host}:${config.api.port}`);
});

export default app;
