import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { requireCreator, requireAdmin } from '../middleware/auth.js';
import Creator from '../models/Creator.js';
import Payment from '../models/Payment.js';
import Coupon from '../models/Coupon.js';
import SystemSettings from '../models/SystemSettings.js';
import logger from '../config/logger.js';

const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Helper: fetch dynamic onboarding fee configuration from Superadmin SystemSettings
export async function getDynamicOnboardingFeeConfig() {
  try {
    const settings = await SystemSettings.findOne();
    if (settings) {
      const isEnabled = settings.creatorOnboardingFeeEnabled !== false;
      const fee = isEnabled ? (typeof settings.creatorOnboardingFee === 'number' ? settings.creatorOnboardingFee : 99) : 0;
      return {
        fee,
        isFree: fee === 0 || !isEnabled,
        enabled: isEnabled
      };
    }
  } catch (err) {
    logger.error('Error fetching dynamic onboarding fee:', err);
  }
  const defaultFee = Number(process.env.CREATOR_ONBOARDING_FEE) || 99;
  return { fee: defaultFee, isFree: defaultFee === 0, enabled: true };
}


// Helper: validate a coupon for creator onboarding against a given fee
export async function evaluateCreatorCoupon(rawCode, fee) {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code) return { error: 'Please enter a coupon code', status: 400 };

  const coupon = await Coupon.findOne({ code });
  if (!coupon) return { error: 'Invalid coupon code', status: 404 };
  if (!coupon.isActive) return { error: 'This coupon is no longer active', status: 400 };
  if (new Date(coupon.expiryDate) <= new Date()) return { error: 'This coupon has expired', status: 400 };
  if (coupon.applicableTo !== 'Both' && coupon.applicableTo !== 'Creator') {
    return { error: `This coupon is only applicable to ${coupon.applicableTo}s`, status: 400 };
  }
  if (coupon.usedCount >= coupon.maxUses) return { error: 'This coupon has reached its usage limit', status: 400 };
  if (fee < coupon.minAmount) {
    return { error: `Minimum amount of ₹${coupon.minAmount} required for this coupon`, status: 400 };
  }

  let discount = coupon.discountType === 'percentage'
    ? (fee * coupon.discountValue) / 100
    : coupon.discountValue;
  discount = Math.min(Math.round(discount), fee);

  return { coupon, discountAmount: discount, finalAmount: fee - discount };
}

// Helper: atomically consume one use of a coupon (respects maxUses / expiry / active)
async function consumeCoupon(couponId, creator, orderId, discountAmount) {
  const updated = await Coupon.findOneAndUpdate(
    {
      _id: couponId,
      isActive: true,
      expiryDate: { $gt: new Date() },
      $expr: { $lt: ['$usedCount', '$maxUses'] }
    },
    {
      $inc: { usedCount: 1 },
      $push: {
        usedBy: {
          userId: creator._id.toString(),
          userType: 'Creator',
          usedAt: new Date(),
          orderId,
          discountAmount
        }
      }
    },
    { returnDocument: 'after' }
  );
  return !!updated;
}

