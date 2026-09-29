import mongoose from 'mongoose';

const systemSettingsSchema = new mongoose.Schema({
  platformName: {
    type: String,
    default: 'MyCastNow'
  },
  supportEmail: {
    type: String,
    default: 'support@mycastnow.com'
  },
  supportPhone: {
    type: String,
    default: '+91 98765 43210'
  },
  platformCommissionPercent: {
    type: Number,
    default: 10,
    min: 0,
    max: 100
  },
  boostCommissionPercent: {
    type: Number,
    default: 15,
    min: 0,
    max: 100
  },
  minWithdrawalAmount: {
    type: Number,
    default: 500,
    min: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  maintenanceMode: {
    type: Boolean,
    default: false
  },
  allowNewRegistrations: {
    type: Boolean,
    default: true
  },
  autoApproveCreators: {
    type: Boolean,
    default: false
  },
  autoApproveCastings: {
    type: Boolean,
    default: true
  },
  emailNotifications: {
    type: Boolean,
    default: true
  },
  smsNotifications: {
    type: Boolean,
    default: false
  },
  systemNotice: {
    type: String,
    default: 'Platform is operating normally. All services active.'
  }
}, { timestamps: true });

export default mongoose.model('SystemSettings', systemSettingsSchema);
