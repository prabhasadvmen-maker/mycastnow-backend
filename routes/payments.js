import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import SystemSettings from '../models/SystemSettings.js';
import Creator from '../models/Creator.js';
import Company from '../models/Company.js';
import CompanyPaymentHistory from '../models/CompanyPaymentHistory.js';
import Coupon from '../models/Coupon.js';
import logger from '../config/logger.js';
import { requireCreator } from '../middleware/auth.js';

const router = express.Router();

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Migrate legacy company payments from Company collection to CompanyPaymentHistory
const migrateCompanyPayments = async () => {
  try {
    // Check if migration already done
    const historyCount = await CompanyPaymentHistory.countDocuments();
    if (historyCount > 0) {
      logger.info('Company payments already migrated');
      return;
    }

    // Get all companies with payment data
    const companies = await Company.find({
      registrationPaymentId: { $exists: true, $ne: null }
    }).lean();

    if (companies.length === 0) {
      logger.info('No legacy company payments to migrate');
      return;
    }

    // Migrate each company's payment to history
    const paymentRecords = companies.map(c => ({
      companyId: c._id,
      companyName: c.name,
      email: c.email,
      registrationPaymentId: c.registrationPaymentId,
      registrationOrderId: c.registrationOrderId || null,
      registrationFee: c.registrationFee || 0,
      registrationPaidAt: c.registrationPaidAt || new Date(),
      couponCode: null,
      discountAmount: 0,
      status: 'completed',
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    }));

    await CompanyPaymentHistory.insertMany(paymentRecords);
    logger.info(`Migrated ${paymentRecords.length} company payments to history`);
  } catch (error) {
    logger.error('Error migrating company payments:', error);
  }
};

// Run migration on startup
migrateCompanyPayments();

// Sync legacy payments (placeholder function)
export const syncLegacyPayments = async () => {
  // This function can be used to migrate legacy payment data if needed
  return Promise.resolve();
};

// GET /admin/all - Get all creator onboarding payments
router.get('/admin/all', async (req, res) => {
  try {
    const { search = '', page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Get system settings for fee
    const settings = await SystemSettings.findOne();
    const fee = settings?.creatorOnboardingFee || 99;

    // Build search query
    const searchQuery = search ? {
      $or: [
        { 'basicDetails.fullName': { $regex: search, $options: 'i' } },
        { 'basicDetails.phone': { $regex: search, $options: 'i' } },
        { 'onboardingPaymentId': { $regex: search, $options: 'i' } }
      ]
    } : {};

    // Get total count
    const total = await Creator.countDocuments(searchQuery);

    // Get payments data
    const payments = await Creator.find(searchQuery)
      .select('basicDetails phone onboardingPaymentId onboardingPaidAt onboardingFee isProfileComplete')
      .sort({ onboardingPaidAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // Calculate stats
    const allPayments = await Creator.find()
      .select('onboardingPaymentId onboardingFee onboardingPaidAt')
      .lean();

    const paidCount = allPayments.filter(p => p.onboardingPaymentId && !p.onboardingPaymentId.startsWith('free_')).length;
    const freeCount = allPayments.filter(p => !p.onboardingPaymentId || p.onboardingPaymentId.startsWith('free_')).length;
    const totalRevenue = allPayments.reduce((sum, p) => {
      if (p.onboardingPaymentId && !p.onboardingPaymentId.startsWith('free_')) {
        return sum + (p.onboardingFee || fee);
      }
      return sum;
    }, 0);

    res.json({
      success: true,
      payments: payments.map(p => ({
        _id: p._id,
        creatorName: p.basicDetails?.fullName || 'N/A',
        phone: p.basicDetails?.phone || p.phone || '—',
        profilePhoto: p.basicDetails?.profilePhoto,
        paymentId: p.onboardingPaymentId || 'free_onboarding',
        amount: p.onboardingFee || fee,
        paidAt: p.onboardingPaidAt,
        isProfileComplete: p.isProfileComplete
      })),
      total,
      paidCount,
      freeCount,
      totalRevenue,
      fee
    });
  } catch (error) {
    logger.error('Get admin payments error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch payments' });
  }
});

// GET /admin/companies - Get all company registration payments
router.get('/admin/companies', async (req, res) => {
  try {
    const { search = '', page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Get system settings for fee
    const settings = await SystemSettings.findOne();
    const fee = settings?.companyRegistrationFee || 199;

    // Build search query
    const searchQuery = search ? {
      $or: [
        { companyName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { 'registrationPaymentId': { $regex: search, $options: 'i' } }
      ]
    } : {};

    // Get total count from payment history
    const total = await CompanyPaymentHistory.countDocuments(searchQuery);

    // Get payments data from payment history
    const payments = await CompanyPaymentHistory.find(searchQuery)
      .select('companyName email registrationPaymentId registrationPaidAt registrationFee')
      .sort({ registrationPaidAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // Calculate stats from payment history
    const allPayments = await CompanyPaymentHistory.find()
      .select('registrationPaymentId registrationFee registrationPaidAt')
      .lean();

    const paidCount = allPayments.filter(p => p.registrationPaymentId && !p.registrationPaymentId.startsWith('free_')).length;
    const totalRevenue = allPayments.reduce((sum, p) => {
      if (p.registrationPaymentId && !p.registrationPaymentId.startsWith('free_')) {
        return sum + (p.registrationFee || fee);
      }
      return sum;
    }, 0);

    res.json({
      success: true,
      payments: payments.map(p => ({
        _id: p._id,
        companyName: p.companyName || 'N/A',
        email: p.email || '—',
        paymentId: p.registrationPaymentId || 'free_registration',
        amount: p.registrationFee !== undefined ? p.registrationFee : 0,
        paidAt: p.registrationPaidAt,
        isApproved: null
      })),
      total,
      paidCount,
      totalRevenue,
      fee
    });
  } catch (error) {
    logger.error('Get company payments error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch company payments' });
  }
});

// POST /create-order - Create Razorpay order for company registration
router.post('/create-order', async (req, res) => {
  try {
    const { email, companyName, amount } = req.body;

    if (!email || !companyName || !amount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email, company name, and amount are required' 
      });
    }

    // Verify amount matches system settings
    const settings = await SystemSettings.findOne();
    const registrationFee = settings?.companyRegistrationFee || 199;

    if (Number(amount) !== Number(registrationFee)) {
      return res.status(400).json({ 
        success: false, 
        message: `Amount mismatch. Expected ₹${registrationFee}, got ₹${amount}` 
      });
    }

    // Create Razorpay order
    const options = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: 'INR',
      receipt: `company-${Date.now()}`,
      notes: {
        email,
        companyName,
        type: 'company_registration'
      }
    };

    const order = await razorpay.orders.create(options);

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    logger.error('Create order error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create payment order' 
    });
  }
});

// POST /verify-payment - Verify Razorpay payment
router.post('/verify-payment', async (req, res) => {
  try {
    const { orderId, paymentId, signature } = req.body;

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ 
        success: false, 
        message: 'Order ID, Payment ID, and Signature are required' 
      });
    }

    // Verify signature
    const body = orderId + '|' + paymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== signature) {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment verification failed' 
      });
    }

    // Payment verified successfully
    res.json({
      success: true,
      message: 'Payment verified successfully',
      paymentId,
      orderId
    });
  } catch (error) {
    logger.error('Verify payment error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to verify payment' 
    });
  }
});

