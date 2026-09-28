import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Creator from './models/Creator.js';
import Company from './models/Company.js';
import TalentCart from './models/TalentCart.js';
import Booking from './models/Booking.js';
import Message from './models/Message.js';

dotenv.config();

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mycastnow';

async function seed() {
  await mongoose.connect(mongoUri);
  console.log('Connected to DB for seeding company data...');

  const company = await Company.findOne() || { _id: new mongoose.Types.ObjectId('6ab8136cb407882f7d42a180') };
  const companyId = company._id;

  const creators = await Creator.find({ status: 'approved' }).limit(6);
  if (creators.length === 0) {
    console.log('No approved creators found to seed.');
    process.exit(0);
  }

  console.log(`Found ${creators.length} creators for company ${companyId}`);

  // 1. Seed TalentCart (at least 2 items)
  const cartExisting = await TalentCart.countDocuments({ company: companyId });
  if (cartExisting === 0 && creators.length >= 2) {
    await TalentCart.create([
      {
        company: companyId,
        creator: creators[0]._id,
        roleInterest: 'Lead Protagonist — OTT Thriller',
        notes: 'Top recommendation from casting director. Excellent screen presence in showreel.'
      },
      {
        company: companyId,
        creator: creators[1]._id,
        roleInterest: 'Brand Ambassador — Festive TVC',
        notes: 'Great portfolio with high engagement and expressive look.'
      }
    ]);
    console.log('Seeded 2 TalentCart items.');
  } else {
    console.log(`TalentCart already has ${cartExisting} items.`);
  }

  // 2. Seed Bookings / Hires (at least 3 items)
  const bookingsExisting = await Booking.countDocuments({ company: companyId });
  if (bookingsExisting === 0 && creators.length >= 3) {
    await Booking.create([
      {
        company: companyId,
        creator: creators[0]._id,
        projectTitle: 'Amazon Prime Thriller Series — Episode 1 to 4',
        projectType: 'Web Series',
        description: 'Lead role shoot in Mumbai & Goa locations. Complete wardrobe and look-tests completed.',
        eventDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        location: 'Film City, Goregaon, Mumbai',
        duration: '7 Days',
        amount: 85000,
        currency: 'INR',
        paymentStatus: 'Partially Paid',
        status: 'Confirmed',
        notes: 'Advance of ₹30,000 disbursed. Balance due on shoot completion.'
      },
      {
        company: companyId,
        creator: creators[1]._id,
        projectTitle: 'Lakme Festive Campaign Shoot',
        projectType: 'Brand Shoot',
        description: 'High-fashion editorial print and digital ad shoot.',
        eventDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        location: 'Famous Studios, Mahalaxmi, Mumbai',
        duration: '1 Day',
        amount: 35000,
        currency: 'INR',
        paymentStatus: 'Paid',
        status: 'Confirmed',
        notes: 'Full payment cleared via Escrow.'
      },
      {
        company: companyId,
        creator: creators[2]._id,
        projectTitle: 'Spotify Indie Acoustic Music Video',
        projectType: 'Music Video',
        description: 'Storyline music video directed by award-winning music director.',
        eventDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        location: 'Lonavala & Khandala',
        duration: '2 Days',
        amount: 45000,
        currency: 'INR',
        paymentStatus: 'Paid',
        status: 'Completed',
        notes: 'Shoot successfully wrapped. Post-production underway.'
      }
    ]);
    console.log('Seeded 3 Bookings / Hires.');
  } else {
    console.log(`Bookings already has ${bookingsExisting} records.`);
  }

  // 3. Seed Messages / Inbox (conversations with back-and-forth chat)
  const messagesExisting = await Message.countDocuments({ company: companyId });
  if (messagesExisting === 0 && creators.length >= 2) {
    const c1 = creators[0];
    const c2 = creators[1];

    // Thread with creator 0
    await Message.create([
      {
        company: companyId,
        creator: c1._id,
        senderType: 'Company',
        text: 'Hello! We reviewed your acting showreel on MyCastNow and would love to discuss a lead role for an upcoming OTT thriller series.',
        projectReference: 'Amazon Prime Thriller Series',
        read: true,
        createdAt: new Date(Date.now() - 3600 * 1000 * 24)
      },
      {
        company: companyId,
        creator: c1._id,
        senderType: 'Creator',
        text: 'Hi Advmen Technologies team! Thank you so much. I would be thrilled to audition. When are you looking to schedule the look-test?',
        projectReference: 'Amazon Prime Thriller Series',
        read: true,
        createdAt: new Date(Date.now() - 3600 * 1000 * 20)
      },
      {
        company: companyId,
        creator: c1._id,
        senderType: 'Company',
        text: 'We are scheduling look-tests this Thursday at Andheri West studio. We have booked your dates on the portal.',
        projectReference: 'Amazon Prime Thriller Series',
        read: true,
        createdAt: new Date(Date.now() - 3600 * 1000 * 10)
      },
      {
        company: companyId,
        creator: c1._id,
        senderType: 'Creator',
        text: 'Confirmed! I have received the booking notice and accepted it. See you on Thursday!',
        projectReference: 'Amazon Prime Thriller Series',
        read: false,
        createdAt: new Date(Date.now() - 3600 * 1000 * 2)
      }
    ]);

    // Thread with creator 1
    await Message.create([
      {
        company: companyId,
        creator: c2._id,
        senderType: 'Company',
        text: 'Hi there, we shortlisted your profile for the Lakme Festive commercial campaign. Are you available next week?',
        projectReference: 'Lakme Festive Campaign Shoot',
        read: true,
        createdAt: new Date(Date.now() - 3600 * 1000 * 48)
      },
      {
        company: companyId,
        creator: c2._id,
        senderType: 'Creator',
        text: 'Yes! My dates are open from Wednesday through Saturday. Day rate as listed on my profile works perfectly.',
        projectReference: 'Lakme Festive Campaign Shoot',
        read: false,
        createdAt: new Date(Date.now() - 3600 * 1000 * 5)
      }
    ]);

    console.log('Seeded Message conversations.');
  } else {
    console.log(`Messages already has ${messagesExisting} records.`);
  }

  console.log('Seeding finished successfully.');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
