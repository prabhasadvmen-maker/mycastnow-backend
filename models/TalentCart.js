import mongoose from 'mongoose';

const talentCartSchema = new mongoose.Schema({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Creator',
    required: true
  },
  notes: {
    type: String,
    default: ''
  },
  roleInterest: {
    type: String,
    default: 'General Casting'
  }
}, { timestamps: true });

talentCartSchema.index({ company: 1, creator: 1 }, { unique: true });

export default mongoose.model('TalentCart', talentCartSchema);