// ── Creator onboarding fee ───────────────────────────────────────────────────

const getOnboardingFeeConfig = async () => {
  const settings = await SystemSettings.findOne();
  const fee = Number(settings?.creatorOnboardingFee ?? 99);
  const enabled = settings?.creatorOnboardingFeeEnabled !== false;
  return { fee, enabled, isFree: !enabled || fee === 0 };
};

// Returns the discount for a creator coupon, or { error } if it can't be applied
const resolveCreatorCoupon = async (code, amount) => {
  const coupon = await Coupon.findOne({ code: String(code).trim().toUpperCase(), isActive: true });
  if (!coupon) return { status: 404, error: 'Coupon code not found or inactive' };
  if (new Date(coupon.expiryDate) < new Date()) return { status: 400, error: 'Coupon has expired' };
  if (coupon.applicableTo !== 'Both' && coupon.applicableTo !== 'Creator') {
    return { status: 400, error: `This coupon is only applicable for ${coupon.applicableTo}s` };
  }
  if (coupon.usedCount >= coupon.maxUses) return { status: 400, error: 'Coupon usage limit reached' };
  if (coupon.minAmount > 0 && amount < coupon.minAmount) {
    return { status: 400, error: `Minimum purchase amount of ₹${coupon.minAmount} required for this coupon` };
  }
  const raw = coupon.discountType === 'percentage'
    ? Math.round((amount * coupon.discountValue) / 100)
    : coupon.discountValue;
  const discountAmount = Math.min(raw, amount);
  return { coupon, discountAmount, finalAmount: Math.max(0, amount - discountAmount) };
};

const markCouponUsed = async (coupon, creatorId, orderId, discountAmount) => {
  await Coupon.updateOne(
    { _id: coupon._id },
    {
      $inc: { usedCount: 1 },
      $push: { usedBy: { userId: String(creatorId), userType: 'Creator', orderId, discountAmount } }
    }
  );
};

const markOnboardingPaid = (creatorId, fields) =>
  Creator.findByIdAndUpdate(creatorId, {
    $set: { onboardingFeePaid: true, onboardingPaidAt: new Date(), ...fields }
  });

