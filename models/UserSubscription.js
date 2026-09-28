import mongoose from 'mongoose';

// Tracks which Creator/Company has which active plan
const userSubscriptionSchema = new mongoose.Schema({
  // Who subscribed?
  userId: {
    type: String,   // ObjectId as string (can be Creator or Company)
    required: true
  },
  userType: {
    type: String,
    enum: ['Creator', 'Company'],
    required: true
  },
  userName: {
    type: String,
    default: ''
  },
  userContact: {
    type: String,
    default: ''
  },

  // Which plan?
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
    required: true
  },

  // Duration purchased
  billingCycle: {
    type: String,
    enum: ['Monthly', 'Yearly', 'Trial', 'Lifetime'],
    default: 'Monthly'
  },
  amountPaid: {
    type: Number,
    default: 0
  },

  // Dates
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },

  // Status
  status: {
    type: String,
    enum: ['Active', 'Expired', 'Cancelled', 'Trial'],
    default: 'Active'
  },

  // Payment reference
  paymentId: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  }

}, { timestamps: true });

userSubscriptionSchema.index({ userId: 1, status: 1 });
userSubscriptionSchema.index({ plan: 1 });

export default mongoose.model('UserSubscription', userSubscriptionSchema);
