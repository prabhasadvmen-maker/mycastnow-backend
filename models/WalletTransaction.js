import mongoose from 'mongoose';

const walletTransactionSchema = new mongoose.Schema({
  // Owner
  userId: { type: String, required: true },
  userType: { type: String, enum: ['Creator', 'Company', 'Admin'], required: true },
  userName: { type: String, default: '' },
  userContact: { type: String, default: '' },

  // Transaction
  type: {
    type: String,
    enum: ['Credit', 'Debit', 'Refund', 'Withdrawal', 'Bonus', 'Penalty'],
    required: true
  },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },

  // Reference
  description: { type: String, default: '' },
  referenceId: { type: String, default: '' }, // booking ID, payment ID, UTR etc.
  referenceType: {
    type: String,
    enum: ['Booking', 'Subscription', 'Manual', 'Refund', 'Withdrawal', 'Bonus', 'Other'],
    default: 'Manual'
  },

  // Status
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed', 'Reversed'],
    default: 'Completed'
  },

  // Balance snapshot after this tx
  balanceAfter: { type: Number, default: 0 },

  // Payout / Bank Withdrawal Details
  payoutDetails: {
    payoutMethod: { type: String, default: 'Bank Transfer' },
    accountHolder: { type: String, default: '' },
    bankName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    ifsc: { type: String, default: '' },
    upiId: { type: String, default: '' },
    utrNumber: { type: String, default: '' },
    payoutId: { type: String, default: '' }
  },

  notes: { type: String, default: '' }

}, { timestamps: true });

walletTransactionSchema.index({ userId: 1, createdAt: -1 });
walletTransactionSchema.index({ type: 1 });
walletTransactionSchema.index({ status: 1 });

export default mongoose.model('WalletTransaction', walletTransactionSchema);
