import express from 'express';
import SubscriptionPlan from '../models/SubscriptionPlan.js';
import UserSubscription from '../models/UserSubscription.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════
//  SUBSCRIPTION PLANS  (Admin CRUD)
// ═══════════════════════════════════════════════════════

// GET all plans
router.get('/plans', async (req, res) => {
  try {
    let plans = await SubscriptionPlan.find().sort({ sortOrder: 1, createdAt: 1 });
    if (!plans || plans.length === 0) {
      const initialPlans = [
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
      ];
      plans = await SubscriptionPlan.insertMany(initialPlans);
    }
    res.json(plans);
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

// GET plan stats (count of each plan's subscribers)
router.get('/plans/stats', async (req, res) => {
  try {
    const [totalPlans, activePlans, totalSubscribers, activeSubscribers, revenue] = await Promise.all([
      SubscriptionPlan.countDocuments(),
      SubscriptionPlan.countDocuments({ isActive: true }),
      UserSubscription.countDocuments(),
      UserSubscription.countDocuments({ status: 'Active' }),
      UserSubscription.aggregate([
        { $match: { status: { $in: ['Active', 'Expired'] } } },
        { $group: { _id: null, total: { $sum: '$amountPaid' } } }
      ])
    ]);
    res.json({
      totalPlans,
      activePlans,
      totalSubscribers,
      activeSubscribers,
      totalRevenue: revenue[0]?.total || 0
    });
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

// GET single plan
router.get('/plans/:id', async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    res.json(plan);
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

// POST create new plan (Admin only)
router.post('/plans', async (req, res) => {
  try {
    const {
      name, description, targetAudience,
      monthlyPrice, yearlyPrice, currency,
      features, maxCastingApplications, maxPortfolioPhotos,
      maxBookingsPerMonth, prioritySupport, verifiedBadge, featuredListing,
      badgeColor, isPopular, trialDays, isActive, sortOrder
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Plan name is required' });
    }

    const plan = new SubscriptionPlan({
      name: name.trim(),
      description: description || '',
      targetAudience: targetAudience || 'Both',
      monthlyPrice: monthlyPrice || 0,
      yearlyPrice: yearlyPrice || 0,
      currency: currency || 'INR',
      features: Array.isArray(features) ? features.filter(f => f.trim()) : [],
      maxCastingApplications: maxCastingApplications ?? -1,
      maxPortfolioPhotos: maxPortfolioPhotos ?? -1,
      maxBookingsPerMonth: maxBookingsPerMonth ?? -1,
      prioritySupport: prioritySupport || false,
      verifiedBadge: verifiedBadge || false,
      featuredListing: featuredListing || false,
      badgeColor: badgeColor || 'blue',
      isPopular: isPopular || false,
      trialDays: trialDays || 0,
      isActive: isActive !== false,
      sortOrder: sortOrder || 0
    });

    const saved = await plan.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('Create plan error:', err);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

// PUT update plan
router.put('/plans/:id', async (req, res) => {
  try {
    const {
      name, description, targetAudience,
      monthlyPrice, yearlyPrice, currency,
      features, maxCastingApplications, maxPortfolioPhotos,
      maxBookingsPerMonth, prioritySupport, verifiedBadge, featuredListing,
      badgeColor, isPopular, trialDays, isActive, sortOrder
    } = req.body;

    const update = {};
    if (name !== undefined) update.name = name.trim();
    if (description !== undefined) update.description = description;
    if (targetAudience) update.targetAudience = targetAudience;
    if (monthlyPrice !== undefined) update.monthlyPrice = monthlyPrice;
    if (yearlyPrice !== undefined) update.yearlyPrice = yearlyPrice;
    if (currency) update.currency = currency;
    if (Array.isArray(features)) update.features = features.filter(f => f.trim());
    if (maxCastingApplications !== undefined) update.maxCastingApplications = maxCastingApplications;
    if (maxPortfolioPhotos !== undefined) update.maxPortfolioPhotos = maxPortfolioPhotos;
    if (maxBookingsPerMonth !== undefined) update.maxBookingsPerMonth = maxBookingsPerMonth;
    if (prioritySupport !== undefined) update.prioritySupport = prioritySupport;
    if (verifiedBadge !== undefined) update.verifiedBadge = verifiedBadge;
    if (featuredListing !== undefined) update.featuredListing = featuredListing;
    if (badgeColor) update.badgeColor = badgeColor;
    if (isPopular !== undefined) update.isPopular = isPopular;
    if (trialDays !== undefined) update.trialDays = trialDays;
    if (isActive !== undefined) update.isActive = isActive;
    if (sortOrder !== undefined) update.sortOrder = sortOrder;

    const plan = await SubscriptionPlan.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { returnDocument: 'after' }
    );
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    res.json(plan);
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

// PUT toggle active status
router.put('/plans/:id/toggle', async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    plan.isActive = !plan.isActive;
    await plan.save();
    res.json(plan);
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

// DELETE plan
router.delete('/plans/:id', async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findByIdAndDelete(req.params.id);
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    res.json({ success: true, message: 'Plan deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════
//  USER SUBSCRIPTIONS  (Who subscribed to which plan)
// ═══════════════════════════════════════════════════════

// GET all user subscriptions
router.get('/subscribers', async (req, res) => {
  try {
    const { status, planId } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (planId) filter.plan = planId;

    const subs = await UserSubscription.find(filter)
      .populate('plan', 'name badgeColor monthlyPrice yearlyPrice targetAudience')
      .sort({ createdAt: -1 });

    res.json(subs);
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

// POST manually assign plan to a user (Admin action)
router.post('/subscribers', async (req, res) => {
  try {
    const { userId, userType, userName, userContact, plan, billingCycle, amountPaid, startDate, endDate, status, notes } = req.body;

    if (!userId || !userType || !plan || !endDate) {
      return res.status(400).json({ message: 'userId, userType, plan, and endDate are required' });
    }

    const planExists = await SubscriptionPlan.findById(plan);
    if (!planExists) return res.status(404).json({ message: 'Plan not found' });

    const sub = new UserSubscription({
      userId, userType, userName: userName || '', userContact: userContact || '',
      plan, billingCycle: billingCycle || 'Monthly',
      amountPaid: amountPaid || 0,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: new Date(endDate),
      status: status || 'Active',
      notes: notes || ''
    });
    const saved = await sub.save();
    const populated = await UserSubscription.findById(saved._id)
      .populate('plan', 'name badgeColor monthlyPrice yearlyPrice targetAudience');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

// PUT update subscriber status
router.put('/subscribers/:id', async (req, res) => {
  try {
    const { status, endDate, notes } = req.body;
    const update = {};
    if (status) update.status = status;
    if (endDate) update.endDate = new Date(endDate);
    if (notes !== undefined) update.notes = notes;

    const sub = await UserSubscription.findByIdAndUpdate(req.params.id, { $set: update }, { returnDocument: 'after' })
      .populate('plan', 'name badgeColor monthlyPrice yearlyPrice');
    if (!sub) return res.status(404).json({ message: 'Subscription not found' });
    res.json(sub);
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

// DELETE a user subscription
router.delete('/subscribers/:id', async (req, res) => {
  try {
    const sub = await UserSubscription.findByIdAndDelete(req.params.id);
    if (!sub) return res.status(404).json({ message: 'Subscription not found' });
    res.json({ success: true, message: 'Subscription removed' });
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

export default router;
