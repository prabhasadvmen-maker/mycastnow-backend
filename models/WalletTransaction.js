import mongoose from 'mongoose';

const walletTransactionSchema = new mongoose.Schema({
  userId:      { type: String, required: true },
  userType:    { type: String, enum: ['Admin', 'Company', 'Creator'], required: true },
  userName:    { type: String, default: '' },
  userContact: { type: String, default: '' },
  type:        { type: String, enum: ['Credit', 'Debit', 'Withdrawal'], required: true },
  amount:      { type: Number, required: true },
  currency:    { type: String, default: 'INR' },
  description: { type: String, default: '' },
  referenceId:   { type: String, default: '' },
  referenceType: { type: String, default: '' },
  status:      { type: String, enum: ['Pending', 'Completed', 'Failed'], default: 'Pending' },
  balanceAfter: { type: Number, default: 0 },
  payoutDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
  notes:       { type: String, default: '' }
}, { timestamps: true });

export default mongoose.model('WalletTransaction', walletTransactionSchema);
