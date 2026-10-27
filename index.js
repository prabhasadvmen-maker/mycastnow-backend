import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';

import connectDB from './config/db.js';
import seedSubscriptionPlans from './config/seed.js';
import logger from './config/logger.js';
import { initSocket } from './socket.js';
import Creator from './models/Creator.js';
import Company from './models/Company.js';
import errorHandler from './middleware/errorHandler.js';
import { requireAdmin } from './middleware/auth.js';
import { apiLimiter, authLimiter } from './middleware/rateLimiter.js';

import authRoutes from './routes/auth.js';
import companyRoutes from './routes/company.js';
import companyAuthRoutes from './routes/companyAuth.js';
import creatorAuthRoutes from './routes/creatorAuth.js';
import adminCreatorsRoutes from './routes/adminCreators.js';
import adminCastingRoutes from './routes/adminCasting.js';
import adminBookingsRoutes from './routes/adminBookings.js';
import adminSubscriptionsRoutes from './routes/adminSubscriptions.js';
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
import adminCouponsRoutes from './routes/adminCoupons.js';
import publicLandingRoutes from './routes/publicLanding.js';
import publicCouponsRoutes from './routes/publicCoupons.js';
import paymentsRoutes, { syncLegacyPayments } from './routes/payments.js';

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
  'http://localhost:5174',
  'http://localhost:3000',
  'https://mycastnow.com',
  'https://www.mycastnow.com',
  'https://mycastnow.vercel.app',
  process.env.FRONTEND_URL,
  process.env.R2_PUBLIC_URL,
].filter(Boolean).map((o) => o.trim().replace(/\/+$/, ''));

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    logger.warn(`CORS blocked request from: ${origin}`);
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Length', 'X-JSON-Response-Size'],
  maxAge: 86400
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

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

// ── Static Files with Caching ────────────────────────────────────────────────
app.use('/uploads', express.static('uploads', {
  maxAge: '1d',
  etag: false
}));
app.use('/api/uploads', express.static('uploads', {
  maxAge: '1d',
  etag: false
}));

// ── Cache Control Middleware ─────────────────────────────────────────────────
app.use((req, res, next) => {
  if (req.method === 'GET' && req.path.startsWith('/api/public')) {
    res.set('Cache-Control', 'public, max-age=300');
  }
  if (req.path === '/api/health') {
    res.set('Cache-Control', 'public, max-age=60');
  }
  next();
});

// ── Global API Rate Limiter ──────────────────────────────────────────────────
app.use('/api', apiLimiter);

// ══════════════════════════════════════════════════════════════════════════════
//  PUBLIC ROUTES (no auth required)
// ══════════════════════════════════════════════════════════════════════════════
app.use('/api/public', publicLandingRoutes);
app.use('/api/public/coupons', publicCouponsRoutes);

// ── Auth Routes (rate limited) ────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/companyAuth', authLimiter, companyAuthRoutes);
app.use('/api/creatorAuth', authLimiter, creatorAuthRoutes);

// ── Upload Routes ─────────────────────────────────────────────────────────────
app.use('/api/upload', uploadRoutes);

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
app.use('/api/admin/boost',         requireAdmin, adminBoostRoutes);
app.use('/api/admin/reviews',       requireAdmin, adminReviewsRoutes);
app.use('/api/admin/analytics',     requireAdmin, adminAnalyticsRoutes);
app.use('/api/admin/users',         requireAdmin, adminUsersRoutes);
app.use('/api/admin/settings',      requireAdmin, adminSettingsRoutes);

// Public Fees Endpoint (no auth required)
app.get('/api/public/fees', async (req, res) => {
  try {
    const SystemSettings = (await import('./models/SystemSettings.js')).default;
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({
        platformName: 'MyCastNow',
        supportEmail: 'support@mycastnow.com',
        supportPhone: '+91 98765 43210',
        platformCommissionPercent: 10,
        boostCommissionPercent: 15,
        minWithdrawalAmount: 500,
        creatorOnboardingFee: Number(process.env.CREATOR_ONBOARDING_FEE) || 99,
        creatorOnboardingFeeEnabled: true,
        companyRegistrationFee: Number(process.env.COMPANY_REGISTRATION_FEE) || 199,
        companyRegistrationFeeEnabled: true,
        currency: 'INR',
        maintenanceMode: false,
        allowNewRegistrations: true,
        autoApproveCreators: false,
        autoApproveCastings: true,
        emailNotifications: true,
        smsNotifications: false,
        systemNotice: 'Platform is running smoothly in production mode.'
      });
    }
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json({
      success: true,
      fees: {
        companyRegistrationFee: settings.companyRegistrationFee || 199,
        creatorOnboardingFee: settings.creatorOnboardingFee || 99
      }
    });
  } catch (error) {
    console.error('Error fetching fees:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch fees' });
  }
});
app.use('/api/admin/coupons',       requireAdmin, adminCouponsRoutes);

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
  .then(async () => {
    try {
      await Creator.updateMany(
        { isProfileComplete: { $ne: true }, status: 'pending' },
        { $set: { status: 'incomplete' } }
      );
    } catch (migErr) {
      logger.warn('Creator status migration notice: ' + migErr.message);
    }

    try {
      await syncLegacyPayments();
      logger.info('Legacy onboarding payments synced to Payment collection.');
    } catch (payMigErr) {
      logger.warn('Payment migration notice: ' + payMigErr.message);
    }

    try {
      const brokenLogos = await Company.find({ logo: { $regex: 'pub-mycastnow\\.r2\\.dev' } });
      for (const c of brokenLogos) {
        const key = c.logo.split('pub-mycastnow.r2.dev/')[1];
        c.logo = `/api/upload/file/${key}`;
        await c.save();
      }
    } catch (logoErr) {
      logger.warn('Company logo migration notice: ' + logoErr.message);
    }

    try {
      const prodBackend = process.env.BACKEND_URL || 'https://api.mycastnow.com';
      const localhostRegex = /http:\/\/(localhost|127\.0\.0\.1):5000/;
      const creatorsWithLocalhost = await Creator.find({
        $or: [
          { 'basicDetails.profilePhoto': { $regex: 'localhost:5000' } },
          { 'portfolio.photos': { $regex: 'localhost:5000' } }
        ]
      });
      for (const cr of creatorsWithLocalhost) {
        let modified = false;
        if (cr.basicDetails?.profilePhoto && cr.basicDetails.profilePhoto.includes('localhost:5000')) {
          cr.basicDetails.profilePhoto = cr.basicDetails.profilePhoto.replace(localhostRegex, prodBackend);
          modified = true;
        }
        if (Array.isArray(cr.portfolio?.photos)) {
          cr.portfolio.photos = cr.portfolio.photos.map(p => typeof p === 'string' ? p.replace(localhostRegex, prodBackend) : p);
          modified = true;
        }
        if (modified) await cr.save();
      }
    } catch (cleanErr) {
      logger.warn('Media URL migration notice: ' + cleanErr.message);
    }
  })
  .then(() => {
    const server = http.createServer(app);
    initSocket(server, allowedOrigins);
    server.listen(PORT, () => {
      logger.info(`✅ Server running on port ${PORT} | ENV: ${process.env.NODE_ENV || 'development'}`);

      // Keep-alive: ping self every 30s to prevent Render free tier sleep
      if (process.env.NODE_ENV === 'production') {
        const SELF_URL = process.env.RENDER_EXTERNAL_URL || 'https://api.mycastnow.com/api';
        setInterval(() => {
          fetch(`${SELF_URL}/health`).catch(() => {});
        }, 30 * 1000);
      }
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
