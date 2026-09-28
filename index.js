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

dotenv.config();


const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static('uploads'));

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mycastnow';
mongoose.connect(mongoUri)
  .then(() => console.log('Connected to MongoDB'))
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

app.get('/api/dashboard/stats', (req, res) => {
  // Mock data for dashboard
  res.json({
    totalNGOs: 1,
    totalUsers: 2,
    totalDonations: '6.0L',
    activeVolunteers: 8,
    monthlyTrends: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      donations: [2.5, 3.0, 4.2, 5.0, 4.8, 6.0],
      expenses: [1.2, 1.5, 2.0, 2.5, 2.2, 3.0]
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
