import mongoose from 'mongoose';

const castingSchema = new mongoose.Schema({
<<<<<<< HEAD
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null
  },
=======
>>>>>>> 1f70375fafd78a0f3779c2f53dc8f6e6fc24f30c
  title: {
    type: String,
    required: true,
    trim: true
  },
<<<<<<< HEAD
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
=======
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null // Null if created directly by Admin
  },
  image: {
    type: String,
    default: null
  },
  description: {
    type: String,
    required: true
  },
  roleType: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  budget: {
    type: String,
    default: 'Negotiable'
  },
  deadline: {
    type: Date,
    required: true
>>>>>>> 1f70375fafd78a0f3779c2f53dc8f6e6fc24f30c
  },
  requirements: {
    type: [String],
    default: []
  },
  status: {
    type: String,
<<<<<<< HEAD
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

=======
    enum: ['Open', 'Closed', 'Draft'],
    default: 'Open'
  }
}, { timestamps: true });

>>>>>>> 1f70375fafd78a0f3779c2f53dc8f6e6fc24f30c
export default mongoose.model('Casting', castingSchema);
