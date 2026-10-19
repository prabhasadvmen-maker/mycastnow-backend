import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Creator',
      default: null,
      index: true
    },
    // Creator snapshot at time of payment
    creatorName: { type: String, default: '' },
    creatorPhone: { type: String, default: '' },
    creatorEmail: { type: String, default: '' },
    profilePhoto: { type: String, default: '' },

    // Nested compatibility fields for frontend consumers
    basicDetails: {
      fullName: { type: String, default: '' },
      profilePhoto: { type: String, default: '' }
    },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },

    // Financial transaction details
    amount: { type: Number, required: true },
    couponCode: { type: String, default: '' },
    discountAmount: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    paymentType: {
      type: String,
      default: 'onboarding_fee'
    },
    orderId: { type: String, required: true },
    paymentId: { type: String, required: true, unique: true, sparse: true, index: true },
    signature: { type: String },

    // Compatibility fields matching Creator document
    onboardingPaymentId: { type: String },
    onboardingOrderId: { type: String },
    onboardingPaidAt: { type: Date },

    // Payment status & timestamps
    status: {
      type: String,
      enum: ['paid', 'failed', 'refunded'],
      default: 'paid',
      index: true
    },
    paidAt: { type: Date, default: Date.now, index: true },

    // Profile lifecycle flags
    isCreatorDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date }
  },
  { timestamps: true }
);

paymentSchema.index({ creatorName: 'text', 'basicDetails.fullName': 'text', phone: 'text', paymentId: 'text' });

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
