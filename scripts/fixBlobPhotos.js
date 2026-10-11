import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Creator = mongoose.model('Creator', new mongoose.Schema({}, { strict: false }));

  const creators = await Creator.find({}).lean();
  let fixedCount = 0;

  for (const c of creators) {
    const photo = c.basicDetails?.profilePhoto;
    if (typeof photo === 'string' && photo.startsWith('blob:')) {
      const fallback = c.portfolio?.photos?.[0] || '';
      console.log(`Fixing ${c.basicDetails?.fullName}: replacing "${photo}" with "${fallback}"`);
      await Creator.updateOne(
        { _id: c._id },
        { $set: { 'basicDetails.profilePhoto': fallback } }
      );
      fixedCount++;
    }
  }

  console.log(`Cleaned up ${fixedCount} creators with blob URLs.`);

  const aadhya = await Creator.findOne({ 'basicDetails.fullName': /Aadhya/i }).lean();
  console.log('Aadhya Verma profilePhoto now:', aadhya?.basicDetails?.profilePhoto);

  await mongoose.disconnect();
}

run().catch(console.error);
