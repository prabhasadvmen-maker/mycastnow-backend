import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema({
  name: {
    type: String,
    default: 'Super Admin',
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    default: 'Super Admin'
  },
  phone: {
    type: String,
    default: ''
  },
  avatar: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    default: 'Platform Super Administrator with full system privileges.'
  },
  notificationPreferences: {
    emailAlerts: { type: Boolean, default: true },
    bookingAlerts: { type: Boolean, default: true },
    securityAlerts: { type: Boolean, default: true },
    systemUpdates: { type: Boolean, default: true }
  }
}, { timestamps: true });

export default mongoose.model('Admin', adminSchema);
