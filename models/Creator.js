import mongoose from 'mongoose';

const creatorSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    sparse: true,
    unique: true
  },
  role: {
    type: String,
    default: 'creator'
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  rejectionReason: {
    type: String,
    default: ''
  },
  onboardingStep: {
    type: Number,
    default: 1
  },
  isProfileComplete: {
    type: Boolean,
    default: false
  },
  
  // 1. Basic Details
  basicDetails: {
    fullName: String,
    profilePhoto: String,
    dob: Date,
    gender: String,
    city: String,
    serviceArea: [String],
    bio: String,
    languages: [String]
  },

  // 2. Professional Details
  professionalDetails: {
    primaryCategory: String,
    subCategory: String,
    skills: [String],
    experience: String,
    previousProjects: [String],
    previousBrands: [String]
  },

  // 3. Physical Details
  physicalDetails: {
    height: String,
    weight: String,
    chest: String,
    waist: String,
    hips: String,
    eyeColor: String,
    hairColor: String,
    shoeSize: String,
    complexion: String
  },

  // 4. Portfolio
  portfolio: {
    photos: [String],
    videos: [String],
    campaigns: [{
      title: String,
      brand: String,
      supportingDocs: [String]
    }]
  },

  // 5. Pricing
  pricing: {
    hourlyRate: Number,
    dayRate: Number,
    projectRate: Number,
    minimumBooking: String,
    travelCharges: String,
    extraCharges: String
  },

  // 6. Availability
  availability: {
    status: {
      type: String,
      enum: ['Available', 'Unavailable', 'Busy'],
      default: 'Available'
    },
    calendar: [{
      date: Date,
      note: String
    }]
  },

  // 7. Verification
  verification: {
    documents: [String],
    status: {
      type: String,
      enum: ['Pending', 'Under Review', 'Verified', 'Rejected'],
      default: 'Pending'
    }
  },

  // 8. Stats
  stats: {
    totalBookings: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    reviewsCount: { type: Number, default: 0 }
  }
}, { timestamps: true });

const Creator = mongoose.model('Creator', creatorSchema);
export default Creator;
