import express from 'express';
import Coupon from '../models/Coupon.js';
import logger from '../config/logger.js';

const router = express.Router();

// POST /validate - Validate coupon code (public endpoint)
router.post('/validate', async (req, res) => {
  try {
    const { code, applicableTo, amount } = req.body;

    if (!code || !applicableTo) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code and applicable type are required'
      });
    }

    // Find coupon
    const coupon = await Coupon.findOne({
      code: code.toUpperCase(),
      isActive: true
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon code not found or inactive'
      });
    }

    // Check expiry
    if (new Date(coupon.expiryDate) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Coupon has expired'
      });
    }

    // Check if applicable to user type
    if (coupon.applicableTo !== 'Both' && coupon.applicableTo !== applicableTo) {
      return res.status(400).json({
        success: false,
        message: `This coupon is only applicable for ${coupon.applicableTo}s`
      });
    }

    // Check max uses
    if (coupon.usedCount >= coupon.maxUses) {
      return res.status(400).json({
        success: false,
        message: 'Coupon usage limit reached'
      });
    }

    // Check minimum amount
    if (amount && coupon.minAmount > 0 && amount < coupon.minAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum purchase amount of ₹${coupon.minAmount} required for this coupon`
      });
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = Math.round((amount * coupon.discountValue) / 100);
    } else {
      discountAmount = coupon.discountValue;
    }

    // Ensure discount doesn't exceed amount
    discountAmount = Math.min(discountAmount, amount || 0);

    res.json({
      success: true,
      coupon: {
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue
      },
      discountAmount,
      finalAmount: Math.max(0, (amount || 0) - discountAmount)
    });
  } catch (error) {
    logger.error('Coupon validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate coupon'
    });
  }
});

export default router;
