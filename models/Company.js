import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const companySchema = new mongoose.Schema({
  name: { type: String, required: true },
  logo: { type: String, default: '' },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  phone: { type: String, default: '' },
  industry: { type: String, default: 'Film & Media Production' },
  website: { type: String, default: '' },
  location: { type: String, default: 'Mumbai' },
  tagline: { type: String, default: 'Leading Media & Casting Production House' },
  description: { type: String, default: '' },

  // Address
  address: { type: String, default: '' },
  city: { type: String, default: 'Mumbai' },
  state: { type: String, default: 'Maharashtra' },
  pincode: { type: String, default: '400053' },

  // Business & Legal
  gst: { type: String, default: '' },
  cin: { type: String, default: '' },
  pan: { type: String, default: '' },

  // Contact Person
  contactPerson: {
    name: { type: String, default: '' },
    designation: { type: String, default: 'Casting Director' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' }
  },

  // Social Links & Showreel
  socialLinks: {
    instagram: { type: String, default: '' },
    linkedin: { type: String, default: '' },
    imdb: { type: String, default: '' },
    youtube: { type: String, default: '' }
  },

  // Financial Wallet
  walletBalance: { type: Number, default: 250000 },
  escrowBalance: { type: Number, default: 85000 },

  // Verification & Status
  verified: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true },

  // Subscription Details
  subscription: {
    planName: { type: String, default: 'Pro Production Studio' },
    status: { type: String, default: 'Active' },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, default: () => new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) },
    billingCycle: { type: String, default: 'Yearly' },
    features: {
      unlimitedCastings: { type: Boolean, default: true },
      directTalentMessaging: { type: Boolean, default: true },
      priorityEscrow: { type: Boolean, default: true },
      verifiedBadge: { type: Boolean, default: true },
      managerSupport: { type: Boolean, default: true }
    }
  }
}, { timestamps: true });

companySchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

export default mongoose.model('Company', companySchema);