// Helper: sync any legacy creator onboarding payments to Payment collection
export async function syncLegacyPayments() {
  try {
    const paidCreators = await Creator.find({
      $or: [
        { onboardingFeePaid: true },
        { onboardingPaymentId: { $exists: true, $ne: null, $ne: '' } }
      ]
    });

    const feeConfig = await getDynamicOnboardingFeeConfig();
    const fallbackFee = feeConfig.fee || Number(process.env.CREATOR_ONBOARDING_FEE) || 99;

    for (const c of paidCreators) {
      const paymentId = c.onboardingPaymentId || `legacy_pay_${c._id}`;
      const orderId = c.onboardingOrderId || `legacy_order_${c._id}`;
      const paidAt = c.onboardingPaidAt || c.createdAt || new Date();
      const creatorName = c.basicDetails?.fullName || 'Creator';
      const creatorPhone = c.phone || '';
      const creatorEmail = c.email || '';
      const profilePhoto = c.basicDetails?.profilePhoto || '';

      const isFree = (paymentId && paymentId.startsWith('free_')) || (orderId && orderId.startsWith('free_'));
      const recordAmount = isFree ? 0 : fallbackFee;

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
            amount: recordAmount,
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

// GET /api/payments/razorpay-key (public - frontend needs key_id and current fee config)
router.get('/razorpay-key', async (req, res) => {
  const feeConfig = await getDynamicOnboardingFeeConfig();
  res.json({
    key: process.env.RAZORPAY_KEY_ID,
    fee: feeConfig.fee,
    isFree: feeConfig.isFree,
    enabled: feeConfig.enabled
  });
});

// POST /api/payments/validate-coupon  (creator checks a coupon before paying)
router.post('/validate-coupon', requireCreator, async (req, res) => {
  try {
    const feeConfig = await getDynamicOnboardingFeeConfig();
    if (feeConfig.isFree || feeConfig.fee === 0) {
      return res.status(400).json({ success: false, message: 'Onboarding is already free, no coupon needed' });
    }
    const result = await evaluateCreatorCoupon(req.body.code, feeConfig.fee);
    if (result.error) return res.status(result.status).json({ success: false, message: result.error });

    res.json({
      success: true,
      coupon: {
        code: result.coupon.code,
        description: result.coupon.description,
        discountType: result.coupon.discountType,
        discountValue: result.coupon.discountValue
      },
      originalAmount: feeConfig.fee,
      discountAmount: result.discountAmount,
      finalAmount: result.finalAmount
    });
  } catch (err) {
    logger.error('Validate coupon error:', err);
    res.status(500).json({ success: false, message: 'Failed to validate coupon' });
  }
});

// POST /api/payments/create-onboarding-order
router.post('/create-onboarding-order', requireCreator, async (req, res) => {
  try {
    const creator = await Creator.findById(req.user.id);
    if (!creator) return res.status(404).json({ success: false, message: 'Creator not found' });

    if (creator.onboardingFeePaid) {
      return res.status(400).json({ success: false, message: 'Onboarding fee already paid' });
    }

    const feeConfig = await getDynamicOnboardingFeeConfig();

    // Optional coupon: recomputed server-side, never trust client amount
    let payable = feeConfig.fee;
    let couponCode = '';
    if (!(feeConfig.isFree || feeConfig.fee === 0) && req.body?.couponCode) {
      const result = await evaluateCreatorCoupon(req.body.couponCode, feeConfig.fee);
      if (result.error) return res.status(result.status).json({ success: false, message: result.error });
      payable = result.finalAmount;
      couponCode = result.coupon.code;
    }

    // 100% coupon -> free activation (verified & consumed in verify-onboarding)
    if (couponCode && payable === 0) {
      return res.json({
        success: true,
        isFree: true,
        couponCode,
        amount: 0,
        currency: 'INR',
        creatorName: creator.basicDetails?.fullName || '',
        creatorPhone: creator.phone
      });
    }

    // If configured as FREE
    if (feeConfig.isFree || feeConfig.fee === 0) {
      return res.json({
        success: true,
        isFree: true,
        amount: 0,
        currency: 'INR',
        creatorName: creator.basicDetails?.fullName || '',
        creatorPhone: creator.phone
      });
    }

    const order = await razorpay.orders.create({
      amount: payable * 100, // paise
      currency: 'INR',
      receipt: `onboard_${creator._id}_${Date.now()}`,
      notes: { creatorId: creator._id.toString(), type: 'onboarding_fee', couponCode }
    });

    res.json({
      success: true,
      isFree: false,
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
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, couponCode } = req.body;
    const feeConfig = await getDynamicOnboardingFeeConfig();

    const creator = await Creator.findById(req.user.id);
    if (!creator) {
      return res.status(404).json({ success: false, message: 'Creator not found' });
    }
    if (creator.onboardingFeePaid) {
      return res.status(400).json({ success: false, message: 'Onboarding fee already paid' });
    }

    const paidAt = new Date();
    const isFeeFree = feeConfig.isFree || feeConfig.fee === 0;

    // Free via 100% coupon (only when no Razorpay payment is being verified)
    let freeCoupon = null;
    let freeCouponDiscount = 0;
    if (!isFeeFree && !razorpay_signature && couponCode) {
      const result = await evaluateCreatorCoupon(couponCode, feeConfig.fee);
      if (result.error) return res.status(result.status).json({ success: false, message: result.error });
      if (result.finalAmount === 0) {
        freeCoupon = result.coupon;
        freeCouponDiscount = result.discountAmount;
      }
    }

    // Free onboarding flow (admin-configured free fee, or 100% coupon)
    if (isFeeFree || freeCoupon) {
      const freePaymentId = `free_${creator._id}_${Date.now()}`;
      const freeOrderId = `free_order_${creator._id}`;

      if (freeCoupon) {
        const consumed = await consumeCoupon(freeCoupon._id, creator, freeOrderId, freeCouponDiscount);
        if (!consumed) {
          return res.status(400).json({ success: false, message: 'This coupon is no longer available' });
        }
      }

      creator.onboardingFeePaid = true;
      creator.onboardingPaymentId = freePaymentId;
      creator.onboardingOrderId = freeOrderId;
      creator.onboardingPaidAt = paidAt;
      await creator.save();

      const creatorName = creator.basicDetails?.fullName || 'Creator';
      const creatorPhone = creator.phone || '';
      const creatorEmail = creator.email || '';
      const profilePhoto = creator.basicDetails?.profilePhoto || '';

      await Payment.findOneAndUpdate(
        { paymentId: freePaymentId },
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
            amount: 0,
            couponCode: freeCoupon ? freeCoupon.code : '',
            discountAmount: freeCouponDiscount,
            currency: 'INR',
            paymentType: 'onboarding_fee',
            orderId: freeOrderId,
            paymentId: freePaymentId,
            onboardingPaymentId: freePaymentId,
            onboardingOrderId: freeOrderId,
            onboardingPaidAt: paidAt,
            status: 'paid',
            paidAt,
            isCreatorDeleted: false
          }
        },
        { upsert: true, returnDocument: 'after' }
      );

      return res.json({ success: true, isFree: true, message: freeCoupon ? 'Coupon applied! Profile activated for free.' : 'Profile activated for free!' });
    }

    // Razorpay signature verification
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    // Read the real order from Razorpay (amount + coupon were fixed at order creation)
    const rzpOrder = await razorpay.orders.fetch(razorpay_order_id);
    if (rzpOrder?.notes?.creatorId && rzpOrder.notes.creatorId !== creator._id.toString()) {
      return res.status(400).json({ success: false, message: 'Order does not belong to this creator' });
    }
    const paidAmount = rzpOrder?.amount ? rzpOrder.amount / 100 : feeConfig.fee;
    const usedCouponCode = rzpOrder?.notes?.couponCode || '';
    let usedDiscount = 0;
    if (usedCouponCode) {
      usedDiscount = Math.max(0, feeConfig.fee - paidAmount);
      const used = await Coupon.findOne({ code: usedCouponCode });
      if (used) {
        const ok = await consumeCoupon(used._id, creator, razorpay_order_id, usedDiscount);
        if (!ok) logger.warn(`Coupon ${usedCouponCode} could not be consumed after payment ${razorpay_payment_id}`);
      }
    }

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
          amount: paidAmount,
          couponCode: usedCouponCode,
          discountAmount: usedDiscount,
          currency: 'INR',
          paymentType: 'onboarding_fee',
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
          signature: razorpay_signature,
          onboardingPaymentId: razorpay_payment_id,
          onboardingOrderId: razorpay_order_id,
          onboardingPaidAt: paidAt,
          status: 'paid',
          paidAt,
          isCreatorDeleted: false
        }
      },
      { upsert: true, returnDocument: 'after' }
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

    const [payments, total, statsAgg] = await Promise.all([
      Payment.find(query)
        .sort({ paidAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Payment.countDocuments(query),
      Payment.aggregate([
        { $match: { status: 'paid' } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' },
            paidCount: {
              $sum: { $cond: [{ $gt: ['$amount', 0] }, 1, 0] }
            },
            freeCount: {
              $sum: { $cond: [{ $lte: ['$amount', 0] }, 1, 0] }
            }
          }
        }
      ])
    ]);

    const feeConfig = await getDynamicOnboardingFeeConfig();
    const statsData = statsAgg[0] || {};
    const totalRevenue = typeof statsData.totalRevenue === 'number' ? statsData.totalRevenue : 0;
    const paidCount = typeof statsData.paidCount === 'number' ? statsData.paidCount : 0;
    const freeCount = typeof statsData.freeCount === 'number' ? statsData.freeCount : 0;

    res.json({
      success: true,
      payments,
      total,
      totalRevenue,
      paidCount,
      freeCount,
      fee: feeConfig.fee
    });
  } catch (err) {
    logger.error('Admin payments fetch error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch payments' });
  }
});

export default router;
