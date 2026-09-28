import mongoose from 'mongoose';

const adminBankAccountSchema = new mongoose.Schema({
  adminId: {
    type: String,
    default: 'SUPERADMIN'
  },
  accountHolder: {
    type: String,
    required: true,
    trim: true
  },
  bankName: {
    type: String,
    required: true,
    trim: true
  },
  accountNumber: {
    type: String,
    required: true,
    trim: true
  },
  ifsc: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  accountType: {
    type: String,
    enum: ['Savings', 'Current'],
    default: 'Current'
  },
  upiId: {
    type: String,
    default: '',
    trim: true
  },
  isVerified: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

export default mongoose.model('AdminBankAccount', adminBankAccountSchema);
