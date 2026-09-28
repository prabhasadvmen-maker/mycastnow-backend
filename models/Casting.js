import mongoose from 'mongoose';

const castingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
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
  },
  requirements: {
    type: [String],
    default: []
  },
  status: {
    type: String,
    enum: ['Open', 'Closed', 'Draft'],
    default: 'Open'
  }
}, { timestamps: true });

export default mongoose.model('Casting', castingSchema);
