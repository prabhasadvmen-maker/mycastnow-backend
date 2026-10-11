import express from 'express';
import Creator from '../models/Creator.js';
import Company from '../models/Company.js';
import Casting from '../models/Casting.js';
import Booking from '../models/Booking.js';
import SubscriptionPlan from '../models/SubscriptionPlan.js';
import UserSubscription from '../models/UserSubscription.js';
import ProfileBoost from '../models/ProfileBoost.js';
import Review from '../models/Review.js';
import Payment from '../models/Payment.js';
import logger from '../config/logger.js';

const router = express.Router();

// ══════════════════════════════════════════════════════
//  GET /overview — Complete Multi-Dimensional Platform Analytics
// ══════════════════════════════════════════════════════
router.get('/overview', async (req, res) => {
  try {
    const [
      // Revenue streams
      onboardingPaidAgg,
      bookingPaidAgg,
      subscriptionPaidAgg,
      boostPaidAgg,
      // User counts
      creatorsCount,
      approvedCreatorsCount,
      pendingCreatorsCount,
      companiesCount,
      // Casting metrics
      castingsCount,
      openCastingsCount,
      castingApplicantsAgg,
      // Bookings metrics
      bookingsCount,
      completedBookingsCount,
      confirmedBookingsCount,
      // Subscription metrics
      activeSubsCount,
      allPlans,
      allUserSubs,
      // Boost metrics
      activeBoostsCount,
      boostImpressionsAgg,
      // Review metrics
      reviewsCount,
      ratingAgg,
      c2cRatingAgg,
      cr2cRatingAgg,
      starDistribution,
      // Creator categories
      categoryAgg,
    ] = await Promise.all([
      // Onboarding Revenue
      Payment.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: null, sum: { $sum: '$amount' } } }
      ]),
      // Bookings Revenue
      Booking.aggregate([
        { $match: { paymentStatus: 'Paid' } },
        { $group: { _id: null, sum: { $sum: '$amount' } } }
      ]),
      // Subscriptions Revenue
      UserSubscription.aggregate([
        { $match: { amountPaid: { $gt: 0 } } },
        { $group: { _id: null, sum: { $sum: '$amountPaid' } } }
      ]),
      // Boost Revenue
      ProfileBoost.aggregate([
        { $match: { paymentStatus: 'Paid' } },
        { $group: { _id: null, sum: { $sum: '$amountPaid' } } }
      ]),
      // Creators
      Creator.countDocuments(),
      Creator.countDocuments({ status: 'approved' }),
      Creator.countDocuments({ status: 'pending' }),

      // Companies
      Company.countDocuments(),

      // Castings
      Casting.countDocuments(),
      Casting.countDocuments({ status: 'Open' }),
      Casting.aggregate([
        { $group: { _id: null, totalApplicants: { $sum: '$applicantsCount' } } }
      ]),

      // Bookings
      Booking.countDocuments(),
      Booking.countDocuments({ status: 'Completed' }),
      Booking.countDocuments({ status: 'Confirmed' }),

      // Subscriptions
      UserSubscription.countDocuments({ status: 'Active' }),
      SubscriptionPlan.find({}).sort({ sortOrder: 1, createdAt: 1 }).lean(),
      UserSubscription.find({}).populate('plan', 'name badgeColor monthlyPrice yearlyPrice').sort({ createdAt: -1 }).lean(),

      // Boosts
      ProfileBoost.countDocuments({ status: 'Active', endDate: { $gte: new Date() } }),
      ProfileBoost.aggregate([
        { $group: { _id: null, totalImpressions: { $sum: '$impressions' }, totalClicks: { $sum: '$clicks' } } }
      ]),

      // Reviews
      Review.countDocuments(),
      Review.aggregate([{ $group: { _id: null, avg: { $avg: '$rating' } } }]),
      Review.aggregate([{ $match: { reviewType: 'CompanyToCreator' } }, { $group: { _id: null, avg: { $avg: '$rating' } } }]),
      Review.aggregate([{ $match: { reviewType: 'CreatorToCompany' } }, { $group: { _id: null, avg: { $avg: '$rating' } } }]),
      Review.aggregate([{ $group: { _id: '$rating', count: { $sum: 1 } } }]),

      // Creator categories distribution
      Creator.aggregate([
        { $group: { _id: '$professionalDetails.primaryCategory', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
    ]);

    // Financial calculations
    const onboardingRevenue   = onboardingPaidAgg[0]?.sum || 0;
    const bookingRevenue      = bookingPaidAgg[0]?.sum || 0;
    const subscriptionRevenue = subscriptionPaidAgg[0]?.sum || 0;
    const boostRevenue        = boostPaidAgg[0]?.sum || 0;
    const grossRevenue        = onboardingRevenue + bookingRevenue + subscriptionRevenue + boostRevenue;
    const netRetained         = grossRevenue;

    // Subscription deep-dive details
    const enrichedPlans = allPlans.map(p => {
      const planSubs = allUserSubs.filter(us => us.plan && us.plan._id?.toString() === p._id.toString());
      const activeSubs = planSubs.filter(s => s.status === 'Active');
      const totalEarned = planSubs.reduce((acc, curr) => acc + (curr.amountPaid || 0), 0);
      return {
        _id: p._id,
        name: p.name,
        targetAudience: p.targetAudience,
        monthlyPrice: p.monthlyPrice,
        yearlyPrice: p.yearlyPrice,
        badgeColor: p.badgeColor || 'blue',
        activeSubscriberCount: activeSubs.length,
        totalSubscriberCount: planSubs.length,
        totalEarned
      };
    });

    const monthlyCycleCount = allUserSubs.filter(s => s.billingCycle === 'Monthly').length;
    const yearlyCycleCount  = allUserSubs.filter(s => s.billingCycle === 'Yearly').length;

    // Stars formatting
    const starMap = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    starDistribution.forEach(s => {
      if (s._id >= 1 && s._id <= 5) starMap[s._id] = s.count;
    });

    // Real Monthly Performance Trends for last 6 months
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const revenueTrend = [];

    // Aggregate payments by month
    const monthlyPaymentAgg = await Payment.aggregate([
      { $match: { status: 'paid' } },
      {
        $group: {
          _id: {
            year: { $year: { $ifNull: ['$paidAt', '$createdAt'] } },
            month: { $month: { $ifNull: ['$paidAt', '$createdAt'] } }
          },
          revenue: { $sum: '$amount' }
        }
      }
    ]);

    const paymentMap = {};
    monthlyPaymentAgg.forEach(m => {
      if (m._id?.year && m._id?.month) {
        paymentMap[`${m._id.year}-${m._id.month}`] = m.revenue || 0;
      }
    });

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const isCurrent = i === 0;
      const key = `${y}-${m}`;
      const rev = paymentMap[key] || (isCurrent ? grossRevenue : 0);

      revenueTrend.push({
        month: isCurrent ? `${monthNames[d.getMonth()]} (Current)` : monthNames[d.getMonth()],
        revenue: rev,
        bookings: isCurrent ? bookingsCount : 0,
        users: isCurrent ? (creatorsCount + companiesCount) : 0
      });
    }

    res.json({
      success: true,
      analytics: {
        // High-level KPIs
        kpis: {
          grossRevenue,
          netRetained,
          totalUsers: creatorsCount + companiesCount,
          totalCreators: creatorsCount,
          approvedCreators: approvedCreatorsCount,
          pendingCreators: pendingCreatorsCount,
          totalCompanies: companiesCount,
          totalCastings: castingsCount,
          openCastings: openCastingsCount,
          totalApplicants: castingApplicantsAgg[0]?.totalApplicants || 0,
          totalBookings: bookingsCount,
          completedBookings: completedBookingsCount,
          confirmedBookings: confirmedBookingsCount,
          activeSubscriptions: activeSubsCount,
          activeBoosts: activeBoostsCount,
          boostImpressions: boostImpressionsAgg[0]?.totalImpressions || 0,
          boostClicks: boostImpressionsAgg[0]?.totalClicks || 0,
          totalReviews: reviewsCount,
          averageRating: ratingAgg[0]?.avg ? Number(ratingAgg[0].avg.toFixed(1)) : 0,
          avgCompanyToCreator: c2cRatingAgg[0]?.avg ? Number(c2cRatingAgg[0].avg.toFixed(1)) : 0,
          avgCreatorToCompany: cr2cRatingAgg[0]?.avg ? Number(cr2cRatingAgg[0].avg.toFixed(1)) : 0
        },

        // Dedicated Real Subscription Analytics
        subscriptionAnalytics: {
          totalRevenue: subscriptionRevenue,
          activeCount: activeSubsCount,
          totalSubscribers: allUserSubs.length,
          monthlyCycleCount,
          yearlyCycleCount,
          plans: enrichedPlans,
          subscribers: allUserSubs.map(s => ({
            id: s._id,
            userName: s.userName || 'Subscriber',
            userType: s.userType,
            userContact: s.userContact || '-',
            planName: s.plan?.name || 'Membership Plan',
            badgeColor: s.plan?.badgeColor || 'purple',
            billingCycle: s.billingCycle,
            amountPaid: s.amountPaid,
            startDate: s.startDate,
            endDate: s.endDate,
            status: s.status,
            paymentId: s.paymentId || '-'
          }))
        },

        // Revenue Breakdown by actual streams
        revenueStreams: [
          { name: 'Creator Onboarding', amount: onboardingRevenue, color: '#8b5cf6', percent: grossRevenue > 0 ? Math.round((onboardingRevenue / grossRevenue) * 100) : 0 },
          { name: 'Bookings Volume', amount: bookingRevenue, color: '#3b82f6', percent: grossRevenue > 0 ? Math.round((bookingRevenue / grossRevenue) * 100) : 0 },
          { name: 'Subscriptions', amount: subscriptionRevenue, color: '#ec4899', percent: grossRevenue > 0 ? Math.round((subscriptionRevenue / grossRevenue) * 100) : 0 },
          { name: 'Profile Boosts', amount: boostRevenue, color: '#f59e0b', percent: grossRevenue > 0 ? Math.round((boostRevenue / grossRevenue) * 100) : 0 }
        ],

        // Talent Pool Categories
        categories: categoryAgg.map(c => ({
          category: c._id || 'Actor',
          count: c.count
        })),

        // Stars Breakdown
        starRatings: starMap,

        // Monthly Timeline
        revenueTrend
      }
    });

  } catch (err) {
    logger.error('Analytics overview error:', err);
    res.status(500).json({ success: false, message: 'Server Error', error: err.message });
  }
});

export default router;
