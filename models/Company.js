import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const companySchema = new mongoose.Schema({
  name: { type: String, required: true },
  logo: { type: String },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  industry: { type: String },
  website: { type: String },
  location: { type: String },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

companySchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

export default mongoose.model('Company', companySchema);
