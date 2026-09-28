import mongoose from 'mongoose';

const boostPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  tagline: {
    type: String,
    default: 'Get 3x more casting opportunities'
  },
  badge: {
    type: String,
    default: '' // e.g. "Popular", "Best Value", "VIP"
  },
  durationDays: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  originalPrice: {
    type: Number,
    default: 0
  },
  features: [{
    type: String,
    trim: true
  }],
  priorityScore: {
    type: Number,
    default: 10 // Higher score = higher rank in mobile app & web search
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isPopular: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

export default mongoose.model('BoostPlan', boostPlanSchema);
