import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';

import connectDB from './config/db.js';
import seedSubscriptionPlans from './config/seed.js';
import logger from './config/logger.js';
import errorHandler from './middleware/errorHandler.js';
import { requireAdmin } from './middleware/auth.js';
import { apiLimiter, authLimiter, uploadLimiter } from './middleware/rateLimiter.js';

import authRoutes from './routes/auth.js';
import companyRoutes from './routes/company.js';
import companyAuthRoutes from './routes/companyAuth.js';
import creatorAuthRoutes from './routes/creatorAuth.js';
import adminCreatorsRoutes from './routes/adminCreators.js';
import adminCastingRoutes from './routes/adminCasting.js';
import adminBookingsRoutes from './routes/adminBookings.js';
import adminSubscriptionsRoutes from './routes/adminSubscriptions.js';
import adminWalletRoutes from './routes/adminWallet.js';
import adminBoostRoutes from './routes/adminBoost.js';
import boostApiRoutes from './routes/boostApi.js';
import adminReviewsRoutes from './routes/adminReviews.js';
import reviewApiRoutes from './routes/reviewApi.js';
import adminAnalyticsRoutes from './routes/adminAnalytics.js';
import adminUsersRoutes from './routes/adminUsers.js';
import uploadRoutes from './routes/upload.js';
import companyTalentRoutes from './routes/companyTalent.js';
import companyCastingRoutes from './routes/companyCasting.js';
import companyMessagesRoutes from './routes/companyMessages.js';
import companyWalletRoutes from './routes/companyWallet.js';
import companySubscriptionRoutes from './routes/companySubscription.js';
import companyProfileRoutes from './routes/companyProfile.js';
import creatorPortalRoutes from './routes/creatorPortal.js';
import adminSettingsRoutes from './routes/adminSettings.js';
import publicLandingRoutes from './routes/publicLanding.js';
import paymentsRoutes from './routes/payments.js';

// ── Startup checks ───────────────────────────────────────────────────────────
if (!process.env.JWT_SECRET) {
  logger.error('FATAL: JWT_SECRET environment variable is not set!');
  process.exit(1);
}

const app = express();

// Trust reverse proxy (Nginx) for express-rate-limit
app.set('trust proxy', 1);

const PORT = process.env.PORT || 5000;

// ── Security Headers (Helmet) ────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// ── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://mycastnow.com',
  'https://www.mycastnow.com',
  process.env.R2_PUBLIC_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    logger.warn(`CORS blocked request from: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Length', 'X-JSON-Response-Size'],
  maxAge: 86400
}));

// ── HTTP Request Logger (Morgan → Winston) ───────────────────────────────────
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
  skip: (req) => req.url === '/api/health'
}));

// ── Body Parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));

// ── NoSQL Injection Prevention ───────────────────────────────────────────────
app.use(mongoSanitize());

// ── HTTP Parameter Pollution Prevention ─────────────────────────────────────
app.use(hpp());

// ── Static Files ─────────────────────────────────────────────────────────────
app.use('/uploads', express.static('uploads'));

// ── Global API Rate Limiter ──────────────────────────────────────────────────
app.use('/api', apiLimiter);

// ══════════════════════════════════════════════════════════════════════════════
//  PUBLIC ROUTES (no auth required)
// ══════════════════════════════════════════════════════════════════════════════
app.use('/api/public', publicLandingRoutes);

// ── Auth Routes (rate limited) ────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/companyAuth', authLimiter, companyAuthRoutes);
app.use('/api/creatorAuth', authLimiter, creatorAuthRoutes);

// ── Upload Routes ─────────────────────────────────────────────────────────────
app.use('/api/upload', uploadLimiter, uploadRoutes);

// ── Company Routes ─────────────────────────────────────────────────────────────
app.use('/api/companies', companyRoutes);
app.use('/api/company/talent', companyTalentRoutes);
app.use('/api/company/casting', companyCastingRoutes);
app.use('/api/company/messages', companyMessagesRoutes);
app.use('/api/company/wallet', companyWalletRoutes);
app.use('/api/company/subscription', companySubscriptionRoutes);
app.use('/api/company/profile', companyProfileRoutes);

// ── Creator Routes ─────────────────────────────────────────────────────────────
app.use('/api/creator/portal', creatorPortalRoutes);

// ── Payments Routes ───────────────────────────────────────────────────────────
app.use('/api/payments', paymentsRoutes);

// ── Public Boost & Review ─────────────────────────────────────────────────────
app.use('/api/boost', boostApiRoutes);
app.use('/api/reviews', reviewApiRoutes);

// ══════════════════════════════════════════════════════════════════════════════
//  ADMIN ROUTES (requireAdmin middleware applied at router level)
// ══════════════════════════════════════════════════════════════════════════════
app.use('/api/admin/creators',      requireAdmin, adminCreatorsRoutes);
app.use('/api/admin/casting',       requireAdmin, adminCastingRoutes);
app.use('/api/admin/bookings',      requireAdmin, adminBookingsRoutes);
app.use('/api/admin/subscriptions', requireAdmin, adminSubscriptionsRoutes);
app.use('/api/admin/wallet',        requireAdmin, adminWalletRoutes);
app.use('/api/admin/boost',         requireAdmin, adminBoostRoutes);
app.use('/api/admin/reviews',       requireAdmin, adminReviewsRoutes);
app.use('/api/admin/analytics',     requireAdmin, adminAnalyticsRoutes);
app.use('/api/admin/users',         requireAdmin, adminUsersRoutes);
app.use('/api/admin/settings',      requireAdmin, adminSettingsRoutes);

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found` });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use(errorHandler);

// ── Database & Server Start ───────────────────────────────────────────────────
connectDB()
  .then(seedSubscriptionPlans)
  .then(() => {
    const server = app.listen(PORT, () => {
      logger.info(`✅ Server running on port ${PORT} | ENV: ${process.env.NODE_ENV || 'development'}`);
    });

    // ── Graceful Shutdown (SIGTERM = Render/Railway deploy, SIGINT = Ctrl+C) ──
    const gracefulShutdown = (signal) => {
      logger.info(`${signal} received — shutting down gracefully...`);
      server.close(async () => {
        try {
          const mongoose = await import('mongoose');
          await mongoose.default.connection.close();
          logger.info('MongoDB connection closed. Server exited cleanly.');
          process.exit(0);
        } catch (err) {
          logger.error('Error during shutdown:', err.message);
          process.exit(1);
        }
      });

      // Force exit if graceful shutdown takes too long
      setTimeout(() => {
        logger.error('Forceful shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
  })
  .catch(err => {
    logger.error('Startup error:', err.message);
    process.exit(1);
  });
