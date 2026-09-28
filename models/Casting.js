import mongoose from 'mongoose';

const castingSchema = new mongoose.Schema({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  projectType: {
    type: String,
    enum: ['Ad Film', 'Web Series', 'Movie', 'Short Film', 'Music Video', 'Brand Shoot', 'Fashion Show', 'Print Shoot', 'Other'],
    default: 'Brand Shoot'
  },
  roleType: {
    type: String,
    default: 'Actor'
  },
  gender: {
    type: String,
    enum: ['Female', 'Male', 'Any', 'Transgender'],
    default: 'Any'
  },
  ageRange: {
    type: String,
    default: '20-30 Years'
  },
  location: {
    type: String,
    default: 'Mumbai'
  },
  shootDates: {
    type: String,
    default: ''
  },
  budget: {
    type: String,
    default: '₹20,000 - ₹35,000 / day'
  },
  deadline: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  },
  description: {
    type: String,
    default: ''
  },
  requirements: {
    type: [String],
    default: []
  },
  status: {
    type: String,
    enum: ['Open', 'In Review', 'Closed', 'Draft', 'Archived'],
    default: 'Open'
  },
  image: {
    type: String,
    default: ''
  },
  applicantsCount: {
    type: Number,
    default: 0
  },
  applicants: [{
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Creator',
      required: true
    },
    appliedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['Applied', 'Shortlisted', 'Audition Scheduled', 'Selected', 'Rejected'],
      default: 'Applied'
    },
    notes: {
      type: String,
      default: ''
    }
  }]
}, { timestamps: true });

castingSchema.index({ company: 1 });
castingSchema.index({ status: 1 });
castingSchema.index({ createdAt: -1 });

export default mongoose.model('Casting', castingSchema);
