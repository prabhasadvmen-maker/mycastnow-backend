import mongoose from 'mongoose';

const profileBoostSchema = new mongoose.Schema({
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Creator',
    required: true
  },
  creatorName: {
    type: String,
    required: true
  },
  creatorPhone: {
    type: String,
    default: ''
  },
  creatorCategory: {
    type: String,
    default: 'Actor'
  },
  creatorPhoto: {
    type: String,
    default: ''
  },
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BoostPlan',
    default: null
  },
  planName: {
    type: String,
    required: true
  },
  durationDays: {
    type: Number,
    required: true
  },
  amountPaid: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  paymentStatus: {
    type: String,
    enum: ['Paid', 'Pending', 'Failed', 'Refunded'],
    default: 'Paid'
  },
  paymentMethod: {
    type: String,
    enum: ['UPI', 'Card', 'NetBanking', 'Wallet', 'Razorpay', 'Admin Free'],
    default: 'UPI'
  },
  transactionId: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Active', 'Pending', 'Expired', 'Cancelled'],
    default: 'Active'
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  impressions: {
    type: Number,
    default: 0
  },
  clicks: {
    type: Number,
    default: 0
  },
  adminNotes: {
    type: String,
    default: ''
  }
}, { timestamps: true });

profileBoostSchema.index({ creator: 1 });
profileBoostSchema.index({ status: 1 });
profileBoostSchema.index({ endDate: 1 });
profileBoostSchema.index({ createdAt: -1 });

export default mongoose.model('ProfileBoost', profileBoostSchema);
