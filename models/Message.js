import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
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
  senderType: {
    type: String,
    enum: ['Company', 'Creator', 'Admin'],
    default: 'Company'
  },
  text: {
    type: String,
    required: true,
    trim: true
  },
  projectReference: {
    type: String,
    default: ''
  },
  attachment: {
    url: { type: String, default: '' },
    fileType: { type: String, default: '' },
    name: { type: String, default: '' }
  },
  read: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

messageSchema.index({ company: 1, creator: 1 });
messageSchema.index({ createdAt: -1 });

export default mongoose.model('Message', messageSchema);
