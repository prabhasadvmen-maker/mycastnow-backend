import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    minlength: 3,
    maxlength: 20,
    index: true
  },
  description: {
    type: String,
    default: ''
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0
  },
  applicableTo: {
    type: String,
    enum: ['Creator', 'Company', 'Both'],
    default: 'Both'
  },
  minAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  maxUses: {
    type: Number,
    required: true,
    min: 1
  },
  usedCount: {
    type: Number,
    default: 0,
    min: 0
  },
  expiryDate: {
    type: Date,
    required: true,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  createdBy: {
    type: String,
    default: 'admin'
  },
  usedBy: [{
    userId: String,
    userType: String,
    usedAt: {
      type: Date,
      default: Date.now
    },
    orderId: String,
    discountAmount: Number
  }]
}, { timestamps: true });

export default mongoose.model('Coupon', couponSchema);
