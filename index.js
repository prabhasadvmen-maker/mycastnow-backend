import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
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

dotenv.config();


const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static('uploads'));

import SubscriptionPlan from './models/SubscriptionPlan.js';

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mycastnow';
mongoose.connect(mongoUri)
  .then(async () => {
    console.log('Connected to MongoDB');
    try {
      const planCount = await SubscriptionPlan.countDocuments();
      if (planCount === 0) {
        await SubscriptionPlan.insertMany([
          {
            name: 'Artist Starter',
            description: 'Basic access to casting calls and talent directory profile.',
            targetAudience: 'Creator',
            monthlyPrice: 0,
            yearlyPrice: 0,
            currency: 'INR',
            features: ['5 Applications / month', '6 Portfolio Photos', 'Verified Artist Profile Search', 'Standard Support'],
            maxCastingApplications: 5,
            maxPortfolioPhotos: 6,
            maxBookingsPerMonth: 2,
            prioritySupport: false,
            verifiedBadge: false,
            featuredListing: false,
            badgeColor: 'blue',
            isPopular: false,
            trialDays: 0,
            isActive: true,
            sortOrder: 1
          },
          {
            name: 'Creator Spotlight Pro',
            description: 'Full audition power, direct WhatsApp alerts, and verified blue checkmark.',
            targetAudience: 'Creator',
            monthlyPrice: 999,
            yearlyPrice: 9990,
            currency: 'INR',
            features: ['Unlimited Casting Applications', 'Unlimited Portfolio & Video Reels', 'Blue Verified Artist Checkmark', 'Priority Audition Screening', 'Instant WhatsApp Casting Alerts', 'Direct Chat with Production Houses'],
            maxCastingApplications: -1,
            maxPortfolioPhotos: -1,
            maxBookingsPerMonth: -1,
            prioritySupport: true,
            verifiedBadge: true,
            featuredListing: true,
            badgeColor: 'purple',
            isPopular: true,
            trialDays: 7,
            isActive: true,
            sortOrder: 2
          },
          {
            name: 'All-Access Pro Network',
            description: 'Dual-purpose plan for actor-producers, casting directors & creator studios.',
            targetAudience: 'Both',
            monthlyPrice: 2499,
            yearlyPrice: 24990,
            currency: 'INR',
            features: ['Unlimited Audition Submissions & Casting Calls', 'Unlimited Talent Search & Direct Contact', 'Verified Checkmark for Talent & Production', 'Escrow Protected Contracts & Zero Fees', 'Dedicated Account Manager'],
            maxCastingApplications: -1,
            maxPortfolioPhotos: -1,
            maxBookingsPerMonth: -1,
            prioritySupport: true,
            verifiedBadge: true,
            featuredListing: true,
            badgeColor: 'purple',
            isPopular: false,
            trialDays: 7,
            isActive: true,
            sortOrder: 3
          },
          {
            name: 'Starter Casting Studio',
            description: 'Essential scouting & casting pipeline for independent producers.',
            targetAudience: 'Company',
            monthlyPrice: 4999,
            yearlyPrice: 49990,
            currency: 'INR',
            features: ['Up to 5 Active Casting Calls', 'Direct Messaging with 25 Talents/mo', 'Standard Escrow Protection', 'Email & Chat Support'],
            maxCastingApplications: 5,
            maxPortfolioPhotos: 20,
            maxBookingsPerMonth: 10,
            prioritySupport: false,
            verifiedBadge: false,
            featuredListing: false,
            badgeColor: 'blue',
            isPopular: false,
            trialDays: 0,
            isActive: true,
            sortOrder: 4
          },
          {
            name: 'Pro Production House',
            description: 'Full-featured power package for high-volume shoots, OTT shows, and films.',
            targetAudience: 'Company',
            monthlyPrice: 12999,
            yearlyPrice: 129990,
            currency: 'INR',
            features: ['Unlimited Active Casting Calls', 'Unlimited Direct Talent Messaging', '0% Platform Escrow Fee', 'Verified Studio Blue Badge', 'Dedicated Casting Coordinator', 'Instant Audition Video Downloads'],
            maxCastingApplications: -1,
            maxPortfolioPhotos: -1,
            maxBookingsPerMonth: -1,
            prioritySupport: true,
            verifiedBadge: true,
            featuredListing: true,
            badgeColor: 'gold',
            isPopular: true,
            trialDays: 14,
            isActive: true,
            sortOrder: 5
          }
        ]);
        console.log('Seeded default SubscriptionPlans into MongoDB database');
      }
    } catch (seedErr) {
      console.error('Subscription plan auto-seed error:', seedErr.message);
    }
  })
  .catch(err => console.error('MongoDB connection error:', err.message));

app.use('/api/auth', authRoutes);
app.use('/api/companyAuth', companyAuthRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/creatorAuth', creatorAuthRoutes);
app.use('/api/admin/creators', adminCreatorsRoutes);
app.use('/api/admin/casting', adminCastingRoutes);
app.use('/api/casting', adminCastingRoutes);
app.use('/api/admin/bookings', adminBookingsRoutes);
app.use('/api/admin/subscriptions', adminSubscriptionsRoutes);
app.use('/api/admin/wallet', adminWalletRoutes);
app.use('/api/admin/boost', adminBoostRoutes);
app.use('/api/boost', boostApiRoutes);
app.use('/api/admin/reviews', adminReviewsRoutes);
app.use('/api/reviews', reviewApiRoutes);
app.use('/api/admin/analytics', adminAnalyticsRoutes);
app.use('/api/admin/users', adminUsersRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/company/talent', companyTalentRoutes);
app.use('/api/talent', companyTalentRoutes);
app.use('/api/company/casting', companyCastingRoutes);
app.use('/api/company/messages', companyMessagesRoutes);
app.use('/api/messages', companyMessagesRoutes);
app.use('/api/company/wallet', companyWalletRoutes);
app.use('/api/company/subscription', companySubscriptionRoutes);
app.use('/api/company/profile', companyProfileRoutes);
app.use('/api/creator/portal', creatorPortalRoutes);
app.use('/api/creator-portal', creatorPortalRoutes);
app.use('/api/admin/settings', adminSettingsRoutes);
app.use('/api/admin/help', adminSettingsRoutes);
app.use('/api/public', publicLandingRoutes);
app.use('/api', publicLandingRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
