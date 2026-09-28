import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  // Review direction:
  // 'CompanyToCreator': Company reviewed Creator
  // 'CreatorToCompany': Creator reviewed Company
  reviewType: {
    type: String,
    enum: ['CompanyToCreator', 'CreatorToCompany'],
    required: true
  },

  // Reviewer details (The one writing the review)
  reviewerType: {
    type: String,
    enum: ['Company', 'Creator'],
    required: true
  },
  reviewerId: {
    type: String,
    required: true
  },
  reviewerName: {
    type: String,
    required: true
  },
  reviewerEmail: {
    type: String,
    default: ''
  },
  reviewerPhoto: {
    type: String,
    default: ''
  },

  // Target / Reviewee details (The one being reviewed)
  targetType: {
    type: String,
    enum: ['Company', 'Creator'],
    required: true
  },
  targetId: {
    type: String,
    required: true
  },
  targetName: {
    type: String,
    required: true
  },
  targetPhoto: {
    type: String,
    default: ''
  },

  // Associated Project / Booking
  projectTitle: {
    type: String,
    default: 'Casting & Brand Shoot'
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    default: null
  },

  // Ratings (1 to 5 Stars)
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  criteria: {
    professionalism: { type: Number, min: 1, max: 5, default: 5 },
    communication: { type: Number, min: 1, max: 5, default: 5 },
    punctuality: { type: Number, min: 1, max: 5, default: 5 },
    workQuality: { type: Number, min: 1, max: 5, default: 5 }
  },

  // Feedback Content
  title: {
    type: String,
    default: ''
  },
  comment: {
    type: String,
    required: true
  },

  // Status for admin moderation
  status: {
    type: String,
    enum: ['Published', 'Pending', 'Flagged', 'Hidden'],
    default: 'Published'
  },

  isVerifiedProject: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

reviewSchema.index({ reviewType: 1 });
reviewSchema.index({ targetId: 1 });
reviewSchema.index({ reviewerId: 1 });
reviewSchema.index({ rating: 1 });
reviewSchema.index({ createdAt: -1 });

export default mongoose.model('Review', reviewSchema);
