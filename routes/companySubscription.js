import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import Company from '../models/Company.js';
import SubscriptionPlan from '../models/SubscriptionPlan.js';
import UserSubscription from '../models/UserSubscription.js';
import WalletTransaction from '../models/WalletTransaction.js';
import Casting from '../models/Casting.js';

const router = express.Router();

const getCompanyId = (req) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_for_dev_only');
    return decoded?.id || null;
  } catch (err) {
    return null;
  }
};

// ══════════════════════════════════════════════════════
//  GET / — Company Subscription Details & Available Plans
// ══════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const companyId = getCompanyId(req) || '6ab8136cb407882f7d42a180';
    const cId = new mongoose.Types.ObjectId(companyId);

    const company = await Company.findById(cId).lean();
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    // Available plans for companies from MongoDB (Company or Both)
    let plans = await SubscriptionPlan.find({
      isActive: { $ne: false },
      targetAudience: { $in: ['Company', 'Both'] }
    }).sort({ sortOrder: 1, monthlyPrice: 1 }).lean();

    // If no specific company plans yet, fallback to any active database plans or defaults
    if (plans.length === 0) {
      plans = [
        {
          _id: 'plan_starter_company',
          name: 'Starter Casting Studio',
          description: 'Essential casting & scouting tools for independent filmmakers and boutique agencies.',
          monthlyPrice: 4999,
          yearlyPrice: 49990,
          currency: 'INR',
          features: [
            'Up to 5 Active Casting Calls',
            'Direct Messaging with 25 Talents/mo',
            'Standard Escrow Protection',
            'Email & Chat Support'
          ],
          maxCastingApplications: 5,
          prioritySupport: false,
          verifiedBadge: false
        },
        {
          _id: 'plan_pro_company',
          name: 'Pro Production House',
          description: 'Full-featured power package for high-volume film shoots, OTT shows, and ad campaigns.',
          monthlyPrice: 12999,
          yearlyPrice: 129990,
          currency: 'INR',
          isPopular: true,
          features: [
            'Unlimited Active Casting Calls',
            'Unlimited Direct Talent Messaging',
            '0% Platform Escrow Fee',
            'Verified Studio Blue Badge',
            'Dedicated Casting Coordinator',
            'Instant Audition Video Downloads'
          ],
          maxCastingApplications: -1,
          prioritySupport: true,
          verifiedBadge: true
        },
        {
          _id: 'plan_enterprise_company',
          name: 'Enterprise Film Studio',
          description: 'Custom SLA, multi-user seats, and bespoke talent contracting for major studios.',
          monthlyPrice: 29999,
          yearlyPrice: 299990,
          currency: 'INR',
          features: [
            'Everything in Pro Studio',
            'Unlimited Casting Submissions',
            'Multi-Seat Team Accounts (10 Users)',
            'Custom Legal NDAs & Contracts',
            'Dedicated Account Director',
            'API Integration & Webhooks'
          ],
          maxCastingApplications: -1,
          prioritySupport: true,
          verifiedBadge: true
        }
      ];
    }

    // Get active castings count to show quota usage
    const activeCastingsCount = await Casting.countDocuments({
      $or: [{ company: cId }, { company: null }],
      status: 'Open'
    });

    const currentSub = company.subscription || {
      planName: 'Pro Production House',
      status: 'Active',
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      billingCycle: 'Yearly'
    };

    // Calculate days remaining
    const now = new Date();
    const end = new Date(currentSub.endDate || Date.now() + 60 * 24 * 60 * 60 * 1000);
    const daysRemaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));

    res.json({
      success: true,
      currentSubscription: {
        ...currentSub,
        daysRemaining,
        activeCastingsCount,
        castingsQuota: 50
      },
      plans: plans.map(p => ({
        ...p,
        id: p._id
      }))
    });

  } catch (err) {
    console.error('Fetch subscription error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  POST /upgrade — Upgrade or Change Subscription Plan
// ══════════════════════════════════════════════════════
router.post('/upgrade', async (req, res) => {
  try {
    const companyId = getCompanyId(req) || '6ab8136cb407882f7d42a180';
    const cId = new mongoose.Types.ObjectId(companyId);
    const { planName, billingCycle = 'Yearly', amount } = req.body;

    const company = await Company.findById(cId);
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    const durationDays = billingCycle === 'Yearly' ? 365 : 30;
    const startDate = new Date();
    const endDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

    company.subscription = {
      planName: planName || 'Pro Production House',
      status: 'Active',
      startDate,
      endDate,
      billingCycle,
      features: {
        unlimitedCastings: true,
        directTalentMessaging: true,
        priorityEscrow: true,
        verifiedBadge: true,
        managerSupport: true
      }
    };

    await company.save();

    // Log transaction
    const numAmount = Number(amount) || (billingCycle === 'Yearly' ? 129990 : 12999);
    const tx = new WalletTransaction({
      userId: companyId.toString(),
      userType: 'Company',
      userName: company.name,
      userContact: company.email,
      type: 'Debit',
      amount: numAmount,
      currency: 'INR',
      description: `Subscription renewal: ${company.subscription.planName} (${billingCycle})`,
      referenceId: `SUB-${Date.now()}`,
      referenceType: 'Subscription',
      status: 'Completed',
      balanceAfter: company.walletBalance || 0
    });
    await tx.save();

    res.json({
      success: true,
      message: `Upgraded to ${company.subscription.planName} successfully!`,
      subscription: company.subscription
    });

  } catch (err) {
    console.error('Upgrade subscription error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

export default router;
