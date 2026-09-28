import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Company from './models/Company.js';
import WalletTransaction from './models/WalletTransaction.js';
import SubscriptionPlan from './models/SubscriptionPlan.js';

dotenv.config();

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mycastnow';

async function seed() {
  await mongoose.connect(mongoUri);
  console.log('Connected to DB for seeding company full details...');

  const company = await Company.findOne() || { _id: new mongoose.Types.ObjectId('6ab8136cb407882f7d42a180') };
  const companyId = company._id;

  // 1. Update Company Profile Details
  await Company.findByIdAndUpdate(companyId, {
    $set: {
      name: company.name || 'Advmen Technologies',
      logo: company.logo || 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?auto=format&fit=crop&w=400&q=80',
      email: company.email || 'prabhas.advmen@gmail.com',
      phone: '+91 98201 45892',
      industry: 'Film & Commercial Media Production',
      website: 'https://advmen.tech',
      location: 'Mumbai, Maharashtra',
      tagline: 'Premium OTT & Advertising Production House',
      description: 'Advmen Technologies is a premier media & film production house based in Mumbai. We specialize in OTT series production, pan-India commercial ad films, celebrity brand shoots, and high-impact digital music videos.',
      address: 'Plot 42, Lotus Grandeur, Veera Desai Industrial Estate, Andheri West',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400053',
      gst: '27AABCA1234F1Z8',
      cin: 'U74999MH2021PTC367890',
      pan: 'AABCA1234F',
      contactPerson: {
        name: 'Prabhas Sharma',
        designation: 'Head of Casting & Talent Operations',
        phone: '+91 98201 45892',
        email: 'prabhas.advmen@gmail.com'
      },
      socialLinks: {
        instagram: 'https://instagram.com/advmentech',
        linkedin: 'https://linkedin.com/company/advmen-technologies',
        imdb: 'https://imdb.com/company/advmen',
        youtube: 'https://youtube.com/@advmentv'
      },
      walletBalance: 275000,
      escrowBalance: 85000,
      verified: true,
      subscription: {
        planName: 'Pro Production House',
        status: 'Active',
        startDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 320 * 24 * 60 * 60 * 1000),
        billingCycle: 'Yearly',
        features: {
          unlimitedCastings: true,
          directTalentMessaging: true,
          priorityEscrow: true,
          verifiedBadge: true,
          managerSupport: true
        }
      }
    }
  });
  console.log('Company Profile updated successfully.');

  // 2. Seed Subscription Plans if not present
  const existingPlans = await SubscriptionPlan.find({ targetAudience: { $in: ['Company', 'Both'] } });
  if (existingPlans.length === 0) {
    await SubscriptionPlan.create([
      {
        name: 'Starter Casting Studio',
        description: 'Essential casting & scouting tools for independent filmmakers and boutique agencies.',
        targetAudience: 'Company',
        monthlyPrice: 4999,
        yearlyPrice: 49990,
        currency: 'INR',
        features: [
          'Up to 5 Active Casting Calls',
          'Direct Messaging with 25 Talents/mo',
          'Standard Escrow Protection',
          'Email & Chat Support'
        ],
        maxCastingApplications: 5,
        prioritySupport: false,
        verifiedBadge: false
      },
      {
        name: 'Pro Production House',
        description: 'Full-featured power package for high-volume film shoots, OTT shows, and ad campaigns.',
        targetAudience: 'Company',
        monthlyPrice: 12999,
        yearlyPrice: 129990,
        currency: 'INR',
        features: [
          'Unlimited Active Casting Calls',
          'Unlimited Direct Talent Messaging',
          '0% Platform Escrow Fee',
          'Verified Studio Blue Badge',
          'Dedicated Casting Coordinator',
          'Instant Audition Video Downloads'
        ],
        maxCastingApplications: -1,
        prioritySupport: true,
        verifiedBadge: true
      },
      {
        name: 'Enterprise Film Studio',
        description: 'Custom SLA, multi-user seats, and bespoke talent contracting for major studios.',
        targetAudience: 'Company',
        monthlyPrice: 29999,
        yearlyPrice: 299990,
        currency: 'INR',
        features: [
          'Everything in Pro Studio',
          'Unlimited Casting Submissions',
          'Multi-Seat Team Accounts (10 Users)',
          'Custom Legal NDAs & Contracts',
          'Dedicated Account Director',
          'API Integration & Webhooks'
        ],
        maxCastingApplications: -1,
        prioritySupport: true,
        verifiedBadge: true
      }
    ]);
    console.log('Seeded company subscription plans.');
  }

  // 3. Seed Wallet Transactions if empty
  const existingTx = await WalletTransaction.countDocuments({ userId: companyId.toString(), userType: 'Company' });
  if (existingTx === 0) {
    await WalletTransaction.create([
      {
        userId: companyId.toString(),
        userType: 'Company',
        userName: 'Advmen Technologies',
        userContact: 'prabhas.advmen@gmail.com',
        type: 'Credit',
        amount: 350000,
        currency: 'INR',
        description: 'Corporate Bank Transfer (NEFT Top-Up via HDFC Bank)',
        referenceId: 'NEFT-HDFC-992140',
        referenceType: 'Manual',
        status: 'Completed',
        balanceAfter: 350000,
        notes: 'Annual talent booking reserve fund.'
      },
      {
        userId: companyId.toString(),
        userType: 'Company',
        userName: 'Advmen Technologies',
        userContact: 'prabhas.advmen@gmail.com',
        type: 'Debit',
        amount: 35000,
        currency: 'INR',
        description: 'Shoot Escrow Milestone: Lakme Festive Campaign',
        referenceId: 'ESC-LAKME-01',
        referenceType: 'Booking',
        status: 'Completed',
        balanceAfter: 315000,
        notes: 'Disbursed to talent upon shoot wrap.'
      },
      {
        userId: companyId.toString(),
        userType: 'Company',
        userName: 'Advmen Technologies',
        userContact: 'prabhas.advmen@gmail.com',
        type: 'Debit',
        amount: 40000,
        currency: 'INR',
        description: 'Advance Talent Milestone: OTT Thriller Series Ep 1-4',
        referenceId: 'ESC-OTT-ADV-02',
        referenceType: 'Booking',
        status: 'Completed',
        balanceAfter: 275000,
        notes: 'Locked in escrow for upcoming shoot.'
      }
    ]);
    console.log('Seeded 3 wallet transactions.');
  }

  console.log('All company seed records verified!');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
