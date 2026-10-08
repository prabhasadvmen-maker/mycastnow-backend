import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { requireCreator, requireAdmin } from '../middleware/auth.js';
import Creator from '../models/Creator.js';
import logger from '../config/logger.js';

const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const ONBOARDING_FEE = Number(process.env.CREATOR_ONBOARDING_FEE) || 499;

// GET /api/payments/razorpay-key (public - frontend needs key_id only)
router.get('/razorpay-key', (req, res) => {
  res.json({ key: process.env.RAZORPAY_KEY_ID });
});

// POST /api/payments/create-onboarding-order
router.post('/create-onboarding-order', requireCreator, async (req, res) => {
  try {
    const creator = await Creator.findById(req.user.id);
    if (!creator) return res.status(404).json({ success: false, message: 'Creator not found' });

    if (creator.onboardingFeePaid) {
      return res.status(400).json({ success: false, message: 'Onboarding fee already paid' });
    }

    const order = await razorpay.orders.create({
      amount: ONBOARDING_FEE * 100, // paise
      currency: 'INR',
      receipt: `onboard_${creator._id}_${Date.now()}`,
      notes: { creatorId: creator._id.toString(), type: 'onboarding_fee' }
    });

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      creatorName: creator.basicDetails?.fullName || '',
      creatorPhone: creator.phone
    });
  } catch (err) {
    logger.error('Create onboarding order error:', err);
    res.status(500).json({ success: false, message: 'Failed to create payment order' });
  }
});

// POST /api/payments/verify-onboarding
router.post('/verify-onboarding', requireCreator, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    await Creator.findByIdAndUpdate(req.user.id, {
      onboardingFeePaid: true,
      onboardingPaymentId: razorpay_payment_id,
      onboardingOrderId: razorpay_order_id,
      onboardingPaidAt: new Date()
    });

    res.json({ success: true, message: 'Payment verified successfully' });
  } catch (err) {
    logger.error('Verify onboarding payment error:', err);
    res.status(500).json({ success: false, message: 'Failed to verify payment' });
  }
});

// GET /api/payments/onboarding-status
router.get('/onboarding-status', requireCreator, async (req, res) => {
  try {
    const creator = await Creator.findById(req.user.id).select('onboardingFeePaid onboardingPaidAt');
    res.json({ success: true, paid: creator?.onboardingFeePaid || false, paidAt: creator?.onboardingPaidAt });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch status' });
  }
});

// GET /api/payments/admin/all  (admin only)
router.get('/admin/all', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const skip = (page - 1) * limit;

    const query = { onboardingFeePaid: true };
    if (search) {
      query.$or = [
        { 'basicDetails.fullName': { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const [payments, total] = await Promise.all([
      Creator.find(query)
        .select('basicDetails.fullName basicDetails.profilePhoto phone onboardingPaymentId onboardingOrderId onboardingPaidAt')
        .sort({ onboardingPaidAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Creator.countDocuments(query)
    ]);

    const totalRevenue = total * ONBOARDING_FEE;

    res.json({ success: true, payments, total, totalRevenue, fee: ONBOARDING_FEE });
  } catch (err) {
    logger.error('Admin payments fetch error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch payments' });
  }
});

export default router;
