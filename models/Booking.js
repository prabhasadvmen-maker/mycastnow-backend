import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  // Company jo book kar rahi hai
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  // Creator jisko book kiya gaya hai
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Creator',
    required: true
  },
  // Casting call se link (optional)
  castingCall: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Casting',
    default: null
  },

  // Booking Details
  projectTitle: {
    type: String,
    required: true,
    trim: true
  },
  projectType: {
    type: String,
    enum: ['Ad Film', 'Web Series', 'Movie', 'Short Film', 'Music Video', 'Brand Shoot', 'Event', 'Other'],
    default: 'Other'
  },
  description: {
    type: String,
    default: ''
  },

  // Schedule
  eventDate: {
    type: Date,
    required: true
  },
  eventEndDate: {
    type: Date,
    default: null
  },
  location: {
    type: String,
    default: ''
  },
  duration: {
    type: String,
    default: '' // e.g. "1 Day", "3 Hours"
  },

  // Financials
  amount: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  paymentStatus: {
    type: String,
    enum: ['Unpaid', 'Partially Paid', 'Paid', 'Refunded'],
    default: 'Unpaid'
  },

  // Status
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled'],
    default: 'Pending'
  },

  // Extra
  notes: {
    type: String,
    default: ''
  },
  cancelReason: {
    type: String,
    default: ''
  }

}, { timestamps: true });

// Index for faster queries
bookingSchema.index({ company: 1 });
bookingSchema.index({ creator: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ createdAt: -1 });

export default mongoose.model('Booking', bookingSchema);
