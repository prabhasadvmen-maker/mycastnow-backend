import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: './.env' });

const CreatorSchema = new mongoose.Schema({
  basicDetails: { profilePhoto: String },
  portfolio: { photos: [String], videos: [String] }
}, { strict: false });

const Creator = mongoose.model('Creator', CreatorSchema);

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  const c = await Creator.findOne({}).sort({ _id: -1 });
  console.log("Profile Photo:", c?.basicDetails?.profilePhoto);
  console.log("Photos:", c?.portfolio?.photos);
  console.log("Videos:", c?.portfolio?.videos);
  process.exit();
}
test();
