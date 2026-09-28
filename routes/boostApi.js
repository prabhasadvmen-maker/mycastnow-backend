import express from 'express';
import BoostPlan from '../models/BoostPlan.js';
import ProfileBoost from '../models/ProfileBoost.js';
import Creator from '../models/Creator.js';

const router = express.Router();

// ══════════════════════════════════════════════════════
//  1. GET /plans — Mobile App: Fetch active boost packages
// ══════════════════════════════════════════════════════
router.get('/plans', async (req, res) => {
  try {
    const plans = await BoostPlan.find({ isActive: true }).sort({ price: 1 });
    res.json({
      success: true,
      count: plans.length,
      data: plans
    });
  } catch (err) {
    console.error('Fetch boost plans API error:', err);
    res.status(500).json({ success: false, message: 'Server Error', error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  2. POST /purchase — Mobile App: Creator purchases a profile boost
// ══════════════════════════════════════════════════════
router.post('/purchase', async (req, res) => {
  try {
    const {
      creatorId,
      planId,
      paymentMethod = 'UPI',
      transactionId = '',
      paymentStatus = 'Paid'
    } = req.body;

    if (!creatorId || !planId) {
      return res.status(400).json({
        success: false,
        message: 'creatorId and planId are required'
      });
    }

    const [creator, plan] = await Promise.all([
      Creator.findById(creatorId),
      BoostPlan.findById(planId)
    ]);

    if (!creator) {
      return res.status(404).json({ success: false, message: 'Creator not found' });
    }
    if (!plan || !plan.isActive) {
      return res.status(404).json({ success: false, message: 'Boost plan not available' });
    }

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);
    const generatedTxId = transactionId || `PAY-BST-${Date.now().toString().slice(-8)}`;

    const boostOrder = new ProfileBoost({
      creator: creator._id,
      creatorName: creator.basicDetails?.fullName || 'Creator ' + creator.phone?.slice(-4),
      creatorPhone: creator.phone || '',
      creatorCategory: creator.professionalDetails?.primaryCategory || 'Artist',
      creatorPhoto: creator.basicDetails?.profilePhoto || '',
      plan: plan._id,
      planName: plan.name,
      durationDays: plan.durationDays,
      amountPaid: plan.price,
      currency: 'INR',
      paymentStatus,
      paymentMethod,
      transactionId: generatedTxId,
      status: paymentStatus === 'Paid' ? 'Active' : 'Pending',
      startDate,
      endDate,
      adminNotes: `Purchased via Mobile App (${paymentMethod})`
    });

    const saved = await boostOrder.save();

    res.status(201).json({
      success: true,
      message: 'Profile boost activated successfully! Your profile will now appear on top.',
      data: saved
    });
  } catch (err) {
    console.error('Purchase boost API error:', err);
    res.status(500).json({ success: false, message: 'Server Error', error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  3. GET /my-boosts/:creatorId — Mobile App: Creator's active/past boosts
// ══════════════════════════════════════════════════════
router.get('/my-boosts/:creatorId', async (req, res) => {
  try {
    const { creatorId } = req.params;
    const boosts = await ProfileBoost.find({ creator: creatorId })
      .populate('plan')
      .sort({ createdAt: -1 });

    const activeBoost = boosts.find(b => b.status === 'Active' && new Date(b.endDate) > new Date());

    res.json({
      success: true,
      hasActiveBoost: Boolean(activeBoost),
      activeBoost: activeBoost || null,
      history: boosts
    });
  } catch (err) {
    console.error('Get my boosts API error:', err);
    res.status(500).json({ success: false, message: 'Server Error', error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  4. GET /featured-creators — Mobile & Web: Public promoted creators
// ══════════════════════════════════════════════════════
router.get('/featured-creators', async (req, res) => {
  try {
    const now = new Date();
    const activeBoosts = await ProfileBoost.find({
      status: 'Active',
      endDate: { $gte: now }
    })
      .populate('creator', 'basicDetails professionalDetails phone email isApproved')
      .populate('plan', 'priorityScore name badge')
      .sort({ 'plan.priorityScore': -1, createdAt: -1 })
      .limit(30);

    const creators = activeBoosts
      .filter(b => b.creator)
      .map(b => ({
        boostId: b._id,
        planName: b.planName,
        badge: b.plan?.badge || 'Featured',
        expiresAt: b.endDate,
        creator: b.creator
      }));

    res.json({
      success: true,
      count: creators.length,
      data: creators
    });
  } catch (err) {
    console.error('Featured creators API error:', err);
    res.status(500).json({ success: false, message: 'Server Error', error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  5. POST /track-view/:boostId — Mobile App: Impression / Click tracker
// ══════════════════════════════════════════════════════
router.post('/track-view/:boostId', async (req, res) => {
  try {
    const { isClick = false } = req.body;
    const update = isClick ? { $inc: { clicks: 1 } } : { $inc: { impressions: 1 } };
    await ProfileBoost.findByIdAndUpdate(req.params.boostId, update);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

export default router;
