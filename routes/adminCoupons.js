import express from 'express';
import Coupon from '../models/Coupon.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════
//  COUPON CODES - ADMIN CRUD
// ═══════════════════════════════════════════════════════

// GET all coupons with filters
router.get('/', async (req, res) => {
  try {
    const { status, applicableTo, search } = req.query;
    const filter = {};

    // Filter by active status
    if (status === 'active') {
      filter.isActive = true;
      filter.expiryDate = { $gt: new Date() };
    } else if (status === 'expired') {
      filter.$or = [
        { isActive: false },
        { expiryDate: { $lte: new Date() } }
      ];
    }

    // Filter by applicable audience
    if (applicableTo && applicableTo !== 'All') {
      filter.applicableTo = applicableTo;
    }

    // Search by code or description
    if (search) {
      filter.$or = [
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const coupons = await Coupon.find(filter).sort({ createdAt: -1 });
    res.json(coupons);
  } catch (err) {
    console.error('Get coupons error:', err);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

// GET coupon stats
router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const [
      totalCoupons,
      activeCoupons,
      expiredCoupons,
      totalUsed
    ] = await Promise.all([
      Coupon.countDocuments(),
      Coupon.countDocuments({ isActive: true, expiryDate: { $gt: now } }),
      Coupon.countDocuments({
        $or: [
          { isActive: false },
          { expiryDate: { $lte: now } }
        ]
      }),
      Coupon.aggregate([
        { $group: { _id: null, total: { $sum: '$usedCount' } } }
      ])
    ]);

    res.json({
      totalCoupons,
      activeCoupons,
      expiredCoupons,
      totalUsed: totalUsed[0]?.total || 0
    });
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

// GET single coupon
router.get('/:id', async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
    res.json(coupon);
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

// POST create new coupon
router.post('/', async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      applicableTo,
      minAmount,
      maxUses,
      expiryDate,
      isActive
    } = req.body;

    // Validation
    if (!code || !discountType || !discountValue || !maxUses || !expiryDate) {
      return res.status(400).json({
        message: 'Missing required fields: code, discountType, discountValue, maxUses, expiryDate'
      });
    }

    // Check if code already exists
    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      return res.status(400).json({ message: 'Coupon code already exists' });
    }

    // Validate discount value
    if (discountType === 'percentage' && (discountValue < 0 || discountValue > 100)) {
      return res.status(400).json({ message: 'Percentage discount must be between 0 and 100' });
    }

    if (discountType === 'fixed' && discountValue <= 0) {
      return res.status(400).json({ message: 'Fixed discount must be greater than 0' });
    }

    // Validate expiry date
    if (new Date(expiryDate) <= new Date()) {
      return res.status(400).json({ message: 'Expiry date must be in the future' });
    }

    const coupon = new Coupon({
      code: code.toUpperCase(),
      description: description || '',
      discountType,
      discountValue: Number(discountValue),
      applicableTo: applicableTo || 'Both',
      minAmount: Number(minAmount) || 0,
      maxUses: Number(maxUses),
      expiryDate: new Date(expiryDate),
      isActive: isActive !== false,
      createdBy: req.user?.id || 'admin'
    });

    const saved = await coupon.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('Create coupon error:', err);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

// PUT update coupon
router.put('/:id', async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      applicableTo,
      minAmount,
      maxUses,
      expiryDate,
      isActive
    } = req.body;

    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });

    // Check if code is being changed and if new code already exists
    if (code && code.toUpperCase() !== coupon.code) {
      const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
      if (existingCoupon) {
        return res.status(400).json({ message: 'Coupon code already exists' });
      }
      coupon.code = code.toUpperCase();
    }

    // Validate discount value if being changed
    if (discountValue !== undefined) {
      if (discountType === 'percentage' && (discountValue < 0 || discountValue > 100)) {
        return res.status(400).json({ message: 'Percentage discount must be between 0 and 100' });
      }
      if (discountType === 'fixed' && discountValue <= 0) {
        return res.status(400).json({ message: 'Fixed discount must be greater than 0' });
      }
      coupon.discountValue = Number(discountValue);
    }

    // Validate expiry date if being changed
    if (expiryDate && new Date(expiryDate) <= new Date()) {
      return res.status(400).json({ message: 'Expiry date must be in the future' });
    }

    // Update fields
    if (description !== undefined) coupon.description = description;
    if (discountType) coupon.discountType = discountType;
    if (applicableTo) coupon.applicableTo = applicableTo;
    if (minAmount !== undefined) coupon.minAmount = Number(minAmount);
    if (maxUses !== undefined) coupon.maxUses = Number(maxUses);
    if (expiryDate) coupon.expiryDate = new Date(expiryDate);
    if (isActive !== undefined) coupon.isActive = isActive;

    const updated = await coupon.save();
    res.json(updated);
  } catch (err) {
    console.error('Update coupon error:', err);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

// PUT toggle coupon active status
router.put('/:id/toggle', async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });

    coupon.isActive = !coupon.isActive;
    const updated = await coupon.save();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

// DELETE coupon
router.delete('/:id', async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
    res.json({ success: true, message: 'Coupon deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════
//  COUPON VALIDATION & USAGE (For users applying coupons)
// ═══════════════════════════════════════════════════════

// POST validate coupon (check if valid before applying)
router.post('/validate', async (req, res) => {
  try {
    const { code, userType, amount } = req.body;

    if (!code || !userType || amount === undefined) {
      return res.status(400).json({ message: 'code, userType, and amount are required' });
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase() });

    // Coupon not found
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon code not found' });
    }

    // Coupon is inactive
    if (!coupon.isActive) {
      return res.status(400).json({ message: 'This coupon is no longer active' });
    }

    // Coupon has expired
    if (new Date(coupon.expiryDate) <= new Date()) {
      return res.status(400).json({ message: 'This coupon has expired' });
    }

    // Check if applicable to user type
    if (coupon.applicableTo !== 'Both' && coupon.applicableTo !== userType) {
      return res.status(400).json({
        message: `This coupon is only applicable to ${coupon.applicableTo}s`
      });
    }

    // Check if max uses reached
    if (coupon.usedCount >= coupon.maxUses) {
      return res.status(400).json({ message: 'This coupon has reached its usage limit' });
    }

    // Check minimum amount
    if (amount < coupon.minAmount) {
      return res.status(400).json({
        message: `Minimum purchase amount of ₹${coupon.minAmount} required for this coupon`
      });
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = (amount * coupon.discountValue) / 100;
    } else {
      discountAmount = coupon.discountValue;
    }

    // Discount cannot exceed purchase amount
    discountAmount = Math.min(discountAmount, amount);

    res.json({
      valid: true,
      coupon: {
        _id: coupon._id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount: Math.round(discountAmount),
        finalAmount: Math.round(amount - discountAmount)
      }
    });
  } catch (err) {
    console.error('Validate coupon error:', err);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

// POST apply coupon (mark as used)
router.post('/:id/apply', async (req, res) => {
  try {
    const { userId, userType, orderId, discountAmount } = req.body;

    if (!userId || !userType) {
      return res.status(400).json({ message: 'userId and userType are required' });
    }

    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });

    // Check if already at max uses
    if (coupon.usedCount >= coupon.maxUses) {
      return res.status(400).json({ message: 'Coupon usage limit reached' });
    }

    // Add to usedBy array and increment usedCount
    coupon.usedBy.push({
      userId,
      userType,
      usedAt: new Date(),
      orderId: orderId || null,
      discountAmount: discountAmount || 0
    });
    coupon.usedCount += 1;

    const updated = await coupon.save();
    res.json({
      success: true,
      message: 'Coupon applied successfully',
      coupon: updated
    });
  } catch (err) {
    console.error('Apply coupon error:', err);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

// GET coupon usage details
router.get('/:id/usage', async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });

    const usagePercent = coupon.maxUses > 0 ? (coupon.usedCount / coupon.maxUses) * 100 : 0;
    const totalDiscountGiven = coupon.usedBy.reduce((sum, use) => sum + (use.discountAmount || 0), 0);

    res.json({
      coupon: {
        _id: coupon._id,
        code: coupon.code,
        maxUses: coupon.maxUses,
        usedCount: coupon.usedCount,
        usagePercent: Math.round(usagePercent),
        totalDiscountGiven,
        expiryDate: coupon.expiryDate,
        isExpired: new Date(coupon.expiryDate) <= new Date()
      },
      usageHistory: coupon.usedBy.map(use => ({
        userId: use.userId,
        userType: use.userType,
        usedAt: use.usedAt,
        orderId: use.orderId,
        discountAmount: use.discountAmount
      }))
    });
  } catch (err) {
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
});

export default router;
