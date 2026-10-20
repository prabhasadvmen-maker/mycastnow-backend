import mongoose from 'mongoose';

const companyPaymentHistorySchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
  companyName: { type: String, required: true },
  email: { type: String, required: true },
  registrationPaymentId: { type: String, required: true },
  registrationOrderId: { type: String, default: null },
  registrationFee: { type: Number, required: true },
  registrationPaidAt: { type: Date, required: true },
  couponCode: { type: String, default: null },
  discountAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['completed', 'pending', 'failed'], default: 'completed' }
}, { timestamps: true });

export default mongoose.model('CompanyPaymentHistory', companyPaymentHistorySchema);