// GET /razorpay-key - Public key + live onboarding fee config
router.get('/razorpay-key', async (req, res) => {
  try {
    const { fee, enabled, isFree } = await getOnboardingFeeConfig();
    res.json({ success: true, key: process.env.RAZORPAY_KEY_ID, fee, enabled, isFree });
  } catch (error) {
    logger.error('Get razorpay key error:', error);
    res.status(500).json({ success: false, message: 'Failed to load payment configuration' });
  }
});

// POST /validate-coupon - Validate a coupon against the creator onboarding fee
router.post('/validate-coupon', requireCreator, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, message: 'Coupon code is required' });

    const { fee } = await getOnboardingFeeConfig();
    const result = await resolveCreatorCoupon(code, fee);
    if (result.error) return res.status(result.status).json({ success: false, message: result.error });

    const { coupon, discountAmount, finalAmount } = result;
    res.json({
      success: true,
      coupon: {
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue
      },
      discountAmount,
      finalAmount
    });
  } catch (error) {
    logger.error('Validate creator coupon error:', error);
    res.status(500).json({ success: false, message: 'Failed to validate coupon' });
  }
});

// POST /create-onboarding-order - Create Razorpay order for creator onboarding
router.post('/create-onboarding-order', requireCreator, async (req, res) => {
  try {
    const creator = await Creator.findById(req.user.id);
    if (!creator) return res.status(404).json({ success: false, message: 'Creator not found' });
    if (creator.onboardingFeePaid) {
      return res.status(400).json({ success: false, message: 'Onboarding fee already paid' });
    }

    const { fee, isFree } = await getOnboardingFeeConfig();
    const creatorName = creator.basicDetails?.fullName || '';
    const creatorPhone = creator.basicDetails?.phone || creator.phone || '';

    let amount = fee;
    let couponCode;
    if (!isFree && req.body.couponCode) {
      const result = await resolveCreatorCoupon(req.body.couponCode, fee);
      if (result.error) return res.status(result.status).json({ success: false, message: result.error });
      amount = result.finalAmount;
      couponCode = result.coupon.code;
    }

    if (isFree || amount === 0) {
      return res.json({ success: true, isFree: true, couponCode, creatorName, creatorPhone });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `creator-${creator._id}-${Date.now()}`.slice(0, 40),
      notes: { creatorId: String(creator._id), type: 'creator_onboarding', couponCode: couponCode || '' }
    });

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      creatorName,
      creatorPhone
    });
  } catch (error) {
    logger.error('Create onboarding order error:', error);
    res.status(500).json({ success: false, message: 'Failed to create payment order' });
  }
});

// POST /verify-onboarding - Verify Razorpay payment (or free activation) for a creator
router.post('/verify-onboarding', requireCreator, async (req, res) => {
  try {
    const { isFree, couponCode, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const creator = await Creator.findById(req.user.id);
    if (!creator) return res.status(404).json({ success: false, message: 'Creator not found' });
    if (creator.onboardingFeePaid) return res.json({ success: true, message: 'Already paid' });

    const { fee, isFree: feeIsFree } = await getOnboardingFeeConfig();

    if (isFree) {
      // Server decides whether free is legitimate: fee waived, or a coupon covers it fully
      let coupon;
      let discountAmount = 0;
      if (!feeIsFree) {
        const result = couponCode ? await resolveCreatorCoupon(couponCode, fee) : null;
        if (!result || result.error || result.finalAmount > 0) {
          return res.status(400).json({ success: false, message: 'Payment is required' });
        }
        coupon = result.coupon;
        discountAmount = result.discountAmount;
      }
      const freeId = `free_${coupon ? coupon.code : 'activation'}_${creator._id}`;
      await markOnboardingPaid(creator._id, {
        onboardingPaymentId: freeId,
        onboardingFee: 0
      });
      if (coupon) await markCouponUsed(coupon, creator._id, freeId, discountAmount);
      return res.json({ success: true, message: 'Onboarding activated' });
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Order ID, Payment ID, and Signature are required' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    const order = await razorpay.orders.fetch(razorpay_order_id);
    if (order.notes?.creatorId !== String(creator._id)) {
      return res.status(400).json({ success: false, message: 'Order does not belong to this account' });
    }

    await markOnboardingPaid(creator._id, {
      onboardingPaymentId: razorpay_payment_id,
      onboardingOrderId: razorpay_order_id,
      onboardingFee: order.amount / 100
    });

    if (order.notes?.couponCode) {
      const coupon = await Coupon.findOne({ code: order.notes.couponCode });
      if (coupon) await markCouponUsed(coupon, creator._id, razorpay_order_id, Math.max(0, fee - order.amount / 100));
    }

    res.json({ success: true, message: 'Payment verified successfully' });
  } catch (error) {
    logger.error('Verify onboarding error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify payment' });
  }
});

export default router;
