import mongoose from 'mongoose';

const subscriptionPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true  // e.g. "Starter", "Pro", "Enterprise"
  },
  description: {
    type: String,
    default: ''
  },
  targetAudience: {
    type: String,
    enum: ['Creator', 'Company', 'Both'],
    default: 'Both'
  },

  // Pricing
  monthlyPrice: {
    type: Number,
    default: 0
  },
  yearlyPrice: {
    type: Number,
    default: 0   // usually discounted yearly price
  },
  currency: {
    type: String,
    default: 'INR'
  },

  // Plan Limits / Features
  features: {
    type: [String],
    default: []  // e.g. ["Unlimited Applications", "Priority Support", "Badge"]
  },
  maxCastingApplications: {
    type: Number,
    default: -1   // -1 = unlimited
  },
  maxPortfolioPhotos: {
    type: Number,
    default: -1
  },
  maxBookingsPerMonth: {
    type: Number,
    default: -1
  },
  prioritySupport: {
    type: Boolean,
    default: false
  },
  verifiedBadge: {
    type: Boolean,
    default: false
  },
  featuredListing: {
    type: Boolean,
    default: false
  },

  // Display
  badgeColor: {
    type: String,
    default: 'blue'  // 'blue' | 'purple' | 'gold' | 'gray'
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  trialDays: {
    type: Number,
    default: 0
  },

  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  }

}, { timestamps: true });

export default mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
