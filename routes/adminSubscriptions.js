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
    const plans = await SubscriptionPlan.find().sort({ sortOrder: 1, createdAt: 1 });
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
      { new: true }
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

    const sub = await UserSubscription.findByIdAndUpdate(req.params.id, { $set: update }, { new: true })
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
