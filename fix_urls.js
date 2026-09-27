import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const CreatorSchema = new mongoose.Schema({
  basicDetails: { profilePhoto: String },
  portfolio: { photos: [String], videos: [String] }
}, { strict: false });

const Creator = mongoose.model('Creator', CreatorSchema);

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const creators = await Creator.find({});
  for (let c of creators) {
    let changed = false;
    
    // Fix profilePhoto
    if (c.basicDetails?.profilePhoto?.includes('pub-advmenngo.r2.dev')) {
      c.basicDetails.profilePhoto = c.basicDetails.profilePhoto.replace(
        'https://pub-advmenngo.r2.dev',
        'http://localhost:5000/api/upload/file'
      );
      changed = true;
    }
    
    // Fix portfolio photos
    if (c.portfolio?.photos) {
      c.portfolio.photos = c.portfolio.photos.map(p => {
        if (p.includes('pub-advmenngo.r2.dev')) {
          changed = true;
          return p.replace('https://pub-advmenngo.r2.dev', 'http://localhost:5000/api/upload/file');
        }
        return p;
      });
    }
    
    // Fix portfolio videos
    if (c.portfolio?.videos) {
      c.portfolio.videos = c.portfolio.videos.map(v => {
        if (v.includes('pub-advmenngo.r2.dev')) {
          changed = true;
          return v.replace('https://pub-advmenngo.r2.dev', 'http://localhost:5000/api/upload/file');
        }
        return v;
      });
    }
    
    if (changed) {
      await c.save();
      console.log(`Updated creator ${c._id}`);
    }
  }
  
  console.log("Done updating URLs");
  process.exit();
}
run();
