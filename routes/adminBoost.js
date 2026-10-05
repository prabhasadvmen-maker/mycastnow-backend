import express from 'express';
import ProfileBoost from '../models/ProfileBoost.js';
import BoostPlan from '../models/BoostPlan.js';
import Creator from '../models/Creator.js';

const router = express.Router();

// Seed initial plans if none exist
const DEFAULT_PLANS = [
  {
    name: 'Starter Spotlight',
    tagline: 'Get fast exposure for upcoming audition cycles',
    badge: 'Quick Boost',
    durationDays: 3,
    price: 499,
    originalPrice: 699,
    features: [
      'Top 5 ranking in Casting Search',
      'Boost badge on Creator Profile',
      'Push notification to 50+ casting directors',
      'Analytics & View counter tracking'
    ],
    priorityScore: 15,
    isPopular: false,
    isActive: true
  },
  {
    name: 'Pro Visibility',
    tagline: 'Ideal for active models, actors and creators',
    badge: 'Most Popular',
    durationDays: 7,
    price: 999,
    originalPrice: 1499,
    features: [
      'Featured on App & Web Home Screen',
      'Guaranteed Top 3 in your Category',
      'Gold Star Verified Boost Badge',
      'Direct casting director shortlist priority',
      '3x more booking inquiries'
    ],
    priorityScore: 30,
    isPopular: true,
    isActive: true
  },
  {
    name: 'Superstar VIP',
    tagline: 'Full month high-priority celebrity & talent placement',
    badge: 'Best Value',
    durationDays: 30,
    price: 2999,
    originalPrice: 4999,
    features: [
      '#1 Top Ranking in all casting searches',
      'Spotlight Banner across entire platform',
      'Direct WhatsApp alert to verified casting houses',
      'VIP badge with dedicated audition manager support',
      'Maximum profile impressions & viral reach'
    ],
    priorityScore: 50,
    isPopular: false,
    isActive: true
  }
];

// Helper to seed plans if collection is empty
async function ensurePlansSeeded() {
  const count = await BoostPlan.countDocuments();
  if (count === 0) {
    await BoostPlan.insertMany(DEFAULT_PLANS);
  }
}

