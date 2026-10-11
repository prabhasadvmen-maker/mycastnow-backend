import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { requireCreator, requireAdmin } from '../middleware/auth.js';
import Creator from '../models/Creator.js';
import Payment from '../models/Payment.js';
import logger from '../config/logger.js';

const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const ONBOARDING_FEE = Number(process.env.CREATOR_ONBOARDING_FEE) || 499;

// Helper: sync any legacy creator onboarding payments to Payment collection
export async function syncLegacyPayments() {
  try {
    const paidCreators = await Creator.find({
      $or: [
        { onboardingFeePaid: true },
        { onboardingPaymentId: { $exists: true, $ne: null, $ne: '' } }
      ]
    });

    for (const c of paidCreators) {
      const paymentId = c.onboardingPaymentId || `legacy_pay_${c._id}`;
      const orderId = c.onboardingOrderId || `legacy_order_${c._id}`;
      const paidAt = c.onboardingPaidAt || c.createdAt || new Date();
      const creatorName = c.basicDetails?.fullName || 'Creator';
      const creatorPhone = c.phone || '';
      const creatorEmail = c.email || '';
      const profilePhoto = c.basicDetails?.profilePhoto || '';

      await Payment.findOneAndUpdate(
        {
          $or: [
            { paymentId: paymentId },
            { creatorId: c._id }
          ]
        },
        {
          $setOnInsert: {
            creatorId: c._id,
            creatorName,
            creatorPhone,
            creatorEmail,
            profilePhoto,
            basicDetails: {
              fullName: creatorName,
              profilePhoto
            },
            phone: creatorPhone,
            email: creatorEmail,
            amount: ONBOARDING_FEE,
            currency: 'INR',
            paymentType: 'onboarding_fee',
            orderId: orderId,
            paymentId: paymentId,
            onboardingPaymentId: paymentId,
            onboardingOrderId: orderId,
            onboardingPaidAt: paidAt,
            status: 'paid',
            paidAt: paidAt,
            isCreatorDeleted: false
          }
        },
        { upsert: true }
      );
    }
  } catch (err) {
    logger.error('Error syncing legacy payments:', err);
  }
}

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

    const creator = await Creator.findById(req.user.id);
    if (!creator) {
      return res.status(404).json({ success: false, message: 'Creator not found' });
    }

    const paidAt = new Date();

    // 1. Update Creator document
    creator.onboardingFeePaid = true;
    creator.onboardingPaymentId = razorpay_payment_id;
    creator.onboardingOrderId = razorpay_order_id;
    creator.onboardingPaidAt = paidAt;
    await creator.save();

    // 2. Permanently record in Payment collection (ledger)
    const creatorName = creator.basicDetails?.fullName || 'Creator';
    const creatorPhone = creator.phone || '';
    const creatorEmail = creator.email || '';
    const profilePhoto = creator.basicDetails?.profilePhoto || '';

    await Payment.findOneAndUpdate(
      { paymentId: razorpay_payment_id },
      {
        $set: {
          creatorId: creator._id,
          creatorName,
          creatorPhone,
          creatorEmail,
          profilePhoto,
          basicDetails: {
            fullName: creatorName,
            profilePhoto
          },
          phone: creatorPhone,
          email: creatorEmail,
          amount: ONBOARDING_FEE,
          currency: 'INR',
          paymentType: 'onboarding_fee',
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
          signature: razorpay_signature,
          onboardingPaymentId: razorpay_payment_id,
          onboardingOrderId: razorpay_order_id,
          onboardingPaidAt: paidAt,
          status: 'paid',
          paidAt: paidAt,
          isCreatorDeleted: false
        }
      },
      { upsert: true, new: true }
    );

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

// GET /api/payments/admin/all  (admin only - permanent financial records)
router.get('/admin/all', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const skip = (pageNum - 1) * limitNum;

    // Self-healing: if Payment collection has no records yet, sync existing legacy paid creators
    const initialCount = await Payment.countDocuments();
    if (initialCount === 0) {
      await syncLegacyPayments();
    }

    const query = { status: 'paid' };
    if (search && search.trim()) {
      const q = search.trim();
      query.$or = [
        { 'basicDetails.fullName': { $regex: q, $options: 'i' } },
        { creatorName: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
        { creatorPhone: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { creatorEmail: { $regex: q, $options: 'i' } },
        { paymentId: { $regex: q, $options: 'i' } },
        { onboardingPaymentId: { $regex: q, $options: 'i' } },
        { orderId: { $regex: q, $options: 'i' } },
        { onboardingOrderId: { $regex: q, $options: 'i' } }
      ];
    }

    const [payments, total, revenueAgg] = await Promise.all([
      Payment.find(query)
        .sort({ paidAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Payment.countDocuments(query),
      Payment.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: null, totalRevenue: { $sum: '$amount' } } }
      ])
    ]);

    const totalRevenue = revenueAgg[0]?.totalRevenue || (total * ONBOARDING_FEE);

    res.json({
      success: true,
      payments,
      total,
      totalRevenue,
      fee: ONBOARDING_FEE
    });
  } catch (err) {
    logger.error('Admin payments fetch error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch payments' });
  }
});

export default router;