// ══════════════════════════════════════════════════════
//  1. STATS: Overview metrics for Superadmin
// ══════════════════════════════════════════════════════
router.get('/stats', async (req, res) => {
  try {
    await ensurePlansSeeded();

    const [
      revenueAgg,
      activeCount,
      totalOrders,
      pendingCount,
      plansCount
    ] = await Promise.all([
      // Total revenue from paid boosts
      ProfileBoost.aggregate([
        { $match: { paymentStatus: 'Paid' } },
        { $group: { _id: null, sum: { $sum: '$amountPaid' } } }
      ]),
      // Active boosts currently live
      ProfileBoost.countDocuments({ status: 'Active', endDate: { $gte: new Date() } }),
      // All orders
      ProfileBoost.countDocuments(),
      // Pending review / approval
      ProfileBoost.countDocuments({ status: 'Pending' }),
      // Total plans
      BoostPlan.countDocuments({ isActive: true })
    ]);

    res.json({
      success: true,
      stats: {
        totalRevenue: revenueAgg[0]?.sum || 0,
        activeBoosts: activeCount,
        totalOrders,
        pendingCount,
        plansCount
      }
    });
  } catch (err) {
    console.error('Boost stats error:', err);
    res.status(500).json({ success: false, message: 'Server Error', error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  2. GET /requests: All Creator Boost Orders & Requests
// ══════════════════════════════════════════════════════
router.get('/requests', async (req, res) => {
  try {
    const { status, search, limit = 100 } = req.query;
    const filter = {};

    if (status && status !== 'All') {
      filter.status = status;
    }

    let boosts = await ProfileBoost.find(filter)
      .populate('creator', 'basicDetails professionalDetails phone email')
      .populate('plan', 'name badge price durationDays')
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    if (search) {
      const q = search.toLowerCase();
      boosts = boosts.filter(b =>
        b.creatorName?.toLowerCase().includes(q) ||
        b.creatorPhone?.toLowerCase().includes(q) ||
        b.creatorCategory?.toLowerCase().includes(q) ||
        b.planName?.toLowerCase().includes(q) ||
        b.transactionId?.toLowerCase().includes(q)
      );
    }

    res.json({ success: true, count: boosts.length, data: boosts });
  } catch (err) {
    console.error('Boost requests fetch error:', err);
    res.status(500).json({ success: false, message: 'Server Error', error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  3. POST /manual-boost: Admin manually activates boost
// ══════════════════════════════════════════════════════
router.post('/manual-boost', async (req, res) => {
  try {
    const {
      creatorId,
      planId,
      customDays,
      amountCharged = 0,
      paymentMethod = 'Admin Free',
      paymentStatus = 'Paid',
      notes = ''
    } = req.body;

    if (!creatorId) {
      return res.status(400).json({ success: false, message: 'Creator selection is required' });
    }

    const creator = await Creator.findById(creatorId);
    if (!creator) {
      return res.status(404).json({ success: false, message: 'Creator not found' });
    }

    let days = Number(customDays) || 7;
    let planName = 'Custom Admin Boost';
    let planDoc = null;

    if (planId) {
      planDoc = await BoostPlan.findById(planId);
      if (planDoc) {
        days = planDoc.durationDays;
        planName = planDoc.name;
      }
    }

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);
    const txId = `BST-${Date.now().toString().slice(-6)}`;

    const newBoost = new ProfileBoost({
      creator: creator._id,
      creatorName: creator.basicDetails?.fullName || 'Creator ' + creator.phone?.slice(-4),
      creatorPhone: creator.phone || '',
      creatorCategory: creator.professionalDetails?.primaryCategory || 'Artist',
      creatorPhoto: creator.basicDetails?.profilePhoto || '',
      plan: planDoc ? planDoc._id : null,
      planName,
      durationDays: days,
      amountPaid: Number(amountCharged),
      currency: 'INR',
      paymentStatus,
      paymentMethod,
      transactionId: txId,
      status: 'Active',
      startDate,
      endDate,
      adminNotes: notes || 'Boost granted by Superadmin'
    });

    const saved = await newBoost.save();
    res.status(201).json({ success: true, message: 'Creator profile boosted successfully!', data: saved });
  } catch (err) {
    console.error('Manual boost error:', err);
    res.status(500).json({ success: false, message: 'Server Error', error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  4. PUT /requests/:id/status: Approve/Activate/Expire/Extend
// ══════════════════════════════════════════════════════
router.put('/requests/:id/status', async (req, res) => {
  try {
    const { status, extendDays, notes } = req.body;
    const boost = await ProfileBoost.findById(req.params.id);
    if (!boost) {
      return res.status(404).json({ success: false, message: 'Boost record not found' });
    }

    if (status) boost.status = status;
    if (notes !== undefined) boost.adminNotes = notes;

    if (extendDays && Number(extendDays) > 0) {
      const currentEnd = new Date(boost.endDate) > new Date() ? new Date(boost.endDate) : new Date();
      boost.endDate = new Date(currentEnd.getTime() + Number(extendDays) * 24 * 60 * 60 * 1000);
      boost.durationDays += Number(extendDays);
      boost.status = 'Active';
    }

    const updated = await boost.save();
    res.json({ success: true, message: 'Boost status updated successfully', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server Error', error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  5. DELETE /requests/:id: Delete boost
// ══════════════════════════════════════════════════════
router.delete('/requests/:id', async (req, res) => {
  try {
    const deleted = await ProfileBoost.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Boost order deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server Error', error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  6. BOOST PLANS CRUD: Manage pricing packages
// ══════════════════════════════════════════════════════
router.get('/plans', async (req, res) => {
  try {
    await ensurePlansSeeded();
    const plans = await BoostPlan.find().sort({ price: 1 });
    res.json({ success: true, data: plans });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server Error', error: err.message });
  }
});

router.post('/plans', async (req, res) => {
  try {
    const { name, tagline, badge, durationDays, price, originalPrice, features, priorityScore, isPopular } = req.body;
    if (!name || !durationDays || price === undefined) {
      return res.status(400).json({ success: false, message: 'Name, duration, and price are required' });
    }

    const newPlan = new BoostPlan({
      name,
      tagline: tagline || 'Get 3x more casting opportunities',
      badge: badge || '',
      durationDays: Number(durationDays),
      price: Number(price),
      originalPrice: Number(originalPrice || price),
      features: Array.isArray(features) ? features : (features ? features.split(',').map(f => f.trim()) : []),
      priorityScore: Number(priorityScore || 10),
      isPopular: Boolean(isPopular),
      isActive: true
    });

    const saved = await newPlan.save();
    res.status(201).json({ success: true, message: 'Boost plan created successfully', data: saved });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server Error', error: err.message });
  }
});

router.put('/plans/:id', async (req, res) => {
  try {
    const updated = await BoostPlan.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { returnDocument: 'after', runValidators: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Plan not found' });
    res.json({ success: true, message: 'Plan updated successfully', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server Error', error: err.message });
  }
});

router.delete('/plans/:id', async (req, res) => {
  try {
    const deleted = await BoostPlan.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Plan not found' });
    res.json({ success: true, message: 'Plan deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server Error', error: err.message });
  }
});

export default router;
